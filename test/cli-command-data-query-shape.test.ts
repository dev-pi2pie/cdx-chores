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

describe("CLI data query command Excel shape", () => {
  test("queries Excel input end to end when the extension is ready", () => {
    if (!excelReady) {
      return;
    }

    const result = runCli([
      "data",
      "query",
      fixturePath("multi.xlsx"),
      "--source",
      "Summary",
      "--sql",
      "select id, name from file order by id",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Format: excel");
    expect(result.stdout).toContain("Source: Summary");
    expect(result.stdout).toContain("1   | Ada");
  });

  test("queries an explicit Excel range end to end when the extension is ready", () => {
    if (!excelReady) {
      return;
    }

    const result = runCli([
      "data",
      "query",
      fixturePath("multi.xlsx"),
      "--source",
      "Summary",
      "--range",
      "A1:B3",
      "--sql",
      "select * from file order by id",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Format: excel");
    expect(result.stdout).toContain("Source: Summary");
    expect(result.stdout).toContain("Range: A1:B3");
    expect(result.stdout).toContain("Visible columns: id, name");
    expect(result.stdout).not.toContain("status");
  });

  test("queries an explicit Excel range plus header-row end to end when the extension is ready", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "messy.xlsx");

      const result = runCli([
        "data",
        "query",
        inputPath.slice(REPO_ROOT.length + 1),
        "--source",
        "Summary",
        "--range",
        "B2:E11",
        "--header-row",
        "7",
        "--sql",
        "select ID, item, status from file order by ID",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Format: excel");
      expect(result.stdout).toContain("Source: Summary");
      expect(result.stdout).toContain("Range: B2:E11");
      expect(result.stdout).toContain("Header row: 7");
      expect(result.stdout).toContain("Visible columns: ID, item, status");
      expect(result.stdout).toContain("1001 | Starter");
      expect(result.stdout).not.toContain("Quarterly Operations Report");
    });
  });

  test("queries the stacked merged-band workbook end to end when body-start-row is provided", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      seedStackedMergedBandFixture(fixtureDir);
      const inputPath = join(fixtureDir, "stacked-merged-band.xlsx");

      const result = runCli([
        "data",
        "query",
        inputPath.slice(REPO_ROOT.length + 1),
        "--source",
        "Sheet1",
        "--range",
        "B7:BR20",
        "--body-start-row",
        "10",
        "--header-row",
        "7",
        "--sql",
        "select id, question, status, notes from file order by id",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Source: Sheet1");
      expect(result.stdout).toContain("Range: B7:BR20");
      expect(result.stdout).toContain("Body start row: 10");
      expect(result.stdout).toContain("Header row: 7");
      expect(result.stdout).toContain("Visible columns: id, question, status, notes");
      expect(result.stdout).toContain("1   | Does the customer need");
      expect(result.stdout).toContain("11  | Should the account remain");
    });
  });
});
