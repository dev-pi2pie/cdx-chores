import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { runCli, toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

describe("cli command: rename cleanup", () => {
  test("accepts --hints as an alias for --hint", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const filePath = join(fixtureDir, "Screenshot 2026-03-02 at 4.53.04 PM.png");
      await writeFile(filePath, "fake", "utf8");

      const result = runCli([
        "rename",
        "cleanup",
        toRepoRelativePath(filePath),
        "--hints",
        "timestamp",
        "--dry-run",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Plan CSV:");
      expect(result.stdout).toContain("Screenshot 20260302-165304.png");
    });
  });

  test("rejects removed uid style", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const filePath = join(fixtureDir, "report uid-7k3m9q2x4t final.txt");
      await writeFile(filePath, "fake", "utf8");

      const result = runCli([
        "rename",
        "cleanup",
        toRepoRelativePath(filePath),
        "--hint",
        "uid",
        "--style",
        "uid",
        "--dry-run",
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("--style must be one of: preserve, slug.");
    });
  });

  test("rejects unsupported conflict strategy", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const filePath = join(fixtureDir, "Screenshot 2026-03-02 at 4.53.04 PM.png");
      await writeFile(filePath, "fake", "utf8");

      const result = runCli([
        "rename",
        "cleanup",
        toRepoRelativePath(filePath),
        "--hint",
        "timestamp",
        "--conflict-strategy",
        "suffix",
        "--dry-run",
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        "--conflict-strategy must be one of: skip, number, uid-suffix.",
      );
    });
  });
});
