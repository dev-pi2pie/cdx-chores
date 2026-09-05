import { requireNativePrerequisites } from "../../helpers/native-prerequisites";
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
  fixturePath,
  createHeaderSuggestionStub,
} from "./support";

describe("CLI data query command DuckDB sources", () => {
  test("queries DuckDB-file input end to end", async () => {
    await requireNativePrerequisites("duckdb");

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

  test("queries the main-schema DuckDB file table directly", async () => {
    await requireNativePrerequisites("duckdb");

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

  test("allows bare file bindings in DuckDB workspace mode", async () => {
    await requireNativePrerequisites("duckdb");

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
    await requireNativePrerequisites("duckdb");

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
    await requireNativePrerequisites("duckdb");

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
