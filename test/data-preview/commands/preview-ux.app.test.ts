import { describe, expect, test } from "bun:test";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createTempFixtureDir, runCli, toRepoRelativePath } from "../../helpers/cli-test-utils";

describe("data preview command UX", () => {
  test("data preview renders relative input paths by default", async () => {
    const fixtureDir = await createTempFixtureDir("cli-ux");
    try {
      const inputPath = join(fixtureDir, "sample.csv");
      await writeFile(inputPath, "name,age\nAda,36\n", "utf8");

      const relativeInputPath = toRepoRelativePath(inputPath);
      const result = runCli(["data", "preview", relativeInputPath]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain(`Input: ${relativeInputPath}`);
      expect(result.stdout).toContain("Format: csv");
      expect(result.stdout).toContain("name | age");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("data preview help documents window, column, contains, and no-header options", () => {
    const result = runCli(["data", "preview", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Input CSV, TSV, or JSON file");
    expect(result.stdout).toContain("--no-header");
    expect(result.stdout).toContain("--rows <value>");
    expect(result.stdout).toContain("--offset <value>");
    expect(result.stdout).toContain("--columns <names>");
    expect(result.stdout).toContain("--contains <column:keyword>");
  });

  test("data preview honors --no-header end to end for CSV input", async () => {
    const fixtureDir = await createTempFixtureDir("cli-ux");
    try {
      const inputPath = join(fixtureDir, "headerless.csv");
      await writeFile(inputPath, "1,Ada,active\n2,Bob,paused\n3,Cyd,draft\n", "utf8");

      const relativeInputPath = toRepoRelativePath(inputPath);
      const result = runCli(["data", "preview", relativeInputPath, "--no-header"]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Rows: 3");
      expect(result.stdout).toContain("Visible columns: column_1, column_2, column_3");
      expect(result.stdout).toContain("column_1 | column_2 | column_3");
      expect(result.stdout).toContain("1        | Ada      | active");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("data preview rejects invalid row counts at CLI parsing time", async () => {
    const fixtureDir = await createTempFixtureDir("cli-ux");
    try {
      const inputPath = join(fixtureDir, "sample.csv");
      await writeFile(inputPath, "name,age\nAda,36\n", "utf8");

      const result = runCli(["data", "preview", toRepoRelativePath(inputPath), "--rows", "0"]);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("--rows must be a positive integer.");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("data preview reports malformed contains filters through the CLI error contract", async () => {
    const fixtureDir = await createTempFixtureDir("cli-ux");
    try {
      const inputPath = join(fixtureDir, "sample.csv");
      await writeFile(inputPath, "name,age\nAda,36\n", "utf8");

      const result = runCli([
        "data",
        "preview",
        toRepoRelativePath(inputPath),
        "--contains",
        "name",
      ]);

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("Invalid --contains value");
      expect(result.stderr).toContain("missing ':' separator");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
