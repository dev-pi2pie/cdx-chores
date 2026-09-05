import { describe, expect, test } from "bun:test";
import { unlinkSync } from "node:fs";
import { mkdir, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { planBatchRename } from "../../../src/cli/fs-utils";
import {
  createCapturedRuntime,
  createTempFixtureDir,
  toRepoRelativePath,
} from "../../helpers/cli-test-utils";

describe("rename planner template + serial behavior", () => {
  test("batch planning avoids untouched sibling target collisions", async () => {
    const fixtureDir = await createTempFixtureDir("rename-template");
    try {
      const { runtime } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "batch-collision");
      await mkdir(dirPath, { recursive: true });
      const sourcePath = join(dirPath, "photo one.txt");
      const existingTargetPath = join(dirPath, "doc-20260225-030405-photo-one.txt");
      await writeFile(sourcePath, "source", "utf8");
      await writeFile(existingTargetPath, "occupied", "utf8");
      await utimes(
        sourcePath,
        new Date("2026-02-25T03:04:05.000Z"),
        new Date("2026-02-25T03:04:05.000Z"),
      );

      const result = await planBatchRename(runtime, toRepoRelativePath(dirPath), {
        prefix: "doc",
        fileFilter: (entryName) => entryName === "photo one.txt",
      });

      expect(result.plans.map((plan) => basename(plan.toPath))).toEqual([
        "doc-20260225-030405-photo-one-01.txt",
      ]);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("batch planning avoids directory and symlink target collisions", async () => {
    if (process.platform === "win32") {
      return;
    }

    const fixtureDir = await createTempFixtureDir("rename-template");
    try {
      const { runtime } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "batch-blockers");
      await mkdir(dirPath, { recursive: true });
      const directorySourcePath = join(dirPath, "directory blocker.txt");
      const symlinkSourcePath = join(dirPath, "symlink blocker.txt");
      const realPath = join(dirPath, "real-target.txt");
      await writeFile(directorySourcePath, "directory", "utf8");
      await writeFile(symlinkSourcePath, "symlink", "utf8");
      await writeFile(realPath, "real", "utf8");

      await mkdir(join(dirPath, "directory-blocker.txt"));
      await symlink(realPath, join(dirPath, "symlink-blocker.txt"));

      const result = await planBatchRename(runtime, toRepoRelativePath(dirPath), {
        pattern: "{stem}",
        fileFilter: (entryName) => entryName.endsWith(" blocker.txt"),
      });

      const toNames = result.plans.map((plan) => basename(plan.toPath)).sort();
      expect(toNames).toEqual(["directory-blocker-01.txt", "symlink-blocker-01.txt"]);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("batch planning suffixes collisions between planned targets", async () => {
    const fixtureDir = await createTempFixtureDir("rename-template");
    try {
      const { runtime } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "planned-collision");
      await mkdir(dirPath, { recursive: true });
      const aPath = join(dirPath, "alpha.txt");
      const bPath = join(dirPath, "beta.txt");
      await writeFile(aPath, "a", "utf8");
      await writeFile(bPath, "b", "utf8");

      const result = await planBatchRename(runtime, toRepoRelativePath(dirPath), {
        pattern: "{stem}",
        titleOverrides: new Map([
          [aPath, "same"],
          [bPath, "same"],
        ]),
      });

      const toNames = result.plans.map((plan) => basename(plan.toPath)).sort();
      expect(toNames).toEqual(["same-01.txt", "same.txt"]);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("batch planning skips files that disappear before stat", async () => {
    const fixtureDir = await createTempFixtureDir("rename-template");
    try {
      const { runtime } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "stale-entry");
      await mkdir(dirPath, { recursive: true });
      const stablePath = join(dirPath, "stable.txt");
      const stalePath = join(dirPath, "stale.txt");
      await writeFile(stablePath, "stable", "utf8");
      await writeFile(stalePath, "stale", "utf8");

      const result = await planBatchRename(runtime, toRepoRelativePath(dirPath), {
        fileFilter: (entryName) => {
          if (entryName === "stale.txt") {
            unlinkSync(stalePath);
          }
          return true;
        },
      });

      expect(result.plans.map((plan) => basename(plan.fromPath))).toEqual(["stable.txt"]);
      expect(result.skipped).toEqual([]);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
