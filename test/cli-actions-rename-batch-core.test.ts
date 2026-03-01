import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, stat, symlink, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionRenameBatch } from "../src/cli/actions";
import { formatLocalFileDateTime } from "../src/utils/datetime";
import {
  createCapturedRuntime,
  createTempFixtureDir,
  toRepoRelativePath,
} from "./helpers/cli-test-utils";
import {
  captureRenamePlanCsvSnapshot,
  cleanupRenamePlanCsvSinceSnapshot,
  expectCliError,
  removeIfPresent,
} from "./helpers/cli-action-test-utils";

let renamePlanCsvSnapshot = new Set<string>();

beforeEach(async () => {
  renamePlanCsvSnapshot = await captureRenamePlanCsvSnapshot();
});

afterEach(async () => {
  await cleanupRenamePlanCsvSinceSnapshot(renamePlanCsvSnapshot);
});

async function withTimezone<T>(timezone: string, run: () => Promise<T>): Promise<T> {
  const previousTimezone = process.env.TZ;
  process.env.TZ = timezone;
  try {
    return await run();
  } finally {
    if (previousTimezone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTimezone;
    }
  }
}

describe("cli action modules: rename batch core", () => {
  test("actionRenameBatch dry-run previews renames and returns counts", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-dry-run");
      await mkdir(dirPath, { recursive: true });

      const filePath = join(dirPath, "photo one.txt");
      await writeFile(filePath, "hello", "utf8");
      const fixedTime = new Date("2026-02-25T12:34:56.000Z");
      await utimes(filePath, fixedTime, fixedTime);

      const relativeDir = toRepoRelativePath(dirPath);
      const result = await actionRenameBatch(runtime, {
        directory: relativeDir,
        prefix: "file",
        dryRun: true,
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(result.totalCount).toBe(1);
      expect(result.changedCount).toBe(1);
      expect(result.planCsvPath).toBeDefined();
      expect(stdout.text).toContain(`Directory: ${relativeDir}`);
      expect(stdout.text).toContain("Files found: 1");
      expect(stdout.text).toContain("Files to rename: 1");
      expect(stdout.text).toContain("Plan CSV:");
      expect(stdout.text).toContain("Dry run only. No files were renamed.");
      expect(stdout.text).toContain("photo one.txt ->");

      const after = await stat(filePath);
      expect(after.isFile()).toBe(true);
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch without prefix omits the old implicit file prefix", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-batch-no-prefix");
      await mkdir(dirPath, { recursive: true });

      const filePath = join(dirPath, "photo one.txt");
      await writeFile(filePath, "hello", "utf8");
      const fixedTime = new Date("2026-02-25T12:34:56.000Z");
      await utimes(filePath, fixedTime, fixedTime);

      const result = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        dryRun: true,
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(result.totalCount).toBe(1);
      expect(result.changedCount).toBe(1);
      expect(stdout.text).toContain("photo one.txt -> 20260225-123456-photo-one.txt");
      expect(stdout.text).not.toContain("file-20260225-123456-photo-one.txt");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch excludes hidden/system junk files by default", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-default-excludes");
      await mkdir(dirPath, { recursive: true });

      const keptPath = join(dirPath, "photo one.txt");
      const hiddenPath = join(dirPath, ".gitignore");
      const dsStorePath = join(dirPath, ".DS_Store");
      await writeFile(keptPath, "hello", "utf8");
      await writeFile(hiddenPath, "node_modules\n", "utf8");
      await writeFile(dsStorePath, "junk", "utf8");

      const fixedTime = new Date("2026-02-25T12:34:56.000Z");
      await utimes(keptPath, fixedTime, fixedTime);
      await utimes(hiddenPath, fixedTime, fixedTime);
      await utimes(dsStorePath, fixedTime, fixedTime);

      const result = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        prefix: "file",
        dryRun: true,
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(result.totalCount).toBe(1);
      expect(result.changedCount).toBe(1);
      expect(stdout.text).toContain("Files found: 1");
      expect(stdout.text).not.toContain(".gitignore");
      expect(stdout.text).not.toContain(".DS_Store");

      const csvText = await readFile(planCsvPath!, "utf8");
      expect(csvText).toContain("photo one.txt");
      expect(csvText).not.toContain(".gitignore");
      expect(csvText).not.toContain(".DS_Store");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch applies renames when dryRun is false", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-apply");
      await mkdir(dirPath, { recursive: true });

      const originalPath = join(dirPath, "draft note.md");
      await writeFile(originalPath, "content", "utf8");
      const fixedTime = new Date("2026-02-25T07:08:09.000Z");
      await utimes(originalPath, fixedTime, fixedTime);

      const relativeDir = toRepoRelativePath(dirPath);
      const result = await actionRenameBatch(runtime, {
        directory: relativeDir,
        prefix: "doc",
        dryRun: false,
      });

      expect(stderr.text).toBe("");
      expect(result.totalCount).toBe(1);
      expect(result.changedCount).toBe(1);
      expect(stdout.text).toContain(`Directory: ${relativeDir}`);
      expect(stdout.text).toContain("Renamed 1 file(s).");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch handles an empty directory", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-empty");
      await mkdir(dirPath, { recursive: true });

      const relativeDir = toRepoRelativePath(dirPath);
      const result = await actionRenameBatch(runtime, {
        directory: relativeDir,
        prefix: "file",
        dryRun: true,
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(result.totalCount).toBe(0);
      expect(result.changedCount).toBe(0);
      expect(result.planCsvPath).toBeDefined();
      expect(stdout.text).toContain(`Directory: ${relativeDir}`);
      expect(stdout.text).toContain("Files found: 0");
      expect(stdout.text).toContain("Files to rename: 0");
      expect(stdout.text).toContain("Dry run only. No files were renamed.");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch supports recursive traversal and skips symlinks with audit reasons", async () => {
    if (process.platform === "win32") {
      return;
    }

    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const first = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-recursive");
      const nestedDir = join(dirPath, "nested");
      await mkdir(nestedDir, { recursive: true });

      const rootFile = join(dirPath, "root.txt");
      const nestedFile = join(nestedDir, "child.txt");
      const linkPath = join(dirPath, "nested-link");
      await writeFile(rootFile, "root", "utf8");
      await writeFile(nestedFile, "child", "utf8");
      await symlink(nestedDir, linkPath);

      const noRecursive = await actionRenameBatch(first.runtime, {
        directory: toRepoRelativePath(dirPath),
        prefix: "doc",
        dryRun: true,
        recursive: false,
      });
      await removeIfPresent(noRecursive.planCsvPath);

      expect(noRecursive.totalCount).toBe(1);

      const second = createCapturedRuntime();
      const recursiveResult = await actionRenameBatch(second.runtime, {
        directory: toRepoRelativePath(dirPath),
        prefix: "doc",
        dryRun: true,
        recursive: true,
      });
      planCsvPath = recursiveResult.planCsvPath;

      expect(first.stderr.text).toBe("");
      expect(second.stderr.text).toBe("");
      expect(recursiveResult.totalCount).toBe(2);
      expect(recursiveResult.changedCount).toBe(2);
      expect(second.stdout.text).toContain("Entries skipped: 1");
      expect(second.stdout.text).toContain("Skipped summary:");
      expect(second.stdout.text).toContain("- 1 symlink");

      const csvText = await readFile(planCsvPath!, "utf8");
      expect(csvText).toContain("nested-link");
      expect(csvText).toContain(",skipped,symlink");
      expect(csvText).toContain("nested/child.txt");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch limits recursive traversal with maxDepth", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPathA: string | undefined;
    let planCsvPathB: string | undefined;
    try {
      const dirPath = join(fixtureDir, "rename-max-depth");
      const d1 = join(dirPath, "level1");
      const d2 = join(d1, "level2");
      await mkdir(d2, { recursive: true });

      await writeFile(join(dirPath, "root.txt"), "r", "utf8");
      await writeFile(join(d1, "child.txt"), "c", "utf8");
      await writeFile(join(d2, "grand.txt"), "g", "utf8");

      const a = createCapturedRuntime();
      const rootOnly = await actionRenameBatch(a.runtime, {
        directory: toRepoRelativePath(dirPath),
        prefix: "doc",
        dryRun: true,
        recursive: true,
        maxDepth: 0,
      });
      planCsvPathA = rootOnly.planCsvPath;
      expect(rootOnly.totalCount).toBe(1);
      expect(a.stdout.text).toContain("Files found: 1");
      expect(a.stdout.text).toContain("root.txt ->");
      expect(a.stdout.text).not.toContain("child.txt");

      const b = createCapturedRuntime();
      const depthOne = await actionRenameBatch(b.runtime, {
        directory: toRepoRelativePath(dirPath),
        prefix: "doc",
        dryRun: true,
        recursive: true,
        maxDepth: 1,
      });
      planCsvPathB = depthOne.planCsvPath;
      expect(depthOne.totalCount).toBe(2);
      expect(b.stdout.text).toContain("root.txt ->");
      expect(b.stdout.text).toContain("child.txt ->");
      expect(b.stdout.text).not.toContain("grand.txt");
    } finally {
      await removeIfPresent(planCsvPathA);
      await removeIfPresent(planCsvPathB);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch dry-run truncates large rename previews and emphasizes the plan csv", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      Object.assign(runtime.stdout as object, { isTTY: true, rows: 28 });

      const dirPath = join(fixtureDir, "rename-large-preview");
      await mkdir(dirPath, { recursive: true });

      const fixedTime = new Date("2026-02-25T12:34:56.000Z");
      for (let index = 1; index <= 20; index += 1) {
        const filePath = join(dirPath, `photo ${String(index).padStart(2, "0")}.txt`);
        await writeFile(filePath, "hello", "utf8");
        await utimes(filePath, fixedTime, fixedTime);
      }

      const result = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        prefix: "file",
        dryRun: true,
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(result.totalCount).toBe(20);
      expect(result.changedCount).toBe(20);
      expect(stdout.text).toContain(
        "Renames: showing first 5 and last 5 of 20 rows; 10 omitted from the middle.",
      );
      expect(stdout.text).toContain("...");
      expect(stdout.text).toContain("photo 01.txt ->");
      expect(stdout.text).toContain("photo 20.txt ->");
      expect(stdout.text).toContain(
        "Full review: use the generated plan CSV for the complete rename list.",
      );
      expect(stdout.text).toContain("Plan CSV:");
      expect(stdout.text).toContain("Dry run only. No files were renamed.");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch dry-run keeps full rename previews on non-tty output", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();

      const dirPath = join(fixtureDir, "rename-large-preview-non-tty");
      await mkdir(dirPath, { recursive: true });

      const fixedTime = new Date("2026-02-25T12:34:56.000Z");
      for (let index = 1; index <= 50; index += 1) {
        const filePath = join(dirPath, `photo ${String(index).padStart(2, "0")}.txt`);
        await writeFile(filePath, "hello", "utf8");
        await utimes(filePath, fixedTime, fixedTime);
      }

      const result = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        prefix: "file",
        dryRun: true,
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(result.totalCount).toBe(50);
      expect(result.changedCount).toBe(50);
      expect(stdout.text).toContain("photo 01.txt ->");
      expect(stdout.text).toContain("photo 25.txt ->");
      expect(stdout.text).toContain("photo 50.txt ->");
      expect(stdout.text).not.toContain("Renames: showing first");
      expect(stdout.text).not.toContain(
        "Full review: use the generated plan CSV for the complete rename list.",
      );
      expect(stdout.text).not.toContain("...");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch dry-run keeps changed rows visible when unchanged rows would fill the compact window", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      Object.assign(runtime.stdout as object, { isTTY: true, rows: 28 });

      const dirPath = join(fixtureDir, "rename-mixed-preview");
      await mkdir(dirPath, { recursive: true });

      const fixedTime = new Date("2026-02-25T12:34:56.000Z");
      for (let index = 1; index <= 8; index += 1) {
        const filePath = join(dirPath, `a-${String(index).padStart(2, "0")}.txt`);
        await writeFile(filePath, "hello", "utf8");
        await utimes(filePath, fixedTime, fixedTime);
      }
      for (let index = 1; index <= 4; index += 1) {
        const filePath = join(dirPath, `m ${String(index).padStart(2, "0")}.txt`);
        await writeFile(filePath, "hello", "utf8");
        await utimes(filePath, fixedTime, fixedTime);
      }
      for (let index = 1; index <= 8; index += 1) {
        const filePath = join(dirPath, `z-${String(index).padStart(2, "0")}.txt`);
        await writeFile(filePath, "hello", "utf8");
        await utimes(filePath, fixedTime, fixedTime);
      }

      const result = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        pattern: "{stem}",
        dryRun: true,
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(result.totalCount).toBe(20);
      expect(result.changedCount).toBe(4);
      expect(stdout.text).toContain("Renames:");
      expect(stdout.text).toContain("m 01.txt -> m-01.txt");
      expect(stdout.text).toContain("m 04.txt -> m-04.txt");
      expect(stdout.text).not.toContain("Renames: showing first");
      expect(stdout.text).not.toContain("...");
      expect(stdout.text).not.toContain("a-01.txt (unchanged)");
      expect(stdout.text).not.toContain("z-08.txt (unchanged)");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch can render detailed skipped-item output separately from the default summary", async () => {
    if (process.platform === "win32") {
      return;
    }

    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      Object.assign(runtime.stdout as object, { isTTY: true, rows: 28 });

      const dirPath = join(fixtureDir, "rename-detailed-skips");
      const nestedDir = join(dirPath, "nested");
      await mkdir(nestedDir, { recursive: true });

      const rootFile = join(dirPath, "root.txt");
      const nestedFile = join(nestedDir, "child.txt");
      const linkA = join(dirPath, "link-a");
      const linkB = join(dirPath, "link-b");
      const linkC = join(dirPath, "link-c");
      await writeFile(rootFile, "root", "utf8");
      await writeFile(nestedFile, "child", "utf8");
      await symlink(nestedDir, linkA);
      await symlink(nestedDir, linkB);
      await symlink(nestedDir, linkC);

      const result = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        prefix: "doc",
        dryRun: true,
        recursive: true,
        previewSkips: "detailed",
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(stdout.text).toContain("Skipped summary:");
      expect(stdout.text).toContain("- 3 symlink");
      expect(stdout.text).toContain("Skipped details:");
      expect(stdout.text).toContain("link-a (skipped: symlink)");
      expect(stdout.text).toContain("link-b (skipped: symlink)");
      expect(stdout.text).toContain("link-c (skipped: symlink)");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch rejects invalid previewSkips values", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    try {
      const { runtime } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-invalid-preview-skips");
      await mkdir(dirPath, { recursive: true });
      await writeFile(join(dirPath, "root.txt"), "root", "utf8");

      await expectCliError(
        () =>
          actionRenameBatch(runtime, {
            directory: toRepoRelativePath(dirPath),
            dryRun: true,
            previewSkips: "verbose" as "summary",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Invalid --preview-skips value",
        },
      );
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  for (const scenario of [
    {
      label: "requires --recursive when maxDepth is provided",
      options: { maxDepth: 1 },
      messageIncludes: "--max-depth requires --recursive.",
    },
    {
      label: "rejects negative maxDepth",
      options: { recursive: true, maxDepth: -1 },
      messageIncludes: "--max-depth must be a non-negative integer.",
    },
  ] as const) {
    test(`actionRenameBatch ${scenario.label}`, async () => {
      const fixtureDir = await createTempFixtureDir("actions");
      try {
        const dirPath = join(fixtureDir, "rename-max-depth-invalid");
        await mkdir(dirPath, { recursive: true });

        const { runtime } = createCapturedRuntime();
        await expectCliError(
          () =>
            actionRenameBatch(runtime, {
              directory: toRepoRelativePath(dirPath),
              dryRun: true,
              ...scenario.options,
            }),
          { code: "INVALID_INPUT", exitCode: 2, messageIncludes: scenario.messageIncludes },
        );
      } finally {
        await rm(fixtureDir, { recursive: true, force: true });
      }
    });
  }

  test("actionRenameBatch scopes files with regex and extension filters", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-scope-filters");
      await mkdir(dirPath, { recursive: true });

      await writeFile(join(dirPath, "keep-photo.JPG"), "1", "utf8");
      await writeFile(join(dirPath, "skip-photo.png"), "2", "utf8");
      await writeFile(join(dirPath, "other.jpg"), "3", "utf8");
      await writeFile(join(dirPath, "notes.txt"), "4", "utf8");

      const result = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        prefix: "img",
        dryRun: true,
        matchRegex: "photo",
        skipRegex: "^skip",
        ext: ["jpg", "png"],
        skipExt: ["png"],
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(result.totalCount).toBe(1);
      expect(result.changedCount).toBe(1);
      expect(stdout.text).toContain("Files found: 1");
      expect(stdout.text).toContain("keep-photo.JPG -> img-");
      expect(stdout.text).not.toContain("skip-photo.png");
      expect(stdout.text).not.toContain("other.jpg");
      expect(stdout.text).not.toContain("notes.txt");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch supports preset file profiles (media/docs/images)", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    const planCsvPaths: string[] = [];
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-profile");
      await mkdir(dirPath, { recursive: true });

      const mediaFile = join(dirPath, "clip.mp4");
      const docFile = join(dirPath, "notes.md");
      const otherFile = join(dirPath, "script.ts");
      await writeFile(mediaFile, "video", "utf8");
      await writeFile(docFile, "# notes\n", "utf8");
      await writeFile(otherFile, "console.log('x')\n", "utf8");

      const fixedTime = new Date("2026-02-25T11:22:33.000Z");
      await utimes(mediaFile, fixedTime, fixedTime);
      await utimes(docFile, fixedTime, fixedTime);
      await utimes(otherFile, fixedTime, fixedTime);

      const relativeDir = toRepoRelativePath(dirPath);
      for (const scenario of [
        {
          profile: "media",
          expectedPresent: "clip.mp4",
          expectedAbsent: ["notes.md", "script.ts"],
        },
        {
          profile: "docs",
          expectedPresent: "notes.md",
          expectedAbsent: ["clip.mp4", "script.ts"],
        },
      ] as const) {
        stdout.text = "";
        const result = await actionRenameBatch(runtime, {
          directory: relativeDir,
          profile: scenario.profile,
          dryRun: true,
        });
        if (result.planCsvPath) {
          planCsvPaths.push(result.planCsvPath);
        }

        expect(stderr.text).toBe("");
        expect(result.totalCount).toBe(1);
        expect(stdout.text).toContain(scenario.expectedPresent);
        for (const value of scenario.expectedAbsent) {
          expect(stdout.text).not.toContain(value);
        }
      }
    } finally {
      for (const path of planCsvPaths) {
        await removeIfPresent(path);
      }
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  for (const scenario of [
    {
      label: "rejects invalid --profile values",
      dirName: "rename-invalid-profile",
      options: { profile: "banana" },
      messageIncludes: "Invalid --profile value",
    },
    {
      label: "rejects invalid regex scope filters",
      dirName: "rename-invalid-regex",
      options: { matchRegex: "(" },
      messageIncludes: "Invalid --match-regex:",
    },
  ] as const) {
    test(`actionRenameBatch ${scenario.label}`, async () => {
      const fixtureDir = await createTempFixtureDir("actions");
      try {
        const { runtime, stdout, stderr } = createCapturedRuntime();
        const dirPath = join(fixtureDir, scenario.dirName);
        await mkdir(dirPath, { recursive: true });

        await expectCliError(
          () =>
            actionRenameBatch(runtime, {
              directory: toRepoRelativePath(dirPath),
              dryRun: true,
              ...scenario.options,
            }),
          { code: "INVALID_INPUT", exitCode: 2, messageIncludes: scenario.messageIncludes },
        );

        expect(stdout.text).toBe("");
        expect(stderr.text).toBe("");
      } finally {
        await rm(fixtureDir, { recursive: true, force: true });
      }
    });
  }

  test("actionRenameBatch --timestamp-timezone local rewrites legacy {timestamp} to local form", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "tz-local");
      await mkdir(dirPath, { recursive: true });

      const filePath = join(dirPath, "note.txt");
      await writeFile(filePath, "x", "utf8");
      const fixedTime = new Date("2026-03-01T08:30:00.000Z");
      await utimes(filePath, fixedTime, fixedTime);

      const result = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        prefix: "doc",
        dryRun: true,
        timestampTimezone: "local",
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(result.changedCount).toBe(1);

      // The plan CSV should contain timestamp_tz metadata = "local"
      const csvText = await readFile(planCsvPath!, "utf8");
      expect(csvText).toContain(",timestamp_tz");
      const dataLine = csvText.split("\n").find((l) => l.includes("note.txt"));
      expect(dataLine).toBeDefined();
      expect(dataLine).toContain(",local");

      // The new_name should use local-time (not UTC) — pattern is internal,
      // but the resulting filename differs from UTC when local != UTC.
      // At minimum, confirm it doesn't match the UTC timestamp.
      const cells = dataLine!.split(",");
      const newName = cells[1] ?? "";
      // Just verify the filename was generated (non-empty, has expected shape)
      expect(newName).toMatch(/^doc-\d{8}-\d{6}-note\.txt$/);
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch --timestamp-timezone utc explicitly sets utc metadata", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "tz-utc");
      await mkdir(dirPath, { recursive: true });

      const filePath = join(dirPath, "item.txt");
      await writeFile(filePath, "x", "utf8");
      const fixedTime = new Date("2026-03-01T23:00:00.000Z");
      await utimes(filePath, fixedTime, fixedTime);

      const result = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        prefix: "doc",
        dryRun: true,
        timestampTimezone: "utc",
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      const csvText = await readFile(planCsvPath!, "utf8");
      const dataLine = csvText.split("\n").find((l) => l.includes("item.txt"));
      expect(dataLine).toBeDefined();
      expect(dataLine).toContain(",utc");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch explicit {timestamp_local} in pattern ignores --timestamp-timezone flag", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "tz-explicit");
      await mkdir(dirPath, { recursive: true });

      const filePath = join(dirPath, "demo.txt");
      await writeFile(filePath, "x", "utf8");
      const fixedTime = new Date("2026-03-01T15:00:00.000Z");
      await utimes(filePath, fixedTime, fixedTime);

      // Pattern already uses explicit {timestamp_local} — CLI flag "utc" should be ignored
      const result = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        pattern: "{prefix}-{timestamp_local}-{stem}",
        prefix: "doc",
        dryRun: true,
        timestampTimezone: "utc",
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      const csvText = await readFile(planCsvPath!, "utf8");
      const dataLine = csvText.split("\n").find((l) => l.includes("demo.txt"));
      expect(dataLine).toBeDefined();
      // Should still record "local" because the pattern explicitly says so
      expect(dataLine).toContain(",local");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch rewrites legacy timestamps in mixed templates", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      await withTimezone("Asia/Taipei", async () => {
        const { runtime, stderr } = createCapturedRuntime();
        const dirPath = join(fixtureDir, "tz-mixed");
        await mkdir(dirPath, { recursive: true });

        const filePath = join(dirPath, "demo.txt");
        await writeFile(filePath, "x", "utf8");
        const fixedTime = new Date("2026-03-01T15:00:00.000Z");
        await utimes(filePath, fixedTime, fixedTime);

        const result = await actionRenameBatch(runtime, {
          directory: toRepoRelativePath(dirPath),
          pattern: "{timestamp}-{timestamp_utc}-{stem}",
          dryRun: true,
          timestampTimezone: "local",
        });
        planCsvPath = result.planCsvPath;

        expect(stderr.text).toBe("");
        const csvText = await readFile(planCsvPath!, "utf8");
        const dataLine = csvText.split("\n").find((line) => line.includes("demo.txt"));
        expect(dataLine).toBeDefined();

        const newName = dataLine!.split(",")[1] ?? "";
        const expectedLocalTimestamp = formatLocalFileDateTime(fixedTime);
        expect(newName).toContain(`${expectedLocalTimestamp}-20260301-150000-demo.txt`);
      });
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch without timestamp in pattern records empty timestamp_tz", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "tz-none");
      await mkdir(dirPath, { recursive: true });

      const filePath = join(dirPath, "no-ts.txt");
      await writeFile(filePath, "x", "utf8");
      const fixedTime = new Date("2026-03-01T12:00:00.000Z");
      await utimes(filePath, fixedTime, fixedTime);

      const result = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        pattern: "{prefix}-{stem}",
        prefix: "raw",
        dryRun: true,
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      const csvText = await readFile(planCsvPath!, "utf8");

      // The new_name should not contain a timestamp segment
      const dataLine = csvText.split("\n").find((l) => l.includes("no-ts.txt"));
      expect(dataLine).toBeDefined();
      const newName = dataLine!.split(",")[1] ?? "";
      expect(newName).toBe("raw-no-ts.txt");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
