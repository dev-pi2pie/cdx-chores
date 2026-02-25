import { describe, expect, test } from "bun:test";
import { mkdir, readFile, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionCsvToJson, actionJsonToCsv, actionRenameApply, actionRenameBatch } from "../src/cli/actions";
import { CliError } from "../src/cli/errors";
import { createCapturedRuntime, createTempFixtureDir, REPO_ROOT, toRepoRelativePath } from "./helpers/cli-test-utils";

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

async function removeIfPresent(path: string | undefined): Promise<void> {
  if (!path) {
    return;
  }
  await rm(path, { force: true });
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
    let planCsvPath: string | undefined;
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
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(result.totalCount).toBe(1);
      expect(result.changedCount).toBe(1);
      expect(result.planCsvPath).toBeDefined();
      expect(stdout.text).toContain(`Directory: ${relativeDir}`);
      expect(stdout.text).toContain("Files found: 1");
      expect(stdout.text).toContain("Files to rename: 1");
      expect(stdout.text).toContain("Plan CSV:");
      expect(stdout.text).toContain("Dry run only. No files were renamed.");
      expect(stdout.text).toContain("photo one.txt ->");

      const after = await stat(filePath);
      expect(after.isFile()).toBe(true);
    } finally {
      await removeIfPresent(planCsvPath);
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
    let planCsvPath: string | undefined;
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
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(result.totalCount).toBe(0);
      expect(result.changedCount).toBe(0);
      expect(result.planCsvPath).toBeDefined();
      expect(stdout.text).toContain(`Directory: ${relativeDir}`);
      expect(stdout.text).toContain("Files found: 0");
      expect(stdout.text).toContain("Files to rename: 0");
      expect(stdout.text).toContain("Dry run only. No files were renamed.");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch scopes files with regex and extension filters", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-scope-filters");
      await mkdir(dirPath, { recursive: true });

      await writeFile(join(dirPath, "keep-photo.JPG"), "1", "utf8");
      await writeFile(join(dirPath, "skip-photo.png"), "2", "utf8");
      await writeFile(join(dirPath, "other.jpg"), "3", "utf8");
      await writeFile(join(dirPath, "notes.txt"), "4", "utf8");

      const result = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        prefix: "img",
        dryRun: true,
        matchRegex: "photo",
        skipRegex: "^skip",
        ext: ["jpg", "png"],
        skipExt: ["png"],
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(result.totalCount).toBe(1);
      expect(result.changedCount).toBe(1);
      expect(stdout.text).toContain("Files found: 1");
      expect(stdout.text).toContain("keep-photo.JPG -> img-");
      expect(stdout.text).not.toContain("skip-photo.png");
      expect(stdout.text).not.toContain("other.jpg");
      expect(stdout.text).not.toContain("notes.txt");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch rejects invalid regex scope filters", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-invalid-regex");
      await mkdir(dirPath, { recursive: true });

      await expectCliError(
        () =>
          actionRenameBatch(runtime, {
            directory: toRepoRelativePath(dirPath),
            dryRun: true,
            matchRegex: "(",
          }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "Invalid --match-regex:" },
      );

      expect(stdout.text).toBe("");
      expect(stderr.text).toBe("");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch codex mode shows progress and fallback messaging when Codex returns an error", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-codex-fallback");
      await mkdir(dirPath, { recursive: true });

      const imagePath = join(dirPath, "a.png");
      await writeFile(imagePath, "fakepng", "utf8");
      const fixedTime = new Date("2026-02-25T03:04:05.000Z");
      await utimes(imagePath, fixedTime, fixedTime);

      const relativeDir = toRepoRelativePath(dirPath);
      const result = await actionRenameBatch(runtime, {
        directory: relativeDir,
        prefix: "img",
        dryRun: true,
        codex: true,
        codexTitleSuggester: async () => ({
          suggestions: [],
          errorMessage: "Codex unavailable in test",
        }),
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(result.totalCount).toBe(1);
      expect(result.changedCount).toBe(1);
      expect(stdout.text).toContain("Codex: analyzing 1 image file(s)...");
      expect(stdout.text).toContain("Codex image titles: 0/1 image file(s) suggested (fallback used for others)");
      expect(stdout.text).toContain("Codex note: Codex unavailable in test");
      expect(stdout.text).toContain("- a.png -> img-");
      expect(stdout.text).toContain("Dry run only. No files were renamed.");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch forwards Codex tuning options to the suggester", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-codex-options");
      await mkdir(dirPath, { recursive: true });

      const imageA = join(dirPath, "a.png");
      const imageB = join(dirPath, "b.png");
      await writeFile(imageA, "fakepng", "utf8");
      await writeFile(imageB, "fakepng", "utf8");

      const calls: Array<{
        imagePaths: string[];
        workingDirectory: string;
        timeoutMs?: number;
        retries?: number;
        batchSize?: number;
      }> = [];

      const result = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        dryRun: true,
        codex: true,
        codexTimeoutMs: 12345,
        codexRetries: 2,
        codexBatchSize: 1,
        codexTitleSuggester: async (options) => {
          calls.push(options);
          return { suggestions: [] };
        },
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(calls).toHaveLength(1);
      expect(calls[0]?.workingDirectory).toBe(REPO_ROOT);
      expect(calls[0]?.timeoutMs).toBe(12345);
      expect(calls[0]?.retries).toBe(2);
      expect(calls[0]?.batchSize).toBe(1);
      expect(calls[0]?.imagePaths).toHaveLength(2);
      expect(stdout.text).toContain("Codex image titles:");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch skips Codex assist for non-static or oversized images but still renames them", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-codex-skip-ineligible");
      await mkdir(dirPath, { recursive: true });

      const gifPath = join(dirPath, "animated.gif");
      const largePngPath = join(dirPath, "large.png");
      const okPngPath = join(dirPath, "ok.png");

      await writeFile(gifPath, "fakegif", "utf8");
      await writeFile(largePngPath, Buffer.alloc(21 * 1024 * 1024));
      await writeFile(okPngPath, "fakepng", "utf8");

      const calls: Array<{ imagePaths: string[] }> = [];
      const result = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        prefix: "img",
        dryRun: true,
        codex: true,
        codexTitleSuggester: async (options) => {
          calls.push({ imagePaths: options.imagePaths });
          return {
            suggestions: options.imagePaths.map((path) => ({ path, title: "only eligible image" })),
          };
        },
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(result.totalCount).toBe(3);
      expect(result.changedCount).toBe(3);
      expect(calls).toHaveLength(1);
      expect(calls[0]?.imagePaths).toHaveLength(1);
      expect(calls[0]?.imagePaths[0]?.endsWith("/ok.png")).toBe(true);
      expect(stdout.text).toContain("Codex image titles: 1/1 image file(s) suggested");
      expect(stdout.text).toContain("- animated.gif -> img-");
      expect(stdout.text).toContain("- large.png -> img-");
      expect(stdout.text).toContain("- ok.png -> img-");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch dry-run writes a replayable CSV plan under cwd", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-plan-csv");
      await mkdir(dirPath, { recursive: true });

      const filePath = join(dirPath, "sample image.png");
      await writeFile(filePath, "fake", "utf8");
      const fixedTime = new Date("2026-02-25T10:11:12.000Z");
      await utimes(filePath, fixedTime, fixedTime);

      const result = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        prefix: "img",
        dryRun: true,
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(planCsvPath).toBeDefined();
      expect(planCsvPath?.startsWith(REPO_ROOT)).toBe(true);
      expect(planCsvPath).toMatch(/rename-\d{8}-\d{6}-[a-f0-9]{8}\.csv$/);

      const csvText = await readFile(planCsvPath!, "utf8");
      expect(csvText).toContain("old_name,new_name,cleaned_stem,ai_new_name,ai_provider,ai_model,changed_at,old_path,new_path,plan_id,planned_at,applied_at,status,reason");
      expect(csvText).toContain("sample image.png");
      expect(csvText).toContain(",planned,");
      expect(stdout.text).toContain(`Plan CSV: ${toRepoRelativePath(planCsvPath!)}`);
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameApply replays the dry-run CSV snapshot exactly", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-replay");
      await mkdir(dirPath, { recursive: true });

      const originalPath = join(dirPath, "zeta image.png");
      await writeFile(originalPath, "fake", "utf8");
      const fixedTime = new Date("2026-02-25T01:02:03.000Z");
      await utimes(originalPath, fixedTime, fixedTime);

      const dryRunResult = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        prefix: "img",
        dryRun: true,
      });
      planCsvPath = dryRunResult.planCsvPath;
      expect(planCsvPath).toBeDefined();

      const planBeforeApply = await readFile(planCsvPath!, "utf8");
      const rowLine = planBeforeApply.split("\n").find((line) => line.includes("zeta image.png")) ?? "";
      expect(rowLine).not.toBe("");
      const csvCells = rowLine.split(",");
      const newName = csvCells[1] ?? "";
      expect(newName).toMatch(/^img-\d{8}-\d{6}-zeta-image\.png$/);

      // Change mtime after dry-run to ensure apply uses the CSV snapshot instead of recomputing.
      const changedTime = new Date("2026-02-25T23:59:59.000Z");
      await utimes(originalPath, changedTime, changedTime);

      const applyResult = await actionRenameApply(runtime, { csv: planCsvPath! });

      expect(stderr.text).toBe("");
      expect(applyResult.appliedCount).toBe(1);
      expect(stdout.text).toContain(`Plan CSV: ${toRepoRelativePath(planCsvPath!)}`);
      expect(stdout.text).toContain("Rows applied: 1");

      const entries = await readdir(dirPath);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toBe(newName);

      const planAfterApply = await readFile(planCsvPath!, "utf8");
      expect(planAfterApply).toContain(",applied,");
      expect(planAfterApply).not.toContain(",planned,");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
