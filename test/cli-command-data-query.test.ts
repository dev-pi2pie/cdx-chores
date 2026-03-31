import { chmod, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { inspectDataQueryExtensions } from "../src/cli/duckdb/query";
import { seedDataExtractFixtures } from "./helpers/data-extract-fixture-test-utils";
import { seedStackedMergedBandFixture } from "./helpers/stacked-merged-band-fixture-test-utils";
import {
  REPO_ROOT,
  runCli,
  toRepoRelativePath,
  withTempFixtureDir,
} from "./helpers/cli-test-utils";

const queryExtensions = await inspectDataQueryExtensions();
const sqliteReady = queryExtensions.available && queryExtensions.sqlite?.loadable === true;
const excelReady = queryExtensions.available && queryExtensions.excel?.loadable === true;

function fixturePath(name: string): string {
  return join("test", "fixtures", "data-query", name);
}

async function createHeaderSuggestionStub(options: {
  promptPath?: string;
  suggestions: Array<{ from: string; to: string }>;
  workingDirectory: string;
}): Promise<string> {
  const stubPath = join(options.workingDirectory, "header-suggest-stub.mjs");
  const promptWrite = options.promptPath
    ? `await writeFile(${JSON.stringify(options.promptPath)}, prompt, "utf8");`
    : "";
  const script = `#!/usr/bin/env node
import { writeFile } from "node:fs/promises";

const prompt = await new Promise((resolve, reject) => {
  let text = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    text += chunk;
  });
  process.stdin.on("end", () => resolve(text));
  process.stdin.on("error", reject);
});

${promptWrite}

const response = JSON.stringify({
  suggestions: ${JSON.stringify(options.suggestions)},
});

process.stdout.write(JSON.stringify({ type: "thread.started", thread_id: "stub-thread" }) + "\\n");
process.stdout.write(JSON.stringify({ type: "turn.started" }) + "\\n");
process.stdout.write(JSON.stringify({
  type: "item.completed",
  item: { id: "msg-1", type: "agent_message", text: response },
}) + "\\n");
process.stdout.write(JSON.stringify({
  type: "turn.completed",
  usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1 },
}) + "\\n");
`;

  await writeFile(stubPath, script, "utf8");
  await chmod(stubPath, 0o755);
  return stubPath;
}

describe("CLI data query command", () => {
  test("queries CSV input end to end", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("basic.csv"),
      "--sql",
      "select id, name from file order by id",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Format: csv");
    expect(result.stdout).toContain("1   | Ada");
    expect(result.stdout).toContain("3   | Cyd");
  });

  test("queries TSV input end to end", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("basic.tsv"),
      "--sql",
      "select name, status from file order by id",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Format: tsv");
    expect(result.stdout).toContain("Ada  | active");
  });

  test("queries headerless CSV input end to end with normalized placeholder names", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "no-head.csv");
      await writeFile(inputPath, "1,Ada,active,2026-03-01\n2,Bob,paused,2026-03-02\n", "utf8");

      const result = runCli([
        "data",
        "query",
        inputPath.slice(REPO_ROOT.length + 1),
        "--sql",
        "select column_1, column_2, column_3, column_4 from file order by column_1",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Visible columns: column_1, column_2, column_3, column_4");
      expect(result.stdout).toContain("Ada");
      expect(result.stdout).not.toContain("column0");
      expect(result.stdout).not.toContain("column1");
    });
  });

  test("queries CSV input with explicit --no-header and keeps row 1 in the result set", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "header-row-as-data.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n2,Bob\n", "utf8");

      const result = runCli([
        "data",
        "query",
        inputPath.slice(REPO_ROOT.length + 1),
        "--no-header",
        "--sql",
        "select column_1, column_2 from file order by column_1",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Visible columns: column_1, column_2");
      expect(result.stdout).toContain("column_1 | column_2");
      expect(result.stdout).toContain("id       | name");
      expect(result.stdout).toContain("1        | Ada");
    });
  });

  test("queries CSV input with explicit columnN headers without renaming them", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "literal-column-names.csv");
      await writeFile(inputPath, "column1,column2\n1001,active\n1002,paused\n", "utf8");

      const result = runCli([
        "data",
        "query",
        inputPath.slice(REPO_ROOT.length + 1),
        "--sql",
        "select column1, column2 from file order by column1",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Visible columns: column1, column2");
      expect(result.stdout).toContain("1001    | active");
      expect(result.stdout).not.toContain("column_2");
      expect(result.stdout).not.toContain("column_3");
    });
  });

  test("writes a reviewed header-mapping artifact and stops before SQL execution", async () => {
    await withTempFixtureDir("query-header-review", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "generic.csv");
      const artifactPath = join(fixtureDir, "header-map.json");
      const promptPath = join(fixtureDir, "header-suggest-prompt.txt");
      await writeFile(inputPath, "column_1,column_2\n1001,active\n1002,paused\n", "utf8");
      const stubPath = await createHeaderSuggestionStub({
        promptPath,
        suggestions: [
          { from: "column_1", to: "id" },
          { from: "column_2", to: "status" },
        ],
        workingDirectory: fixtureDir,
      });

      const result = runCli(
        [
          "data",
          "query",
          inputPath.slice(REPO_ROOT.length + 1),
          "--codex-suggest-headers",
          "--write-header-mapping",
          artifactPath.slice(REPO_ROOT.length + 1),
        ],
        REPO_ROOT,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Suggested headers");
      expect(result.stdout).toContain("column_1 -> id");
      expect(result.stdout).toContain("column_2 -> status");
      expect(result.stderr).toContain("--header-mapping");
      expect(result.stderr).toContain("--sql");

      const prompt = await readFile(promptPath, "utf8");
      expect(prompt).toContain("Detected format: csv");
      expect(prompt).toContain("1. column_1 (BIGINT) samples: 1001, 1002");

      const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as {
        input: { format: string; path: string };
        mappings: Array<{ from: string; inferredType?: string; sample?: string; to: string }>;
      };
      expect(artifact.input).toEqual({
        format: "csv",
        path: inputPath.slice(REPO_ROOT.length + 1),
      });
      expect(artifact.mappings).toEqual([
        { from: "column_1", inferredType: "BIGINT", sample: "1001", to: "id" },
        { from: "column_2", inferredType: "VARCHAR", sample: "active", to: "status" },
      ]);
    });
  });

  test("queries Parquet input end to end", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("basic.parquet"),
      "--sql",
      "select id, name from file order by id",
      "--json",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual([
      { id: "1", name: "Ada" },
      { id: "2", name: "Bob" },
      { id: "3", name: "Cyd" },
    ]);
  });

  test("queries SQLite input end to end when the extension is ready", () => {
    if (!sqliteReady) {
      return;
    }

    const result = runCli([
      "data",
      "query",
      fixturePath("multi.sqlite"),
      "--source",
      "users",
      "--sql",
      "select id, name from file order by id",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Format: sqlite");
    expect(result.stdout).toContain("Source: users");
    expect(result.stdout).toContain("1   | Ada");
  });

  test("queries SQLite workspace relations end to end when the extension is ready", () => {
    if (!sqliteReady) {
      return;
    }

    const result = runCli([
      "data",
      "query",
      fixturePath("multi.sqlite"),
      "--relation",
      "users",
      "--relation",
      "entries=time_entries",
      "--sql",
      "select users.name, entries.hours from users join entries on users.id = entries.entry_id order by users.id",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Format: sqlite");
    expect(result.stdout).toContain("Relations: users, entries");
    expect(result.stdout).toContain("Ada  | 8");
    expect(result.stdout).toContain("Bob  | 5");
  });

  test("treats one explicit --relation binding as workspace mode when the extension is ready", () => {
    if (!sqliteReady) {
      return;
    }

    const result = runCli([
      "data",
      "query",
      fixturePath("multi.sqlite"),
      "--relation",
      "people=users",
      "--sql",
      "select id, name from people order by id",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Relations: people");
    expect(result.stdout).not.toContain("Source: users");
    expect(result.stdout).toContain("1   | Ada");
  });

  test("queries Excel input end to end when the extension is ready", () => {
    if (!excelReady) {
      return;
    }

    const result = runCli([
      "data",
      "query",
      fixturePath("multi.xlsx"),
      "--source",
      "Summary",
      "--sql",
      "select id, name from file order by id",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Format: excel");
    expect(result.stdout).toContain("Source: Summary");
    expect(result.stdout).toContain("1   | Ada");
  });

  test("queries an explicit Excel range end to end when the extension is ready", () => {
    if (!excelReady) {
      return;
    }

    const result = runCli([
      "data",
      "query",
      fixturePath("multi.xlsx"),
      "--source",
      "Summary",
      "--range",
      "A1:B3",
      "--sql",
      "select * from file order by id",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Format: excel");
    expect(result.stdout).toContain("Source: Summary");
    expect(result.stdout).toContain("Range: A1:B3");
    expect(result.stdout).toContain("Visible columns: id, name");
    expect(result.stdout).not.toContain("status");
  });

  test("queries an explicit Excel range plus header-row end to end when the extension is ready", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "messy.xlsx");

      const result = runCli([
        "data",
        "query",
        inputPath.slice(REPO_ROOT.length + 1),
        "--source",
        "Summary",
        "--range",
        "B2:E11",
        "--header-row",
        "7",
        "--sql",
        "select ID, item, status from file order by ID",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Format: excel");
      expect(result.stdout).toContain("Source: Summary");
      expect(result.stdout).toContain("Range: B2:E11");
      expect(result.stdout).toContain("Header row: 7");
      expect(result.stdout).toContain("Visible columns: ID, item, status");
      expect(result.stdout).toContain("1001 | Starter");
      expect(result.stdout).not.toContain("Quarterly Operations Report");
    });
  });

  test("reuses an accepted source-shape artifact end to end", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "messy.xlsx");
      const artifactPath = join(fixtureDir, "shape.json");
      await writeFile(
        artifactPath,
        `${JSON.stringify(
          {
            input: {
              format: "excel",
              path: toRepoRelativePath(inputPath),
              source: "Summary",
            },
            metadata: {
              artifactType: "data-source-shape",
              issuedAt: "2026-03-20T00:00:00.000Z",
            },
            shape: {
              headerRow: 7,
              range: "B2:E11",
            },
            version: 1,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );

      const result = runCli([
        "data",
        "query",
        toRepoRelativePath(inputPath),
        "--source-shape",
        toRepoRelativePath(artifactPath),
        "--sql",
        "select ID, item, status from file order by ID",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Format: excel");
      expect(result.stdout).toContain("Source: Summary");
      expect(result.stdout).toContain("Range: B2:E11");
      expect(result.stdout).toContain("Header row: 7");
      expect(result.stdout).toContain("Visible columns: ID, item, status");
      expect(result.stdout).toContain("1001 | Starter");
    });
  });

  test("queries the stacked merged-band workbook end to end when body-start-row is provided", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      seedStackedMergedBandFixture(fixtureDir);
      const inputPath = join(fixtureDir, "stacked-merged-band.xlsx");

      const result = runCli([
        "data",
        "query",
        inputPath.slice(REPO_ROOT.length + 1),
        "--source",
        "Sheet1",
        "--range",
        "B7:BR20",
        "--body-start-row",
        "10",
        "--header-row",
        "7",
        "--sql",
        "select id, question, status, notes from file order by id",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Source: Sheet1");
      expect(result.stdout).toContain("Range: B7:BR20");
      expect(result.stdout).toContain("Body start row: 10");
      expect(result.stdout).toContain("Header row: 7");
      expect(result.stdout).toContain("Visible columns: id, question, status, notes");
      expect(result.stdout).toContain("1   | Does the customer need");
      expect(result.stdout).toContain("11  | Should the account remain");
    });
  });

  test("honors explicit row bounds for bounded table output", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("large.csv"),
      "--sql",
      "select id, note from file order by id",
      "--rows",
      "1",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Result rows: 1+ (bounded)");
    expect(result.stdout).toContain("1   | fixture-row-0001");
    expect(result.stdout).not.toContain("fixture-row-0002");
  });

  test("uses the default bounded row count when --rows is omitted", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("large.csv"),
      "--sql",
      "select id, note from file order by id",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Result rows: 20+ (bounded)");
    expect(result.stdout).toContain("20  | fixture-row-0020");
    expect(result.stdout).not.toContain("fixture-row-0021");
  });

  test("lists available SQLite sources when source is missing", () => {
    if (!sqliteReady) {
      return;
    }

    const result = runCli([
      "data",
      "query",
      fixturePath("multi.sqlite"),
      "--sql",
      "select * from file",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--source is required for SQLite");
    expect(result.stderr).toContain("Available sources: active_users, time_entries, users");
  });

  test("rejects --source together with --relation", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("multi.sqlite"),
      "--source",
      "users",
      "--relation",
      "entries=time_entries",
      "--sql",
      "select * from file",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--relation cannot be used together with --source");
  });

  test("rejects reserved file alias in workspace mode", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("multi.sqlite"),
      "--relation",
      "file=users",
      "--sql",
      "select * from file",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("relation alias `file` is reserved in workspace mode");
  });

  test("rejects duplicate relation aliases in workspace mode", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("multi.sqlite"),
      "--relation",
      "users",
      "--relation",
      "users=time_entries",
      "--sql",
      "select * from users",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Duplicate workspace relation alias: users");
  });

  test("rejects --relation for non-SQLite query inputs", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("basic.csv"),
      "--relation",
      "people",
      "--sql",
      "select * from people",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(
      "--relation is currently only supported for SQLite query inputs",
    );
  });

  test("rejects malformed relation aliases at CLI parsing time", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("multi.sqlite"),
      "--relation",
      "1bad=users",
      "--sql",
      "select * from users",
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("--relation alias must be a simple SQL identifier");
  });

  test("lists available Excel sources when source is missing", () => {
    if (!excelReady) {
      return;
    }

    const result = runCli([
      "data",
      "query",
      fixturePath("multi.xlsx"),
      "--sql",
      "select * from file",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--source is required for Excel");
    expect(result.stderr).toContain("Available sources: Summary, RawData");
  });

  test("reports install guidance when Excel is not installed in an isolated HOME", async () => {
    await withTempFixtureDir("query-home-excel", async (tempHome) => {
      const result = runCli(
        [
          "data",
          "query",
          fixturePath("multi.xlsx"),
          "--source",
          "Summary",
          "--sql",
          "select * from file",
        ],
        REPO_ROOT,
        { HOME: tempHome },
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("requires the DuckDB excel extension");
      expect(result.stderr).toContain("Install it explicitly in DuckDB");
    });
  });

  test("reports install-unavailable guidance when SQLite cannot cache extensions", async () => {
    await withTempFixtureDir("query-home-sqlite", async (tempHome) => {
      await chmod(tempHome, 0o500);

      const result = runCli(
        [
          "data",
          "query",
          fixturePath("multi.sqlite"),
          "--source",
          "users",
          "--sql",
          "select * from file",
        ],
        REPO_ROOT,
        { HOME: tempHome },
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("requires the DuckDB sqlite extension");
      expect(result.stderr).toContain("cannot install or cache it");
    });
  });

  test("rejects --install-missing-extension for built-in query formats", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("basic.csv"),
      "--install-missing-extension",
      "--sql",
      "select * from file",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(
      "--install-missing-extension is only valid for extension-backed query formats",
    );
  });

  test("rejects explicit shape flags when --source-shape is provided", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("multi.xlsx"),
      "--source-shape",
      "shape.json",
      "--range",
      "A1:B3",
      "--sql",
      "select * from file",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--source-shape cannot be used together with --range");
  });

  test("reports exact-match failure when a source-shape artifact does not match the current query input", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "messy.xlsx");
      const artifactPath = join(fixtureDir, "shape.json");
      await writeFile(
        artifactPath,
        `${JSON.stringify(
          {
            input: {
              format: "excel",
              path: "examples/playground/other.xlsx",
              source: "Summary",
            },
            metadata: {
              artifactType: "data-source-shape",
              issuedAt: "2026-03-20T00:00:00.000Z",
            },
            shape: {
              range: "B2:E11",
            },
            version: 1,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );

      const result = runCli([
        "data",
        "query",
        toRepoRelativePath(inputPath),
        "--source-shape",
        toRepoRelativePath(artifactPath),
        "--sql",
        "select * from file",
      ]);

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain(
        "Source shape artifact does not match the current input context exactly",
      );
    });
  });
});

describe("CLI DuckDB lifecycle commands", () => {
  test("reports managed DuckDB extension state", () => {
    const result = runCli(["data", "duckdb", "doctor"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("cdx-chores data duckdb doctor");
    expect(result.stdout).toContain("DuckDB runtime:");
    expect(result.stdout).toContain("Managed extensions:");
    expect(result.stdout).toContain("sqlite:");
    expect(result.stdout).toContain("excel:");
  });

  test("requires an extension name unless --all-supported is used", () => {
    const result = runCli(["data", "duckdb", "extension", "install"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Extension name is required unless --all-supported is used");
  });
});
