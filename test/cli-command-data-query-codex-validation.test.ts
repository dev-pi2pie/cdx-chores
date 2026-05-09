/* oxlint-disable no-unused-vars */
import {
  chmod,
  readFile,
  writeFile,
  join,
  describe,
  expect,
  test,
  seedDataExtractFixtures,
  seedDuckDbWorkspaceFixture,
  runCli,
  withTempFixtureDir,
  duckdbReady,
  excelReady,
  sqliteReady,
  createCodexStub,
} from "./cli-command-data-query-codex.helpers";

describe("CLI data query codex command validation", () => {
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

  test("rejects empty comma-separated workspace bundles on the codex lane", async () => {
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
          "users,,entries=time_entries",
          "--intent",
          "list users",
        ],
        undefined,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        "option '--relation <binding>' argument 'users,,entries=time_entries' is invalid",
      );
      expect(result.stderr).toContain("--relation bundle cannot contain empty bindings");
    });
  });
});
