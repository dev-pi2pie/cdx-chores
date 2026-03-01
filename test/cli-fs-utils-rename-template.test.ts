import { describe, expect, test } from "bun:test";
import { mkdir, rm, utimes, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { planBatchRename, planSingleRename } from "../src/cli/fs-utils";
import {
  createCapturedRuntime,
  createTempFixtureDir,
  toRepoRelativePath,
} from "./helpers/cli-test-utils";

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

      await utimes(
        aPath,
        new Date("2026-02-27T10:00:00.000Z"),
        new Date("2026-02-27T10:00:00.000Z"),
      );
      await utimes(
        bPath,
        new Date("2026-02-27T09:00:00.000Z"),
        new Date("2026-02-27T09:00:00.000Z"),
      );

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
      await utimes(
        path,
        new Date("2026-02-27T12:00:00.000Z"),
        new Date("2026-02-27T12:00:00.000Z"),
      );

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

      await expect(
        planSingleRename(runtime, toRepoRelativePath(path), {
          pattern: "{serial}-{serial_###}-{stem}",
        }),
      ).rejects.toMatchObject({
        code: "INVALID_INPUT",
        message: "Invalid --pattern: only one {serial...} placeholder is supported per template.",
      });
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("{timestamp} remains UTC (backward compatibility)", async () => {
    const fixtureDir = await createTempFixtureDir("rename-template");
    try {
      const { runtime } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "ts-compat");
      await mkdir(dirPath, { recursive: true });
      const path = join(dirPath, "note.txt");
      await writeFile(path, "x", "utf8");
      await utimes(
        path,
        new Date("2026-02-27T23:45:00.000Z"),
        new Date("2026-02-27T23:45:00.000Z"),
      );

      const result = await planSingleRename(runtime, toRepoRelativePath(path), {
        pattern: "{timestamp}-{stem}",
      });
      expect(basename(result.plan.toPath)).toBe("20260227-234500-note.txt");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("{timestamp_utc} produces same output as {timestamp}", async () => {
    const fixtureDir = await createTempFixtureDir("rename-template");
    try {
      const { runtime } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "ts-utc-explicit");
      await mkdir(dirPath, { recursive: true });
      const path = join(dirPath, "note.txt");
      await writeFile(path, "x", "utf8");
      await utimes(
        path,
        new Date("2026-02-27T23:45:00.000Z"),
        new Date("2026-02-27T23:45:00.000Z"),
      );

      const legacy = await planSingleRename(runtime, toRepoRelativePath(path), {
        pattern: "{timestamp}-{stem}",
      });
      const explicit = await planSingleRename(runtime, toRepoRelativePath(path), {
        pattern: "{timestamp_utc}-{stem}",
      });
      expect(basename(explicit.plan.toPath)).toBe(basename(legacy.plan.toPath));
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("{timestamp_local} uses local time and is accepted as a valid placeholder", async () => {
    const fixtureDir = await createTempFixtureDir("rename-template");
    try {
      const { runtime } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "ts-local");
      await mkdir(dirPath, { recursive: true });
      const path = join(dirPath, "note.txt");
      await writeFile(path, "x", "utf8");
      await utimes(
        path,
        new Date("2026-02-27T12:00:00.000Z"),
        new Date("2026-02-27T12:00:00.000Z"),
      );

      const result = await planSingleRename(runtime, toRepoRelativePath(path), {
        pattern: "{timestamp_local}-{stem}",
      });
      const name = basename(result.plan.toPath);
      // Should match YYYYMMDD-HHMMSS-note.txt format
      expect(name).toMatch(/^\d{8}-\d{6}-note\.txt$/);
      // Must not throw (validates token acceptance)
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("{timestamp_utc_iso} renders compact UTC ISO with Z suffix", async () => {
    const fixtureDir = await createTempFixtureDir("rename-template");
    try {
      const { runtime } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "ts-utc-iso");
      await mkdir(dirPath, { recursive: true });
      const path = join(dirPath, "note.txt");
      await writeFile(path, "x", "utf8");
      await utimes(
        path,
        new Date("2026-02-27T23:45:00.000Z"),
        new Date("2026-02-27T23:45:00.000Z"),
      );

      const result = await planSingleRename(runtime, toRepoRelativePath(path), {
        pattern: "{timestamp_utc_iso}-{stem}",
      });
      expect(basename(result.plan.toPath)).toBe("20260227T234500Z-note.txt");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("{timestamp_local_iso} renders compact local ISO with numeric offset", async () => {
    const fixtureDir = await createTempFixtureDir("rename-template");
    try {
      const { runtime } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "ts-local-iso");
      await mkdir(dirPath, { recursive: true });
      const path = join(dirPath, "note.txt");
      await writeFile(path, "x", "utf8");
      await utimes(
        path,
        new Date("2026-02-27T12:34:56.000Z"),
        new Date("2026-02-27T12:34:56.000Z"),
      );

      const result = await planSingleRename(runtime, toRepoRelativePath(path), {
        pattern: "{timestamp_local_iso}-{stem}",
      });
      const name = basename(result.plan.toPath);
      expect(name).toMatch(/^\d{8}T\d{6}[+-]\d{4}-note\.txt$/);
      expect(name.includes("Z")).toBe(false);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("{timestamp_local_12h} is accepted and uses compact AM/PM suffix", async () => {
    const fixtureDir = await createTempFixtureDir("rename-template");
    try {
      const { runtime } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "ts-local-12h");
      await mkdir(dirPath, { recursive: true });
      const path = join(dirPath, "note.txt");
      await writeFile(path, "x", "utf8");
      await utimes(
        path,
        new Date("2026-02-27T12:34:56.000Z"),
        new Date("2026-02-27T12:34:56.000Z"),
      );

      const result = await planSingleRename(runtime, toRepoRelativePath(path), {
        pattern: "{timestamp_local_12h}-{stem}",
      });
      expect(basename(result.plan.toPath)).toMatch(/^\d{8}-\d{6}(AM|PM)-note\.txt$/);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("{timestamp_utc_12h} uses compact UTC AM/PM output", async () => {
    const fixtureDir = await createTempFixtureDir("rename-template");
    try {
      const { runtime } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "ts-utc-12h");
      await mkdir(dirPath, { recursive: true });
      const morningPath = join(dirPath, "morning.txt");
      const noonPath = join(dirPath, "noon.txt");
      const midnightPath = join(dirPath, "midnight.txt");
      await writeFile(morningPath, "x", "utf8");
      await writeFile(noonPath, "x", "utf8");
      await writeFile(midnightPath, "x", "utf8");
      await utimes(
        morningPath,
        new Date("2026-02-27T09:15:30.000Z"),
        new Date("2026-02-27T09:15:30.000Z"),
      );
      await utimes(
        noonPath,
        new Date("2026-02-27T12:00:00.000Z"),
        new Date("2026-02-27T12:00:00.000Z"),
      );
      await utimes(
        midnightPath,
        new Date("2026-02-27T00:00:00.000Z"),
        new Date("2026-02-27T00:00:00.000Z"),
      );

      const morning = await planSingleRename(runtime, toRepoRelativePath(morningPath), {
        pattern: "{timestamp_utc_12h}-{stem}",
      });
      const noon = await planSingleRename(runtime, toRepoRelativePath(noonPath), {
        pattern: "{timestamp_utc_12h}-{stem}",
      });
      const midnight = await planSingleRename(runtime, toRepoRelativePath(midnightPath), {
        pattern: "{timestamp_utc_12h}-{stem}",
      });

      expect(basename(morning.plan.toPath)).toBe("20260227-091530AM-morning.txt");
      expect(basename(noon.plan.toPath)).toBe("20260227-120000PM-noon.txt");
      expect(basename(midnight.plan.toPath)).toBe("20260227-120000AM-midnight.txt");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
