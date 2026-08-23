import { describe, expect, test } from "bun:test";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createTempFixtureDir, runCli, toRepoRelativePath } from "../../helpers/cli-test-utils";

describe("data conversion command output paths", () => {
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
});
