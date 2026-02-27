import { describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, stat, symlink, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionRenameBatch } from "../src/cli/actions";
import { createCapturedRuntime, createTempFixtureDir, toRepoRelativePath } from "./helpers/cli-test-utils";
import { expectCliError, removeIfPresent } from "./helpers/cli-action-test-utils";

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
      expect(second.stdout.text).toContain("(skipped: symlink)");

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
});
