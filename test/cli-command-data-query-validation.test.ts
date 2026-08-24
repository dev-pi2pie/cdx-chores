import {
  describe,
  expect,
  test,
  seedDuckDbWorkspaceFixture,
  runCli,
  toRepoRelativePath,
  withTempFixtureDir,
  duckdbReady,
  sqliteReady,
  fixturePath,
} from "./data-query/commands/support";

describe("CLI data query command validation and remediation", () => {
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

  test("lists available DuckDB sources when source is missing", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("query-duckdb-cli", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);

      const result = runCli([
        "data",
        "query",
        toRepoRelativePath(inputPath),
        "--sql",
        "select * from file",
      ]);

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("--source is required for DuckDB");
      expect(result.stderr).toContain("analytics.events");
      expect(result.stderr).toContain("file");
      expect(result.stderr).toContain("time_entries");
      expect(result.stderr).toContain("users");
    });
  });

  test("reports unknown DuckDB sources clearly", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("query-duckdb-cli", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);

      const result = runCli([
        "data",
        "query",
        toRepoRelativePath(inputPath),
        "--source",
        "analytics.missing",
        "--sql",
        "select * from file",
      ]);

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("Unknown DuckDB source: analytics.missing");
      expect(result.stderr).toContain("Available sources:");
      expect(result.stderr).toContain("analytics.events");
    });
  });
});
