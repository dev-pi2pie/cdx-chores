import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
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

describe("cli action modules: rename batch recursion", () => {
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
});
