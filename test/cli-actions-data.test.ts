import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { readFile, rm, writeFile } from "node:fs/promises";

import { actionCsvToJson, actionJsonToCsv } from "../src/cli/actions";
import { createTempFixtureDir, toRepoRelativePath } from "./helpers/cli-test-utils";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";

describe("cli action modules: data", () => {
  test("actionJsonToCsv writes CSV and reports relative output path", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    try {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      const inputPath = join(fixtureDir, "rows.json");
      await writeFile(inputPath, '[{"name":"Ada","age":36}]\n', "utf8");

      const relativeInput = toRepoRelativePath(inputPath);
      await actionJsonToCsv(runtime, { input: relativeInput, overwrite: true });

      const outputPath = inputPath.replace(/\.json$/i, ".csv");
      const csv = await readFile(outputPath, "utf8");

      expectNoStderr();
      expect(stdout.text).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(stdout.text).toContain("Rows: 1");
      expect(csv).toContain("name,age");
      expect(csv).toContain("Ada,36");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionCsvToJson writes pretty JSON when requested", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    try {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      const inputPath = join(fixtureDir, "rows.csv");
      const outputPath = join(fixtureDir, "custom.json");
      await writeFile(inputPath, "name,age\nAda,36\nBob,28\n", "utf8");

      const relativeInput = toRepoRelativePath(inputPath);
      const relativeOutput = toRepoRelativePath(outputPath);

      await actionCsvToJson(runtime, {
        input: relativeInput,
        output: relativeOutput,
        pretty: true,
        overwrite: true,
      });

      const json = await readFile(outputPath, "utf8");
      expectNoStderr();
      expect(stdout.text).toContain(`Wrote JSON: ${relativeOutput}`);
      expect(stdout.text).toContain("Rows: 2");
      expect(json).toContain("\n  {");
      expect(JSON.parse(json)).toEqual([
        { name: "Ada", age: "36" },
        { name: "Bob", age: "28" },
      ]);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});

describe("cli action modules: data failure modes", () => {
  test("actionJsonToCsv rejects invalid JSON input", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    try {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const inputPath = join(fixtureDir, "invalid.json");
      await writeFile(inputPath, '{"name": "Ada"\n', "utf8");

      const relativeInput = toRepoRelativePath(inputPath);
      await expectCliError(
        () => actionJsonToCsv(runtime, { input: relativeInput }),
        { code: "INVALID_JSON", exitCode: 2, messageIncludes: "Invalid JSON:" },
      );

      expectNoOutput();
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionCsvToJson rejects missing input file", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    try {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const missingPath = join(fixtureDir, "missing.csv");

      await expectCliError(
        () => actionCsvToJson(runtime, { input: toRepoRelativePath(missingPath) }),
        { code: "FILE_NOT_FOUND", exitCode: 2, messageIncludes: "Input file not found:" },
      );

      expectNoOutput();
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionJsonToCsv rejects existing output file when overwrite is false", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    try {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const inputPath = join(fixtureDir, "rows.json");
      const outputPath = join(fixtureDir, "rows.csv");
      await writeFile(inputPath, '[{"name":"Ada"}]\n', "utf8");
      await writeFile(outputPath, "name\nExisting\n", "utf8");

      await expectCliError(
        () => actionJsonToCsv(runtime, { input: toRepoRelativePath(inputPath), overwrite: false }),
        { code: "OUTPUT_EXISTS", exitCode: 2, messageIncludes: "Output file already exists:" },
      );

      const preserved = await readFile(outputPath, "utf8");
      expect(preserved).toBe("name\nExisting\n");
      expectNoOutput();
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
