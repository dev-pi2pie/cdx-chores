import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, symlink, utimes, writeFile } from "node:fs/promises";
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

describe("cli action modules: rename batch preview", () => {
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
});
