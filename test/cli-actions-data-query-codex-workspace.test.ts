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

describe("cli action modules: data query codex workspace", () => {
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

  test("actionDataQueryCodex allows explicit file aliases in workspace mode", async () => {
    if (!sqliteReady) {
      return;
    }

    const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();

    await actionDataQueryCodex(runtime, {
      input: "test/fixtures/data-query/multi.sqlite",
      intent: "list users ordered by id",
      relations: [{ alias: "file", source: "users" }],
      runner: async ({ prompt }) => {
        expect(prompt).toContain("Use only these relation names: file.");
        expect(prompt).toContain("Relation file (source: users)");

        return JSON.stringify({
          sql: "select id, name from file order by id",
          reasoning_summary: "Uses the explicit workspace alias file.",
        });
      },
    });

    expectNoStderr();
    expect(stderr.text).toBe("");
    expect(stdout.text).toContain("Relations: file");
    expect(stdout.text).toContain("- file (source: users)");
    expect(stdout.text).toContain("Uses the explicit workspace alias file.");
    expect(stdout.text).toContain("select id, name from file order by id");
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
});
