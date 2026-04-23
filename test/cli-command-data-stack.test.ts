import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { runCli, toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

describe("CLI data stack command", () => {
  test("stacks matching-header CSV fixtures end to end", async () => {
    await withTempFixtureDir("data-stack-cli", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "merged.csv");

      const result = runCli([
        "data",
        "stack",
        "examples/playground/stack-cases/csv-matching-headers",
        "--pattern",
        "*.csv",
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(result.stderr).toContain("Files: 3");
      expect(result.stderr).toContain("Rows: 6");
      expect(await readFile(outputPath, "utf8")).toBe(
        "id,name,status\n1001,Ada,active\n1002,Bao,paused\n1003,Cora,active\n1004,Dion,active\n1005,Edda,paused\n1006,Finn,active\n",
      );
    });
  });

  test("honors --input-format for extensionless directory matches", async () => {
    await withTempFixtureDir("data-stack-cli-override", async (fixtureDir) => {
      const sourceDir = join(fixtureDir, "parts");
      const outputPath = join(fixtureDir, "merged.csv");
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(sourceDir, "part-a.data"), "id,name\n1,Ada\n", "utf8");
      await writeFile(join(sourceDir, "part-b.data"), "id,name\n2,Bob\n", "utf8");

      const result = runCli([
        "data",
        "stack",
        toRepoRelativePath(sourceDir),
        "--pattern",
        "*.data",
        "--input-format",
        "csv",
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(await readFile(outputPath, "utf8")).toBe("id,name\n1,Ada\n2,Bob\n");
    });
  });

  test("respects shallow-by-default traversal and opt-in recursion", async () => {
    await withTempFixtureDir("data-stack-cli-depth", async (fixtureDir) => {
      const sourceDir = join(fixtureDir, "tree");
      const shallowOutputPath = join(fixtureDir, "shallow.csv");
      const recursiveOutputPath = join(fixtureDir, "recursive.csv");
      await mkdir(join(sourceDir, "nested"), { recursive: true });
      await writeFile(join(sourceDir, "top.csv"), "id,name\n1,Ada\n", "utf8");
      await writeFile(join(sourceDir, "nested", "inner.csv"), "id,name\n2,Bob\n", "utf8");

      const shallow = runCli([
        "data",
        "stack",
        toRepoRelativePath(sourceDir),
        "--output",
        toRepoRelativePath(shallowOutputPath),
        "--overwrite",
      ]);
      const recursive = runCli([
        "data",
        "stack",
        toRepoRelativePath(sourceDir),
        "--recursive",
        "--output",
        toRepoRelativePath(recursiveOutputPath),
        "--overwrite",
      ]);

      expect(shallow.exitCode).toBe(0);
      expect(recursive.exitCode).toBe(0);
      expect(await readFile(shallowOutputPath, "utf8")).toBe("id,name\n1,Ada\n");
      expect(await readFile(recursiveOutputPath, "utf8")).toBe("id,name\n2,Bob\n1,Ada\n");
    });
  });

  test("rejects --max-depth without --recursive", async () => {
    const result = runCli([
      "data",
      "stack",
      "examples/playground/stack-cases/csv-matching-headers",
      "--max-depth",
      "1",
      "--output",
      "examples/playground/.tmp-tests/invalid.csv",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("--max-depth requires --recursive");
  });
});
