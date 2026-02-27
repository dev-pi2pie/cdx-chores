import { describe, expect, test } from "bun:test";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { EMBEDDED_PACKAGE_VERSION } from "../src/cli/program/version-embedded";
import { createTempFixtureDir, runCli, toRepoRelativePath } from "./helpers/cli-test-utils";

describe("CLI UX flags and path output", () => {
  test("supports both -v and -V for version output", () => {
    const lower = runCli(["-v"]);
    const upper = runCli(["-V"]);

    expect(lower.exitCode).toBe(0);
    expect(upper.exitCode).toBe(0);
    expect(lower.stderr).toBe("");
    expect(upper.stderr).toBe("");
    expect(lower.stdout).toContain("cdx-chores");
    expect(upper.stdout).toContain("cdx-chores");
    expect(lower.stdout).toContain(`ver.${EMBEDDED_PACKAGE_VERSION}`);
    expect(upper.stdout).toContain(`ver.${EMBEDDED_PACKAGE_VERSION}`);
  });

  test("prints relative output paths by default", async () => {
    const fixtureDir = await createTempFixtureDir("cli-ux");
    try {
      const inputPath = join(fixtureDir, "sample.json");
      await writeFile(inputPath, '[{"a":1}]\n', "utf8");

      const relativeInputPath = toRepoRelativePath(inputPath);
      const expectedRelativeOutputPath = join(relativeInputPath.replace(/\.json$/i, ".csv"));

      const result = runCli(["data", "json-to-csv", "-i", relativeInputPath, "--overwrite"]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain(`Wrote CSV: ${expectedRelativeOutputPath}`);
      expect(result.stdout).toContain("Rows: 1");

      const outputPath = inputPath.replace(/\.json$/i, ".csv");
      const csv = await readFile(outputPath, "utf8");
      expect(csv).toContain("a");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("prints absolute output paths with --abs alias (even after subcommand args)", async () => {
    const fixtureDir = await createTempFixtureDir("cli-ux");
    try {
      const inputPath = join(fixtureDir, "sample.json");
      await writeFile(inputPath, '[{"a":1}]\n', "utf8");

      const relativeInputPath = toRepoRelativePath(inputPath);
      const absoluteOutputPath = inputPath.replace(/\.json$/i, ".csv");

      const result = runCli([
        "data",
        "json-to-csv",
        "-i",
        relativeInputPath,
        "--overwrite",
        "--abs",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain(`Wrote CSV: ${absoluteOutputPath}`);
      expect(result.stdout).toContain("Rows: 1");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("rename help includes template and serial controls", () => {
    const result = runCli(["rename", "batch", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("--pattern <template>");
    expect(result.stdout).toContain("--serial-order <value>");
    expect(result.stdout).toContain("--serial-start <value>");
    expect(result.stdout).toContain("--serial-width <value>");
    expect(result.stdout).toContain("--serial-scope <value>");
  });

  test("rename rejects unsupported serial order alias values", () => {
    const result = runCli(["rename", "file", "dummy.txt", "--serial-order", "time_asc"]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("--serial-order must be one of: path_asc, path_desc, mtime_asc, mtime_desc.");
  });
});
