import { describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

  test("root help omits deferred docx and pdf command families", () => {
    const result = runCli(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain("docx");
    expect(result.stdout).not.toContain("pdf");
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

  test("data parquet preview renders relative input paths by default", () => {
    const result = runCli(["data", "parquet", "preview", "test/fixtures/parquet-preview/basic.parquet"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Input: test/fixtures/parquet-preview/basic.parquet");
    expect(result.stdout).toContain("Format: parquet");
    expect(result.stdout).toContain("name");
  });

  test("data help reflects preview plus conversion workflows", () => {
    const result = runCli(["data", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Data preview, extract, query, and conversion utilities");
    expect(result.stdout).toContain("json-to-csv");
    expect(result.stdout).toContain("json-to-tsv");
    expect(result.stdout).toContain("csv-to-json");
    expect(result.stdout).toContain("csv-to-tsv");
    expect(result.stdout).toContain("tsv-to-csv");
    expect(result.stdout).toContain("tsv-to-json");
    expect(result.stdout).toContain("extract");
    expect(result.stdout).toContain("preview");
    expect(result.stdout).toContain("parquet");
    expect(result.stdout).toContain("query");
  });

  test("data csv-to-tsv help does not expose JSON-only pretty printing", () => {
    const result = runCli(["data", "csv-to-tsv", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain("--pretty");
    expect(result.stdout).toContain("Input CSV file");
  });

  test("data tsv-to-json help exposes pretty printing for JSON output", () => {
    const result = runCli(["data", "tsv-to-json", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("--pretty");
    expect(result.stdout).toContain("Input TSV file");
  });

  test("data query help documents SQL, shaping, header review, source, and output options", () => {
    const result = runCli(["data", "query", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("--sql <query>");
    expect(result.stdout).toContain("--input-format <format>");
    expect(result.stdout).toContain("--source <name>");
    expect(result.stdout).toContain("--range <A1:Z99>");
    expect(result.stdout).toContain("--body-start-row <value>");
    expect(result.stdout).toContain("--header-row <value>");
    expect(result.stdout).toContain("--header-mapping <path>");
    expect(result.stdout).toContain("--codex-suggest-headers");
    expect(result.stdout).toContain("--write-header-mapping <path>");
    expect(result.stdout).toContain("--rows <value>");
    expect(result.stdout).toContain("--json");
    expect(result.stdout).toContain("--pretty");
    expect(result.stdout).toContain("--output <path>");
    expect(result.stdout).toContain("codex");
  });

  test("data extract help documents shaping, reviewed header suggestions, and output options", () => {
    const result = runCli(["data", "extract", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("--input-format <format>");
    expect(result.stdout).toContain("--source <name>");
    expect(result.stdout).toContain("--range <A1:Z99>");
    expect(result.stdout).toContain("--body-start-row <value>");
    expect(result.stdout).toContain("--header-row <value>");
    expect(result.stdout).toContain("--source-shape <path>");
    expect(result.stdout).toContain("--codex-suggest-shape");
    expect(result.stdout).toContain("--write-source-shape <path>");
    expect(result.stdout).toContain("--header-mapping <path>");
    expect(result.stdout).toContain("--codex-suggest-headers");
    expect(result.stdout).toContain("--write-header-mapping <path>");
    expect(result.stdout).toContain("--output <path>");
    expect(result.stdout).toContain("--overwrite");
    expect(result.stdout).not.toContain("--sql");
  });

  test("data query rejects invalid input-format values at CLI parsing time", () => {
    const result = runCli(["data", "query", "sample.csv", "--sql", "select * from file", "--input-format", "json"]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("--input-format must be one of:");
  });

  test("data extract rejects invalid input-format values at CLI parsing time", () => {
    const result = runCli(["data", "extract", "sample.csv", "--output", "sample.json", "--input-format", "json"]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("--input-format must be one of:");
  });

  test("data query codex help documents intent, shaping, and print-sql options", () => {
    const result = runCli(["data", "query", "codex", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("--intent <text>");
    expect(result.stdout).toContain("--input-format <format>");
    expect(result.stdout).toContain("--source <name>");
    expect(result.stdout).toContain("--range <A1:Z99>");
    expect(result.stdout).toContain("--body-start-row <value>");
    expect(result.stdout).toContain("--header-row <value>");
    expect(result.stdout).toContain("--print-sql");
  });

  test("data query codex rejects invalid input-format values at CLI parsing time", () => {
    const result = runCli([
      "data",
      "query",
      "codex",
      "sample.csv",
      "--intent",
      "show rows",
      "--input-format",
      "json",
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("--input-format must be one of:");
  });

  test("data parquet preview help documents supported bounded-preview options only", () => {
    const result = runCli(["data", "parquet", "preview", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("--rows <value>");
    expect(result.stdout).toContain("--offset <value>");
    expect(result.stdout).toContain("--columns <names>");
    expect(result.stdout).not.toContain("--contains");
  });

  test("data parquet preview rejects unsupported contains filtering at CLI parsing time", () => {
    const result = runCli([
      "data",
      "parquet",
      "preview",
      "test/fixtures/parquet-preview/basic.parquet",
      "--contains",
      "status:active",
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("unknown option '--contains'");
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

      const result = runCli(["data", "preview", toRepoRelativePath(inputPath), "--contains", "name"]);

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("Invalid --contains value");
      expect(result.stderr).toContain("missing ':' separator");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("rename help includes template and serial controls", () => {
    const result = runCli(["rename", "batch", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("--pattern <template>");
    expect(result.stdout).toContain("{uid}");
    expect(result.stdout).toContain("--prefix <value>");
    expect(result.stdout).toContain("Filename prefix (optional)");
    expect(result.stdout).toContain("--codex");
    expect(result.stdout).toContain("Auto-route eligible files to Codex");
    expect(result.stdout).toContain("--preview-skips <mode>");
    expect(result.stdout).toContain("Skipped-item preview mode: summary or");
    expect(result.stdout).toContain("detailed");
    expect(result.stdout).toContain("--serial-order <value>");
    expect(result.stdout).toContain("--serial-start <value>");
    expect(result.stdout).toContain("--serial-width <value>");
    expect(result.stdout).toContain("--serial-scope <value>");
  });

  test("video resize help documents scale-first and explicit-dimension modes", () => {
    const result = runCli(["video", "resize", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("-s, --scale <factor>");
    expect(result.stdout).toContain("Scale factor multiplier");
    expect(result.stdout).toContain("--width <px>");
    expect(result.stdout).toContain("--height <px>");
    expect(result.stdout).toContain("Preferred: --scale 0.5");
    expect(result.stdout).toContain("Explicit override: --width 1280 --height 720");
  });

  test("video resize accepts scale-only flags and reaches input validation", () => {
    const result = runCli(["video", "resize", "-i", "missing.mp4", "-o", "out.mp4", "--scale", "0.5"]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Input file not found:");
  });

  test("video resize rejects incomplete explicit dimensions with a clear error", () => {
    const result = runCli(["video", "resize", "-i", "missing.mp4", "-o", "out.mp4", "--width", "640"]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Width and height must be provided together.");
  });

  test("rename rejects unsupported serial order alias values", () => {
    const result = runCli(["rename", "file", "dummy.txt", "--serial-order", "time_asc"]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("--serial-order must be one of: path_asc, path_desc, mtime_asc, mtime_desc.");
  });

  test("rename batch honors embedded serial start when no CLI override is provided", async () => {
    const fixtureDir = await createTempFixtureDir("cli-ux");
    try {
      const dirPath = join(fixtureDir, "serial-pattern-start");
      await mkdir(dirPath, { recursive: true });
      await writeFile(join(dirPath, "new-hello.txt"), "hello\n", "utf8");
      await writeFile(join(dirPath, "new-hi.txt"), "hi\n", "utf8");
      await writeFile(join(dirPath, "new-hoho.txt"), "hoho\n", "utf8");

      const result = runCli([
        "rename",
        "batch",
        toRepoRelativePath(dirPath),
        "--pattern",
        "{stem}-{serial_start_3}",
        "--dry-run",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("new-hello.txt -> new-hello-3.txt");
      expect(result.stdout).toContain("new-hi.txt -> new-hi-4.txt");
      expect(result.stdout).toContain("new-hoho.txt -> new-hoho-5.txt");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
