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

describe("CLI data query codex command single-source", () => {
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
