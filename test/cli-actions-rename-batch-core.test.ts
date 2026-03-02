import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionRenameBatch } from "../src/cli/actions";
import {
  createCapturedRuntime,
  createTempFixtureDir,
  toRepoRelativePath,
} from "./helpers/cli-test-utils";
import {
  captureRenamePlanCsvSnapshot,
  cleanupRenamePlanCsvSinceSnapshot,
  removeIfPresent,
} from "./helpers/cli-action-test-utils";

let renamePlanCsvSnapshot = new Set<string>();

beforeEach(async () => {
  renamePlanCsvSnapshot = await captureRenamePlanCsvSnapshot();
});

afterEach(async () => {
  await cleanupRenamePlanCsvSinceSnapshot(renamePlanCsvSnapshot);
});

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
});
