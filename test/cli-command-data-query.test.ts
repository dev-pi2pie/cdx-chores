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

describe("CLI data query command basic formats", () => {
  test("queries CSV input end to end", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("basic.csv"),
      "--sql",
      "select id, name from file order by id",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Format: csv");
    expect(result.stdout).toContain("1   | Ada");
    expect(result.stdout).toContain("3   | Cyd");
  });

  test("queries TSV input end to end", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("basic.tsv"),
      "--sql",
      "select name, status from file order by id",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Format: tsv");
    expect(result.stdout).toContain("Ada  | active");
  });

  test("queries headerless CSV input end to end with normalized placeholder names", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "no-head.csv");
      await writeFile(inputPath, "1,Ada,active,2026-03-01\n2,Bob,paused,2026-03-02\n", "utf8");

      const result = runCli([
        "data",
        "query",
        inputPath.slice(REPO_ROOT.length + 1),
        "--sql",
        "select column_1, column_2, column_3, column_4 from file order by column_1",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Visible columns: column_1, column_2, column_3, column_4");
      expect(result.stdout).toContain("Ada");
      expect(result.stdout).not.toContain("column0");
      expect(result.stdout).not.toContain("column1");
    });
  });

  test("queries CSV input with explicit --no-header and keeps row 1 in the result set", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "header-row-as-data.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n2,Bob\n", "utf8");

      const result = runCli([
        "data",
        "query",
        inputPath.slice(REPO_ROOT.length + 1),
        "--no-header",
        "--sql",
        "select column_1, column_2 from file order by column_1",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Visible columns: column_1, column_2");
      expect(result.stdout).toContain("column_1 | column_2");
      expect(result.stdout).toContain("id       | name");
      expect(result.stdout).toContain("1        | Ada");
    });
  });

  test("queries CSV input with explicit columnN headers without renaming them", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "literal-column-names.csv");
      await writeFile(inputPath, "column1,column2\n1001,active\n1002,paused\n", "utf8");

      const result = runCli([
        "data",
        "query",
        inputPath.slice(REPO_ROOT.length + 1),
        "--sql",
        "select column1, column2 from file order by column1",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Visible columns: column1, column2");
      expect(result.stdout).toContain("1001    | active");
      expect(result.stdout).not.toContain("column_2");
      expect(result.stdout).not.toContain("column_3");
    });
  });

  test("queries Parquet input end to end", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("basic.parquet"),
      "--sql",
      "select id, name from file order by id",
      "--json",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual([
      { id: "1", name: "Ada" },
      { id: "2", name: "Bob" },
      { id: "3", name: "Cyd" },
    ]);
  });

  test("honors explicit row bounds for bounded table output", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("large.csv"),
      "--sql",
      "select id, note from file order by id",
      "--rows",
      "1",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Result rows: 1+ (bounded)");
    expect(result.stdout).toContain("1   | fixture-row-0001");
    expect(result.stdout).not.toContain("fixture-row-0002");
  });

  test("uses the default bounded row count when --rows is omitted", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("large.csv"),
      "--sql",
      "select id, note from file order by id",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Result rows: 20+ (bounded)");
    expect(result.stdout).toContain("20  | fixture-row-0020");
    expect(result.stdout).not.toContain("fixture-row-0021");
  });
});
