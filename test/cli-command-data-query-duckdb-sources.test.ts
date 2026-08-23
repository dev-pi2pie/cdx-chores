import {
  describe,
  expect,
  test,
  seedDuckDbWorkspaceFixture,
  seedSingleTableDuckDbFixture,
  runCli,
  toRepoRelativePath,
  withTempFixtureDir,
  duckdbReady,
} from "./data-query/commands/support";

describe("CLI data query command DuckDB sources", () => {
  test("infers the only DuckDB source when the file has one table", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("query-duckdb-cli", async (fixtureDir) => {
      const inputPath = await seedSingleTableDuckDbFixture(fixtureDir);

      const result = runCli([
        "data",
        "query",
        toRepoRelativePath(inputPath),
        "--sql",
        "select id, name from file order by id",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Format: duckdb");
      expect(result.stdout).toContain("Source: users");
      expect(result.stdout).toContain("1   | Ada");
      expect(result.stdout).toContain("2   | Bob");
    });
  });

  test("queries DuckDB workspace relations end to end", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("query-duckdb-cli", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);

      const result = runCli([
        "data",
        "query",
        toRepoRelativePath(inputPath),
        "--relation",
        "users",
        "--relation",
        "events=analytics.events",
        "--sql",
        "select users.name, events.event_type from users join events on users.id = events.user_id order by events.id",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Format: duckdb");
      expect(result.stdout).toContain("Relations: users, events");
      expect(result.stdout).toContain("Ada  | login");
    });
  });
});
