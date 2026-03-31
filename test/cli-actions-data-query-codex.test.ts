import { describe, expect, test } from "bun:test";

import { actionDataQueryCodex } from "../src/cli/actions";
import {
  buildDataQueryCodexIntentEditorTemplate,
  normalizeDataQueryCodexEditorIntent,
} from "../src/cli/data-query/codex";
import { inspectDataQueryExtensions } from "../src/cli/duckdb/query";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { seedDataExtractFixtures } from "./helpers/data-extract-fixture-test-utils";
import { seedDuckDbWorkspaceFixture } from "./helpers/data-query-duckdb-fixture-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

const queryExtensions = await inspectDataQueryExtensions();
const duckdbReady = queryExtensions.available;
const excelReady = queryExtensions.available && queryExtensions.excel?.loadable === true;
const sqliteReady = queryExtensions.available && queryExtensions.sqlite?.loadable === true;
const ANSI_ESCAPE_PATTERN = new RegExp(String.raw`\u001B\[[0-9;]*m`, "g");

function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE_PATTERN, "");
}

describe("cli action modules: data query codex", () => {
  test("actionDataQueryCodex renders default assistant output", async () => {
    const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();

    await actionDataQueryCodex(runtime, {
      input: "test/fixtures/data-query/basic.csv",
      intent: "show id and name ordered by id",
      runner: async ({ prompt }) => {
        expect(prompt).toContain("User intent: show id and name ordered by id");
        expect(prompt).toContain("Detected format: csv");
        expect(prompt).toContain("1. id: BIGINT");
        expect(prompt).toContain('"name":"Ada"');

        return JSON.stringify({
          sql: "select id, name from file order by id",
          reasoning_summary: "Projects the requested columns and keeps a stable ordering.",
        });
      },
    });

    expectNoStderr();
    expect(stderr.text).toBe("");
    expect(stdout.text).toContain("Intent: show id and name ordered by id");
    expect(stdout.text).toContain("Format: csv");
    expect(stdout.text).toContain("Schema:");
    expect(stdout.text).toContain("- id: BIGINT");
    expect(stdout.text).toContain("Sample Rows:");
    expect(stdout.text).toContain(
      '{"id":"1","name":"Ada","status":"active","created_at":"2026-03-01"}',
    );
    expect(stdout.text).toContain(
      "Codex Summary: Projects the requested columns and keeps a stable ordering.",
    );
    expect(stdout.text).toContain("SQL:\nselect id, name from file order by id");
  });

  test("actionDataQueryCodex renders workspace assistant output for SQLite relations", async () => {
    if (!sqliteReady) {
      return;
    }

    const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();

    await actionDataQueryCodex(runtime, {
      input: "test/fixtures/data-query/multi.sqlite",
      intent: "join users with time entries",
      relations: [
        { alias: "users", source: "users" },
        { alias: "entries", source: "time_entries" },
      ],
      runner: async ({ prompt }) => {
        expect(prompt).toContain("Use only these relation names: users, entries.");
        expect(prompt).toContain("Relation users (source: users)");
        expect(prompt).toContain("Relation entries (source: time_entries)");

        return JSON.stringify({
          sql: "select users.name, entries.hours from users join entries on users.id = entries.entry_id order by users.id",
          reasoning_summary: "Joins the two bound relations on the shared identifier.",
        });
      },
    });

    expectNoStderr();
    expect(stderr.text).toBe("");
    expect(stdout.text).toContain("Relations: users, entries");
    expect(stdout.text).toContain("- users (source: users)");
    expect(stdout.text).toContain("- entries (source: time_entries)");
    expect(stdout.text).toContain("Joins the two bound relations on the shared identifier.");
    expect(stdout.text).toContain(
      "select users.name, entries.hours from users join entries on users.id = entries.entry_id order by users.id",
    );
  });

  test("actionDataQueryCodex renders workspace assistant output for DuckDB-file relations", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("query-codex-action", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);
      const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();

      await actionDataQueryCodex(runtime, {
        input: toRepoRelativePath(inputPath),
        intent: "join users with analytics events",
        relations: [
          { alias: "users", source: "users" },
          { alias: "events", source: "analytics.events" },
        ],
        runner: async ({ prompt }) => {
          expect(prompt).toContain("Detected format: duckdb");
          expect(prompt).toContain("Relation users (source: users)");
          expect(prompt).toContain("Relation events (source: analytics.events)");

          return JSON.stringify({
            sql: "select users.name, events.event_type from users join events on users.id = events.user_id order by events.id",
            reasoning_summary: "Joins the bound DuckDB-file relations on user_id.",
          });
        },
      });

      expectNoStderr();
      expect(stderr.text).toBe("");
      expect(stdout.text).toContain("Format: duckdb");
      expect(stdout.text).toContain("Relations: users, events");
      expect(stdout.text).toContain("Joins the bound DuckDB-file relations on user_id.");
    });
  });

  test("actionDataQueryCodex supports schema-qualified DuckDB single-source drafting", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("query-codex-action", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);
      const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();

      await actionDataQueryCodex(runtime, {
        input: toRepoRelativePath(inputPath),
        intent: "list analytics events ordered by id",
        source: "analytics.events",
        runner: async ({ prompt }) => {
          expect(prompt).toContain("Selected source: analytics.events");
          expect(prompt).toContain("1. id: INTEGER");
          expect(prompt).toContain('"event_type":"login"');
          return JSON.stringify({
            sql: "select id, event_type from file order by id",
            reasoning_summary: "Projects analytics events from the selected DuckDB source.",
          });
        },
      });

      expectNoStderr();
      expect(stderr.text).toBe("");
      expect(stdout.text).toContain("Source: analytics.events");
      expect(stdout.text).toContain("Projects analytics events from the selected DuckDB source.");
    });
  });

  test("actionDataQueryCodex requires --source for multi-object DuckDB single-source drafting", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("query-codex-action", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionDataQueryCodex(runtime, {
            input: toRepoRelativePath(inputPath),
            intent: "list rows",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--source is required for DuckDB query inputs",
        },
      );

      expectNoOutput();
    });
  });

  test("actionDataQueryCodex prints SQL only with --print-sql", async () => {
    const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();

    await actionDataQueryCodex(runtime, {
      input: "test/fixtures/data-query/basic.csv",
      intent: "show all rows",
      printSql: true,
      runner: async () =>
        JSON.stringify({
          sql: "select\n  *\nfrom file\nwhere note = 'A  B'\norder by id",
          reasoning_summary:
            "Returns the full file table in id order while preserving literal spacing.",
        }),
    });

    expectNoStderr();
    expect(stderr.text).toBe("");
    expect(stdout.text.trim()).toBe("select\n  *\nfrom file\nwhere note = 'A  B'\norder by id");
  });

  test("actionDataQueryCodex includes the accepted header row in prompt and rendered output", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("query-codex-action", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = `${fixtureDir}/messy.xlsx`;
      const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();

      await actionDataQueryCodex(runtime, {
        headerRow: 7,
        input: toRepoRelativePath(inputPath),
        intent: "show id and status ordered by id",
        range: "B2:E11",
        runner: async ({ prompt }) => {
          expect(prompt).toContain(`Selected source: Summary`);
          expect(prompt).toContain("Selected range: B2:E11");
          expect(prompt).toContain("Selected header row: 7");
          expect(prompt).toContain("1. ID: DOUBLE");
          expect(prompt).toContain('"item":"Starter"');
          return JSON.stringify({
            sql: 'select "ID", status from file order by "ID"',
            reasoning_summary: "Projects the requested columns from the accepted shaped sheet.",
          });
        },
        source: "Summary",
      });

      expectNoStderr();
      expect(stderr.text).toBe("");
      expect(stdout.text).toContain("Header row: 7");
      expect(stdout.text).toContain("Range: B2:E11");
      expect(stdout.text).toContain('SQL:\nselect "ID", status from file order by "ID"');
    });
  });

  test("actionDataQueryCodex shows transient tty progress and clears it before final output", async () => {
    const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();
    Object.assign(runtime.stdout as object, { isTTY: true });

    await actionDataQueryCodex(runtime, {
      input: "test/fixtures/data-query/basic.csv",
      intent: "show id and name ordered by id",
      runner: async () =>
        JSON.stringify({
          sql: "select id, name from file order by id",
          reasoning_summary: "Projects the requested columns and keeps a stable ordering.",
        }),
    });

    expectNoStderr();
    expect(stderr.text).toBe("");
    expect(stdout.text).toContain("Introspecting data source...");
    expect(stdout.text).toContain("Thinking");
    expect(stdout.text).toContain("Drafting SQL with Codex");
    expect(stdout.text).toContain("\r\x1b[2K");
    const normalized = stripAnsi(stdout.text);
    expect(normalized).toContain("Intent: show id and name ordered by id");
    expect(normalized).toContain("SQL:\nselect id, name from file order by id");
  });

  test("actionDataQueryCodex requires intent", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();

    await expectCliError(
      () =>
        actionDataQueryCodex(runtime, {
          input: "test/fixtures/data-query/basic.csv",
          intent: "   ",
        }),
      { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "Intent is required." },
    );

    expectNoOutput();
  });

  test("actionDataQueryCodex normalizes multiline intent before drafting", async () => {
    const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();

    await actionDataQueryCodex(runtime, {
      input: "test/fixtures/data-query/basic.csv",
      intent: "show active rows\nby status",
      runner: async ({ prompt }) => {
        expect(prompt).toContain("User intent: show active rows by status");
        return JSON.stringify({
          sql: 'select "status", count(*) as row_count from file group by "status"',
          reasoning_summary: "Counts rows grouped by status.",
        });
      },
    });

    expectNoStderr();
    expect(stderr.text).toBe("");
    expect(stdout.text).toContain("Intent: show active rows by status");
  });

  test("normalizeDataQueryCodexEditorIntent strips comment lines before normalization", () => {
    expect(
      normalizeDataQueryCodexEditorIntent(
        "# Query context\n  # Logical table: file\n\ncount active rows\nby status\n# trailing note",
      ),
    ).toBe("count active rows by status");
  });

  test("buildDataQueryCodexIntentEditorTemplate seeds compact query context", () => {
    const template = buildDataQueryCodexIntentEditorTemplate({
      format: "sqlite",
      introspection: {
        columns: [
          { name: "id", type: "BIGINT" },
          { name: "status", type: "VARCHAR" },
        ],
        sampleRows: [
          { id: "1", status: "active" },
          { id: "2", status: "inactive" },
        ],
        selectedSource: "users",
        truncated: false,
      },
    });

    expect(template).toContain("# Logical table: file");
    expect(template).toContain("# Format: sqlite");
    expect(template).toContain("# Source: users");
    expect(template).toContain("# Schema: id (BIGINT), status (VARCHAR)");
    expect(template).toContain('# 1. {"id":"1","status":"active"}');
    expect(template).toContain(
      "# Write plain intent below. Comment lines starting with # are ignored.",
    );
  });

  test("buildDataQueryCodexIntentEditorTemplate includes the selected range when present", () => {
    const template = buildDataQueryCodexIntentEditorTemplate({
      format: "excel",
      introspection: {
        columns: [
          { name: "id", type: "BIGINT" },
          { name: "name", type: "VARCHAR" },
        ],
        sampleRows: [{ id: "1", name: "Ada" }],
        selectedRange: "A1:B3",
        selectedSource: "Summary",
        truncated: false,
      },
    });

    expect(template).toContain("# Source: Summary");
    expect(template).toContain("# Range: A1:B3");
  });

  test("buildDataQueryCodexIntentEditorTemplate seeds workspace relation context", () => {
    const template = buildDataQueryCodexIntentEditorTemplate({
      format: "sqlite",
      introspection: {
        kind: "workspace",
        relations: [
          {
            alias: "users",
            columns: [{ name: "id", type: "BIGINT" }],
            sampleRows: [{ id: "1" }],
            source: "users",
            truncated: false,
          },
        ],
      },
    });

    expect(template).toContain("# Workspace relations:");
    expect(template).toContain("# - users (source: users)");
  });

  test("buildDataQueryCodexIntentEditorTemplate includes the selected header row when present", () => {
    const template = buildDataQueryCodexIntentEditorTemplate({
      format: "excel",
      introspection: {
        columns: [
          { name: "ID", type: "BIGINT" },
          { name: "status", type: "VARCHAR" },
        ],
        sampleRows: [{ ID: "1001", status: "active" }],
        selectedHeaderRow: 7,
        selectedRange: "B2:E11",
        selectedSource: "Summary",
        truncated: false,
      },
    });

    expect(template).toContain("# Range: B2:E11");
    expect(template).toContain("# Header row: 7");
  });

  test("actionDataQueryCodex reports codex unavailability failures clearly", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();

    await expectCliError(
      () =>
        actionDataQueryCodex(runtime, {
          input: "test/fixtures/data-query/basic.csv",
          intent: "show active rows",
          runner: async () => {
            throw new Error("Codex Exec exited with code 1: authentication required");
          },
        }),
      { code: "CODEX_UNAVAILABLE", exitCode: 2, messageIncludes: "Codex drafting unavailable" },
    );

    expectNoOutput();
  });

  test("actionDataQueryCodex reports source ambiguity for SQLite inputs", async () => {
    if (!sqliteReady) {
      return;
    }

    const { runtime, expectNoOutput } = createActionTestRuntime();

    await expectCliError(
      () =>
        actionDataQueryCodex(runtime, {
          input: "test/fixtures/data-query/multi.sqlite",
          intent: "list users",
          runner: async () =>
            JSON.stringify({
              sql: "select id, name from file order by id",
              reasoning_summary: "Uses the selected source.",
            }),
        }),
      { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "--source is required for SQLite" },
    );

    expectNoOutput();
  });

  test("actionDataQueryCodex rejects --relation together with --source", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();

    await expectCliError(
      () =>
        actionDataQueryCodex(runtime, {
          input: "test/fixtures/data-query/multi.sqlite",
          intent: "list users",
          relations: [{ alias: "users", source: "users" }],
          source: "users",
        }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "--relation cannot be used together with --source",
      },
    );

    expectNoOutput();
  });
});
