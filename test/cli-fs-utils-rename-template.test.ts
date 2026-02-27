import { describe, expect, test } from "bun:test";
import { mkdir, rm, utimes, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { planBatchRename, planSingleRename } from "../src/cli/fs-utils";
import { createCapturedRuntime, createTempFixtureDir, toRepoRelativePath } from "./helpers/cli-test-utils";

describe("rename planner template + serial behavior", () => {
  test("applies mtime serial ordering with pre-count width guardrail", async () => {
    const fixtureDir = await createTempFixtureDir("rename-template");
    try {
      const { runtime } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "mtime-order");
      await mkdir(dirPath, { recursive: true });

      const aPath = join(dirPath, "a.txt");
      const bPath = join(dirPath, "b.txt");
      await writeFile(aPath, "a", "utf8");
      await writeFile(bPath, "b", "utf8");

      await utimes(aPath, new Date("2026-02-27T10:00:00.000Z"), new Date("2026-02-27T10:00:00.000Z"));
      await utimes(bPath, new Date("2026-02-27T09:00:00.000Z"), new Date("2026-02-27T09:00:00.000Z"));

      const result = await planBatchRename(runtime, toRepoRelativePath(dirPath), {
        pattern: "{serial}-{stem}",
        serialOrder: "mtime_asc",
        serialStart: 2,
        serialWidth: 3,
      });

      const byFromName = new Map(
        result.plans.map((plan) => [basename(plan.fromPath), basename(plan.toPath)]),
      );

      expect(byFromName.get("b.txt")).toBe("002-b.txt");
      expect(byFromName.get("a.txt")).toBe("003-a.txt");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("supports serial reset per directory in recursive mode", async () => {
    const fixtureDir = await createTempFixtureDir("rename-template");
    try {
      const { runtime } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "serial-scope");
      const dirA = join(dirPath, "a");
      const dirB = join(dirPath, "b");
      await mkdir(dirA, { recursive: true });
      await mkdir(dirB, { recursive: true });

      const aPath = join(dirA, "one.txt");
      const bPath = join(dirB, "two.txt");
      await writeFile(aPath, "1", "utf8");
      await writeFile(bPath, "2", "utf8");

      const result = await planBatchRename(runtime, toRepoRelativePath(dirPath), {
        pattern: "{serial_##}-{stem}",
        serialScope: "directory",
        recursive: true,
      });

      const byFromName = new Map(
        result.plans.map((plan) => [basename(plan.fromPath), basename(plan.toPath)]),
      );
      expect(byFromName.get("one.txt")).toBe("01-one.txt");
      expect(byFromName.get("two.txt")).toBe("01-two.txt");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("normalizes leading separator when prefix is empty", async () => {
    const fixtureDir = await createTempFixtureDir("rename-template");
    try {
      const { runtime } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "prefix-empty");
      await mkdir(dirPath, { recursive: true });
      const path = join(dirPath, "My File.txt");
      await writeFile(path, "x", "utf8");

      const result = await planSingleRename(runtime, toRepoRelativePath(path), {
        prefix: "",
        pattern: "{prefix}-{stem}",
      });

      expect(basename(result.plan.toPath)).toBe("my-file.txt");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("treats {date} as local-date default and keeps {date_utc} explicit", async () => {
    const fixtureDir = await createTempFixtureDir("rename-template");
    try {
      const { runtime } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "date-placeholders");
      await mkdir(dirPath, { recursive: true });
      const path = join(dirPath, "entry.txt");
      await writeFile(path, "x", "utf8");
      await utimes(path, new Date("2026-02-27T12:00:00.000Z"), new Date("2026-02-27T12:00:00.000Z"));

      const defaultDate = await planSingleRename(runtime, toRepoRelativePath(path), {
        pattern: "{date}-{stem}",
      });
      const explicitLocalDate = await planSingleRename(runtime, toRepoRelativePath(path), {
        pattern: "{date_local}-{stem}",
      });

      expect(basename(defaultDate.plan.toPath)).toBe(basename(explicitLocalDate.plan.toPath));

      const explicitUtcDate = await planSingleRename(runtime, toRepoRelativePath(path), {
        pattern: "{date_utc}-{stem}",
      });
      expect(basename(explicitUtcDate.plan.toPath)).toContain("2026-02-27");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("rejects unknown placeholders and non-mtime alias order token", async () => {
    const fixtureDir = await createTempFixtureDir("rename-template");
    try {
      const { runtime } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "invalid-pattern");
      await mkdir(dirPath, { recursive: true });
      const path = join(dirPath, "file.txt");
      await writeFile(path, "x", "utf8");

      await expect(
        planSingleRename(runtime, toRepoRelativePath(path), {
          pattern: "{unknown}-{stem}",
        }),
      ).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });

      await expect(
        planSingleRename(runtime, toRepoRelativePath(path), {
          pattern: "{serial_order_time_asc}-{stem}",
        }),
      ).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
