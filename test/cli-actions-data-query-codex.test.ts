/* oxlint-disable no-unused-vars */
import {
  describe,
  expect,
  test,
  actionDataQueryCodex,
  buildDataQueryCodexIntentEditorTemplate,
  normalizeDataQueryCodexEditorIntent,
  createActionTestRuntime,
  expectCliError,
  seedDataExtractFixtures,
  seedDuckDbWorkspaceFixture,
  seedSingleTableDuckDbFixture,
  toRepoRelativePath,
  withTempFixtureDir,
  duckdbReady,
  excelReady,
  sqliteReady,
  stripAnsi,
} from "./cli-actions-data-query-codex.helpers";

describe("cli action modules: data query codex single-source", () => {
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

  test("actionDataQueryCodex infers the only DuckDB source when the file has one table", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("query-codex-action", async (fixtureDir) => {
      const inputPath = await seedSingleTableDuckDbFixture(fixtureDir);
      const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();

      await actionDataQueryCodex(runtime, {
        input: toRepoRelativePath(inputPath),
        intent: "list users ordered by id",
        runner: async ({ prompt }) => {
          expect(prompt).toContain("Selected source: users");
          expect(prompt).toContain("1. id: INTEGER");
          return JSON.stringify({
            sql: "select id, name from file order by id",
            reasoning_summary: "Projects the only DuckDB source.",
          });
        },
      });

      expectNoStderr();
      expect(stderr.text).toBe("");
      expect(stdout.text).toContain("Format: duckdb");
      expect(stdout.text).toContain("Source: users");
      expect(stdout.text).toContain("Projects the only DuckDB source.");
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
});
