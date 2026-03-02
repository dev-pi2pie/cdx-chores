import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionRenameBatch } from "../src/cli/actions";
import {
  captureRenamePlanCsvSnapshot,
  cleanupRenamePlanCsvSinceSnapshot,
  expectCliError,
  removeIfPresent,
} from "./helpers/cli-action-test-utils";
import {
  createCapturedRuntime,
  createTempFixtureDir,
  toRepoRelativePath,
} from "./helpers/cli-test-utils";

let renamePlanCsvSnapshot = new Set<string>();

beforeEach(async () => {
  renamePlanCsvSnapshot = await captureRenamePlanCsvSnapshot();
});

afterEach(async () => {
  await cleanupRenamePlanCsvSinceSnapshot(renamePlanCsvSnapshot);
});

describe("cli action modules: rename batch filters", () => {
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
