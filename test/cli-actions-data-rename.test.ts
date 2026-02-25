import { describe, expect, test } from "bun:test";
import { mkdir, readFile, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionCsvToJson, actionJsonToCsv, actionRenameBatch } from "../src/cli/actions";
import { CliError } from "../src/cli/errors";
import { createCapturedRuntime, createTempFixtureDir, toRepoRelativePath } from "./helpers/cli-test-utils";

async function expectCliError(
  run: () => Promise<unknown>,
  expected: { code: string; exitCode?: number; messageIncludes?: string },
): Promise<CliError> {
  try {
    await run();
  } catch (error) {
    expect(error).toBeInstanceOf(CliError);
    const cliError = error as CliError;
    expect(cliError.code).toBe(expected.code);
    if (expected.exitCode !== undefined) {
      expect(cliError.exitCode).toBe(expected.exitCode);
    }
    if (expected.messageIncludes) {
      expect(cliError.message).toContain(expected.messageIncludes);
    }
    return cliError;
  }

  throw new Error("Expected CliError but action resolved successfully");
}

describe("cli action modules: data", () => {
  test("actionJsonToCsv writes CSV and reports relative output path", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const inputPath = join(fixtureDir, "rows.json");
      await writeFile(inputPath, '[{"name":"Ada","age":36}]\n', "utf8");

      const relativeInput = toRepoRelativePath(inputPath);
      await actionJsonToCsv(runtime, { input: relativeInput, overwrite: true });

      const outputPath = inputPath.replace(/\.json$/i, ".csv");
      const csv = await readFile(outputPath, "utf8");

      expect(stderr.text).toBe("");
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
      const { runtime, stdout, stderr } = createCapturedRuntime();
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
      expect(stderr.text).toBe("");
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
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const inputPath = join(fixtureDir, "invalid.json");
      await writeFile(inputPath, '{"name": "Ada"\n', "utf8");

      const relativeInput = toRepoRelativePath(inputPath);
      await expectCliError(
        () => actionJsonToCsv(runtime, { input: relativeInput }),
        { code: "INVALID_JSON", exitCode: 2, messageIncludes: "Invalid JSON:" },
      );

      expect(stdout.text).toBe("");
      expect(stderr.text).toBe("");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionCsvToJson rejects missing input file", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const missingPath = join(fixtureDir, "missing.csv");

      await expectCliError(
        () => actionCsvToJson(runtime, { input: toRepoRelativePath(missingPath) }),
        { code: "FILE_NOT_FOUND", exitCode: 2, messageIncludes: "Input file not found:" },
      );

      expect(stdout.text).toBe("");
      expect(stderr.text).toBe("");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionJsonToCsv rejects existing output file when overwrite is false", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
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
      expect(stdout.text).toBe("");
      expect(stderr.text).toBe("");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});

describe("cli action modules: rename", () => {
  test("actionRenameBatch dry-run previews renames and returns counts", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
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

      expect(stderr.text).toBe("");
      expect(result.totalCount).toBe(1);
      expect(result.changedCount).toBe(1);
      expect(stdout.text).toContain(`Directory: ${relativeDir}`);
      expect(stdout.text).toContain("Files found: 1");
      expect(stdout.text).toContain("Files to rename: 1");
      expect(stdout.text).toContain("Dry run only. No files were renamed.");
      expect(stdout.text).toContain("photo one.txt ->");

      const after = await stat(filePath);
      expect(after.isFile()).toBe(true);
    } finally {
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

      const entries = await readdir(dirPath);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatch(/^doc-\d{8}-\d{6}-draft-note\.md$/);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch handles an empty directory", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
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

      expect(stderr.text).toBe("");
      expect(result.totalCount).toBe(0);
      expect(result.changedCount).toBe(0);
      expect(stdout.text).toContain(`Directory: ${relativeDir}`);
      expect(stdout.text).toContain("Files found: 0");
      expect(stdout.text).toContain("Files to rename: 0");
      expect(stdout.text).toContain("Dry run only. No files were renamed.");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
