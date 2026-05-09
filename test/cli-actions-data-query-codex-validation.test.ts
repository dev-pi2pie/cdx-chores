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

describe("cli action modules: data query codex validation", () => {
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

  test("actionDataQueryCodex reports malformed Codex draft JSON clearly", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();

    await expectCliError(
      () =>
        actionDataQueryCodex(runtime, {
          input: "test/fixtures/data-query/basic.csv",
          intent: "show active rows",
          runner: async () => "{not json",
        }),
      {
        code: "DATA_QUERY_CODEX_FAILED",
        exitCode: 2,
        messageIncludes: "Codex drafting failed",
      },
    );

    expectNoOutput();
  });

  test("actionDataQueryCodex reports incomplete Codex draft payloads clearly", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();

    await expectCliError(
      () =>
        actionDataQueryCodex(runtime, {
          input: "test/fixtures/data-query/basic.csv",
          intent: "show active rows",
          runner: async () =>
            JSON.stringify({
              reasoning_summary: "Missing the SQL field.",
            }),
        }),
      {
        code: "DATA_QUERY_CODEX_FAILED",
        exitCode: 2,
        messageIncludes: "Codex drafting response did not include SQL.",
      },
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
