/* oxlint-disable no-unused-vars */
import {
  describe,
  expect,
  test,
  readFile,
  writeFile,
  join,
  actionDataQuery,
  getDisplayWidth,
  createDuckDbConnection,
  listDataQuerySources,
  createActionTestRuntime,
  expectCliError,
  seedDataExtractFixtures,
  seedAmbiguousDuckDbSourceFixture,
  seedDuckDbWorkspaceFixture,
  seedSingleTableDuckDbFixture,
  REPO_ROOT,
  toRepoRelativePath,
  withTempFixtureDir,
  seedStackedMergedBandFixture,
  dataQueryFixturePath,
  TtyCaptureStream,
  duckdbReady,
  excelReady,
  sqliteReady,
} from "./cli-actions-data-query.helpers";

describe("cli action modules: data query table and output", () => {
  test("actionDataQuery renders bounded table output for CSV input", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      await writeFile(inputPath, "id,name,age\n2,Bob,28\n1,Ada,36\n", "utf8");

      const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        input: toRepoRelativePath(inputPath),
        sql: "select id, name from file order by id",
      });

      expectNoStderr();
      expect(stderr.text).toBe("");
      expect(stdout.text).toContain(`Input: ${toRepoRelativePath(inputPath)}`);
      expect(stdout.text).toContain("Format: csv");
      expect(stdout.text).toContain("Result rows: 2");
      expect(stdout.text).toContain("Visible columns: id, name");
      expect(stdout.text).toContain("1   | Ada");
      expect(stdout.text).toContain("2   | Bob");
    });
  });

  test("actionDataQuery honors --input-format override for TSV-like input", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.data");
      await writeFile(inputPath, "id\tname\n1\tAda\n2\tBob\n", "utf8");

      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        input: toRepoRelativePath(inputPath),
        inputFormat: "tsv",
        sql: "select name from file order by id",
      });

      expectNoStderr();
      expect(stdout.text).toContain("Format: tsv");
      expect(stdout.text).toContain("Ada");
      expect(stdout.text).toContain("Bob");
    });
  });

  test("actionDataQuery emits JSON to stdout", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

    await actionDataQuery(runtime, {
      input: "test/fixtures/parquet-preview/basic.parquet",
      json: true,
      sql: "select id, name from file order by id",
    });

    expectNoStderr();
    expect(JSON.parse(stdout.text)).toEqual([
      { id: "1", name: "Ada" },
      { id: "2", name: "Bob" },
      { id: "3", name: "Cyd" },
    ]);
  });

  test("actionDataQuery writes JSON output to file and reports to stderr", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      const outputPath = join(fixtureDir, "people.json");
      await writeFile(inputPath, "id,name\n1,Ada\n2,Bob\n", "utf8");

      const { runtime, stdout, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
        pretty: true,
        sql: "select * from file order by id",
      });

      expectNoStdout();
      expect(stdout.text).toBe("");
      expect(stderr.text).toContain(`Wrote JSON: ${toRepoRelativePath(outputPath)}`);
      expect(stderr.text).toContain("Rows: 2");
      expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual([
        { id: "1", name: "Ada" },
        { id: "2", name: "Bob" },
      ]);
    });
  });

  test("actionDataQuery writes CSV output to file and reports to stderr", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      const outputPath = join(fixtureDir, "people.csv.out.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n2,Bob\n", "utf8");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
        sql: "select name, id from file order by id",
      });

      expectNoStdout();
      expect(stderr.text).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(stderr.text).toContain("Rows: 2");
      expect(await readFile(outputPath, "utf8")).toBe("name,id\nAda,1\nBob,2\n");
    });
  });

  test("actionDataQuery keeps mixed English and CJK table output aligned by display width", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      await writeFile(
        inputPath,
        "word,meaning_zh\nstructure,結構；架構\nhierarchy,階層；等級制度\n",
        "utf8",
      );

      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        input: toRepoRelativePath(inputPath),
        sql: "select word, meaning_zh from file order by word desc",
      });

      expectNoStderr();
      const tableLines = stdout.text
        .split("\n")
        .filter((line) => line.includes("|") || line.includes("+-"));
      expect(tableLines).toHaveLength(4);
      const widths = tableLines.map((line) => getDisplayWidth(line));
      expect(new Set(widths).size).toBe(1);
    });
  });
});
