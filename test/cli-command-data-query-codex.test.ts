import { chmod, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { inspectDataQueryExtensions } from "../src/cli/duckdb/query";
import { seedDataExtractFixtures } from "./helpers/data-extract-fixture-test-utils";
import { seedDuckDbWorkspaceFixture } from "./helpers/data-query-duckdb-fixture-test-utils";
import { runCli, withTempFixtureDir } from "./helpers/cli-test-utils";

const queryExtensions = await inspectDataQueryExtensions();
const duckdbReady = queryExtensions.available;
const excelReady = queryExtensions.available && queryExtensions.excel?.loadable === true;
const sqliteReady = queryExtensions.available && queryExtensions.sqlite?.loadable === true;

async function createCodexStub(options: {
  promptPath?: string;
  sql: string;
  summary: string;
  workingDirectory: string;
}): Promise<string> {
  const stubPath = join(options.workingDirectory, "codex-stub.mjs");
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
  sql: ${JSON.stringify(options.sql)},
  reasoning_summary: ${JSON.stringify(options.summary)},
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

describe("CLI data query codex command", () => {
  test("drafts SQL end to end with default assistant output", async () => {
    await withTempFixtureDir("query-codex-cli", async (fixtureDir) => {
      const promptPath = join(fixtureDir, "prompt.txt");
      const stubPath = await createCodexStub({
        promptPath,
        sql: "select id, name from file order by id",
        summary: "Projects id and name with stable ordering.",
        workingDirectory: fixtureDir,
      });

      const result = runCli(
        [
          "data",
          "query",
          "codex",
          "test/fixtures/data-query/basic.csv",
          "--intent",
          "show id and name ordered by id",
        ],
        undefined,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Intent: show id and name ordered by id");
      expect(result.stdout).toContain("Format: csv");
      expect(result.stdout).toContain("Codex Summary: Projects id and name with stable ordering.");
      expect(result.stdout).toContain("SQL:\nselect id, name from file order by id");

      const prompt = await readFile(promptPath, "utf8");
      expect(prompt).toContain("User intent: show id and name ordered by id");
      expect(prompt).toContain("Detected format: csv");
      expect(prompt).toContain("Schema (4 columns):");
      expect(prompt).toContain("1. id: BIGINT");
      expect(prompt).toContain('"status":"active"');
    });
  });

  test("prints SQL only end to end with --print-sql", async () => {
    await withTempFixtureDir("query-codex-cli", async (fixtureDir) => {
      const stubPath = await createCodexStub({
        sql: "select\n  count(*) as total\nfrom file",
        summary: "Counts every row in the file.",
        workingDirectory: fixtureDir,
      });

      const result = runCli(
        [
          "data",
          "query",
          "codex",
          "test/fixtures/data-query/basic.csv",
          "--intent",
          "count rows",
          "--print-sql",
        ],
        undefined,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout.trim()).toBe("select\n  count(*) as total\nfrom file");
    });
  });

  test("accepts --source on the codex lane for SQLite inputs", async () => {
    if (!sqliteReady) {
      return;
    }

    await withTempFixtureDir("query-codex-cli", async (fixtureDir) => {
      const promptPath = join(fixtureDir, "sqlite-prompt.txt");
      const stubPath = await createCodexStub({
        promptPath,
        sql: "select id, name from file order by id",
        summary: "Uses the selected SQLite source.",
        workingDirectory: fixtureDir,
      });

      const result = runCli(
        [
          "data",
          "query",
          "codex",
          "test/fixtures/data-query/multi.sqlite",
          "--source",
          "users",
          "--intent",
          "list users ordered by id",
        ],
        undefined,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Source: users");

      const prompt = await readFile(promptPath, "utf8");
      expect(prompt).toContain("Selected source: users");
    });
  });

  test("accepts --relation on the codex lane for SQLite workspace inputs", async () => {
    if (!sqliteReady) {
      return;
    }

    await withTempFixtureDir("query-codex-cli", async (fixtureDir) => {
      const promptPath = join(fixtureDir, "sqlite-workspace-prompt.txt");
      const stubPath = await createCodexStub({
        promptPath,
        sql: "select users.name, entries.hours from users join entries on users.id = entries.entry_id order by users.id",
        summary: "Uses the selected SQLite workspace relations.",
        workingDirectory: fixtureDir,
      });

      const result = runCli(
        [
          "data",
          "query",
          "codex",
          "test/fixtures/data-query/multi.sqlite",
          "--relation",
          "users",
          "--relation",
          "entries=time_entries",
          "--intent",
          "join users with time entries",
        ],
        undefined,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Relations: users, entries");

      const prompt = await readFile(promptPath, "utf8");
      expect(prompt).toContain("Use only these relation names: users, entries.");
      expect(prompt).toContain("Relation users (source: users)");
      expect(prompt).toContain("Relation entries (source: time_entries)");
      expect(prompt).toContain("1. entry_id: BIGINT");
      expect(prompt).toContain("3. hours: BIGINT");
      expect(prompt).toContain('"entry_id":"1"');
    });
  });

  test("accepts inline --relation=<binding> syntax on the codex workspace lane", async () => {
    if (!sqliteReady) {
      return;
    }

    await withTempFixtureDir("query-codex-cli", async (fixtureDir) => {
      const promptPath = join(fixtureDir, "sqlite-inline-workspace-prompt.txt");
      const stubPath = await createCodexStub({
        promptPath,
        sql: "select users.id, entries.hours from users join entries on users.id = entries.entry_id order by users.id",
        summary: "Uses inline workspace relation bindings.",
        workingDirectory: fixtureDir,
      });

      const result = runCli(
        [
          "data",
          "query",
          "codex",
          "test/fixtures/data-query/multi.sqlite",
          "--relation=users",
          "--relation=entries=time_entries",
          "--intent",
          "join users with time entries",
        ],
        undefined,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Relations: users, entries");

      const prompt = await readFile(promptPath, "utf8");
      expect(prompt).toContain("Use only these relation names: users, entries.");
      expect(prompt).toContain("Relation entries (source: time_entries)");
    });
  });

  test("accepts DuckDB workspace relations on the codex lane", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("query-codex-cli", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);
      const promptPath = join(fixtureDir, "duckdb-workspace-prompt.txt");
      const stubPath = await createCodexStub({
        promptPath,
        sql: "select users.name, events.event_type from users join events on users.id = events.user_id order by events.id",
        summary: "Uses DuckDB workspace relations.",
        workingDirectory: fixtureDir,
      });

      const result = runCli(
        [
          "data",
          "query",
          "codex",
          inputPath,
          "--relation",
          "users",
          "--relation",
          "events=analytics.events",
          "--intent",
          "join users with analytics events",
        ],
        undefined,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Format: duckdb");
      expect(result.stdout).toContain("Relations: users, events");

      const prompt = await readFile(promptPath, "utf8");
      expect(prompt).toContain("Detected format: duckdb");
      expect(prompt).toContain("Relation events (source: analytics.events)");
    });
  });

  test("accepts DuckDB single-source drafting on the codex lane", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("query-codex-cli", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);
      const promptPath = join(fixtureDir, "duckdb-source-prompt.txt");
      const stubPath = await createCodexStub({
        promptPath,
        sql: "select id, event_type from file order by id",
        summary: "Uses the selected schema-qualified DuckDB source.",
        workingDirectory: fixtureDir,
      });

      const result = runCli(
        [
          "data",
          "query",
          "codex",
          inputPath,
          "--source",
          "analytics.events",
          "--intent",
          "list analytics events ordered by id",
        ],
        undefined,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Format: duckdb");
      expect(result.stdout).toContain("Source: analytics.events");

      const prompt = await readFile(promptPath, "utf8");
      expect(prompt).toContain("Selected source: analytics.events");
      expect(prompt).toContain("1. id: INTEGER");
      expect(prompt).toContain('"event_type":"login"');
    });
  });

  test("requires --source for multi-object DuckDB codex single-source runs", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("query-codex-cli", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);
      const stubPath = await createCodexStub({
        sql: "select * from file",
        summary: "unused",
        workingDirectory: fixtureDir,
      });

      const result = runCli(
        ["data", "query", "codex", inputPath, "--intent", "list rows"],
        undefined,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("--source is required for DuckDB query inputs");
      expect(result.stderr).toContain("analytics.events, file, time_entries, users");
    });
  });

  test("prints SQL only for SQLite workspace codex drafting", async () => {
    if (!sqliteReady) {
      return;
    }

    await withTempFixtureDir("query-codex-cli", async (fixtureDir) => {
      const stubPath = await createCodexStub({
        sql: "select users.id, entries.hours from users join entries on users.id = entries.entry_id",
        summary: "unused in print-sql mode",
        workingDirectory: fixtureDir,
      });

      const result = runCli(
        [
          "data",
          "query",
          "codex",
          "test/fixtures/data-query/multi.sqlite",
          "--relation",
          "users",
          "--relation",
          "entries=time_entries",
          "--intent",
          "join users with time entries",
          "--print-sql",
        ],
        undefined,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout.trim()).toBe(
        "select users.id, entries.hours from users join entries on users.id = entries.entry_id",
      );
    });
  });

  test("rejects reserved file alias on the codex workspace lane", async () => {
    if (!sqliteReady) {
      return;
    }

    await withTempFixtureDir("query-codex-cli", async (fixtureDir) => {
      const stubPath = await createCodexStub({
        sql: "select 1",
        summary: "unused",
        workingDirectory: fixtureDir,
      });

      const result = runCli(
        [
          "data",
          "query",
          "codex",
          "test/fixtures/data-query/multi.sqlite",
          "--relation",
          "file=users",
          "--intent",
          "list users",
        ],
        undefined,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("The relation alias `file` is reserved in workspace mode.");
    });
  });

  test("rejects duplicate workspace aliases on the codex lane", async () => {
    if (!sqliteReady) {
      return;
    }

    await withTempFixtureDir("query-codex-cli", async (fixtureDir) => {
      const stubPath = await createCodexStub({
        sql: "select 1",
        summary: "unused",
        workingDirectory: fixtureDir,
      });

      const result = runCli(
        [
          "data",
          "query",
          "codex",
          "test/fixtures/data-query/multi.sqlite",
          "--relation",
          "users",
          "--relation",
          "users=active_users",
          "--intent",
          "list users",
        ],
        undefined,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("Duplicate workspace relation alias: users.");
    });
  });

  test("rejects malformed workspace aliases on the codex lane", async () => {
    if (!sqliteReady) {
      return;
    }

    await withTempFixtureDir("query-codex-cli", async (fixtureDir) => {
      const stubPath = await createCodexStub({
        sql: "select 1",
        summary: "unused",
        workingDirectory: fixtureDir,
      });

      const result = runCli(
        [
          "data",
          "query",
          "codex",
          "test/fixtures/data-query/multi.sqlite",
          "--relation",
          "1users=users",
          "--intent",
          "list users",
        ],
        undefined,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        "option '--relation <binding>' argument '1users=users' is invalid",
      );
      expect(result.stderr).toContain("simple SQL identifier");
    });
  });

  test("accepts --range on the codex lane for Excel inputs", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("query-codex-cli", async (fixtureDir) => {
      const promptPath = join(fixtureDir, "excel-prompt.txt");
      const stubPath = await createCodexStub({
        promptPath,
        sql: "select id, name from file order by id",
        summary: "Uses the selected Excel range.",
        workingDirectory: fixtureDir,
      });

      const result = runCli(
        [
          "data",
          "query",
          "codex",
          "test/fixtures/data-query/multi.xlsx",
          "--source",
          "Summary",
          "--range",
          "A1:B3",
          "--intent",
          "show ids and names ordered by id",
        ],
        undefined,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Source: Summary");
      expect(result.stdout).toContain("Range: A1:B3");

      const prompt = await readFile(promptPath, "utf8");
      expect(prompt).toContain("Selected source: Summary");
      expect(prompt).toContain("Selected range: A1:B3");
      expect(prompt).toContain("Schema (2 columns):");
    });
  });

  test("accepts --header-row on the codex lane for Excel inputs", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("query-codex-cli", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const promptPath = join(fixtureDir, "header-row-prompt.txt");
      const stubPath = await createCodexStub({
        promptPath,
        sql: 'select "ID", status from file order by "ID"',
        summary: "Uses the selected header row within the reviewed Excel shape.",
        workingDirectory: fixtureDir,
      });

      const result = runCli(
        [
          "data",
          "query",
          "codex",
          `${fixtureDir}/messy.xlsx`,
          "--source",
          "Summary",
          "--range",
          "B2:E11",
          "--header-row",
          "7",
          "--intent",
          "show ids and status ordered by id",
        ],
        undefined,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Source: Summary");
      expect(result.stdout).toContain("Range: B2:E11");
      expect(result.stdout).toContain("Header row: 7");

      const prompt = await readFile(promptPath, "utf8");
      expect(prompt).toContain("Selected source: Summary");
      expect(prompt).toContain("Selected range: B2:E11");
      expect(prompt).toContain("Selected header row: 7");
      expect(prompt).toContain("Schema (4 columns):");
      expect(prompt).toContain("1. ID: DOUBLE");
    });
  });
});
