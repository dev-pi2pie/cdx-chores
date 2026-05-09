import {
  chmod,
  readFile,
  writeFile,
  join,
  describe,
  expect,
  test,
  seedDataExtractFixtures,
  seedAmbiguousDuckDbSourceFixture,
  seedDuckDbQuotedCommaSourceFixture,
  seedDuckDbWorkspaceFixture,
  seedSingleTableDuckDbFixture,
  seedStackedMergedBandFixture,
  REPO_ROOT,
  runCli,
  toRepoRelativePath,
  withTempFixtureDir,
  duckdbReady,
  sqliteReady,
  excelReady,
  fixturePath,
  createHeaderSuggestionStub,
} from "./cli-command-data-query.helpers";

describe("CLI data query command DuckDB sources", () => {
  test("queries DuckDB-file input end to end", async () => {
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
        "users",
        "--sql",
        "select id, name from file order by id",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Format: duckdb");
      expect(result.stdout).toContain("Source: users");
      expect(result.stdout).toContain("1   | Ada");
    });
  });

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

  test("queries the main-schema DuckDB file table directly", async () => {
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
        "file",
        "--sql",
        "select user_id, note from file order by user_id",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Source: file");
      expect(result.stdout).toContain("1       | welcome");
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

  test("allows bare file bindings in DuckDB workspace mode", async () => {
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
        "file",
        "--sql",
        "select user_id, note from file order by user_id",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Format: duckdb");
      expect(result.stdout).toContain("Relations: file");
      expect(result.stdout).toContain("1       | welcome");
    });
  });

  test("accepts quoted DuckDB relation sources that contain commas", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("query-duckdb-cli", async (fixtureDir) => {
      const inputPath = await seedDuckDbQuotedCommaSourceFixture(fixtureDir);

      const result = runCli([
        "data",
        "query",
        toRepoRelativePath(inputPath),
        "--relation",
        'sales="sales,2024"',
        "--sql",
        "select id, team from sales order by id",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Format: duckdb");
      expect(result.stdout).toContain("Relations: sales");
      expect(result.stdout).toContain("1   | Core");
    });
  });

  test("selects quoted main-table DuckDB sources without colliding with schema selectors", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("query-duckdb-cli", async (fixtureDir) => {
      const inputPath = await seedAmbiguousDuckDbSourceFixture(fixtureDir);

      const result = runCli([
        "data",
        "query",
        toRepoRelativePath(inputPath),
        "--source",
        '"analytics.events"',
        "--sql",
        "select id, scope from file",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain('Source: "analytics.events"');
      expect(result.stdout).toContain("1   | main-table");
    });
  });
});
