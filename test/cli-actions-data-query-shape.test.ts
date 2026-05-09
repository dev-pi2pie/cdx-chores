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

describe("cli action modules: data query source shape", () => {
  test("actionDataQuery applies Excel range shaping before querying", async () => {
    if (!excelReady) {
      return;
    }

    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
    await actionDataQuery(runtime, {
      input: toRepoRelativePath(dataQueryFixturePath("multi.xlsx")),
      range: "A1:B3",
      source: "Summary",
      sql: "select * from file order by id",
    });

    expectNoStderr();
    expect(stdout.text).toContain("Format: excel");
    expect(stdout.text).toContain("Source: Summary");
    expect(stdout.text).toContain("Range: A1:B3");
    expect(stdout.text).toContain("Visible columns: id, name");
    expect(stdout.text).not.toContain("status");
  });

  test("actionDataQuery applies header-row shaping on top of an explicit Excel range", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "messy.xlsx");

      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        headerRow: 7,
        input: toRepoRelativePath(inputPath),
        range: "B2:E11",
        source: "Summary",
        sql: "select id, item, status from file order by id",
      });

      expectNoStderr();
      expect(stdout.text).toContain(`Input: ${toRepoRelativePath(inputPath)}`);
      expect(stdout.text).toContain("Format: excel");
      expect(stdout.text).toContain("Source: Summary");
      expect(stdout.text).toContain("Range: B2:E11");
      expect(stdout.text).toContain("Header row: 7");
      expect(stdout.text).toContain("Visible columns: ID, item, status");
      expect(stdout.text).toContain("1001 | Starter");
      expect(stdout.text).not.toContain("Quarterly Operations Report");
    });
  });

  test("actionDataQuery tolerates shaped Excel header-band rows when the first data rows are blank", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "header-band.xlsx");

      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        headerRow: 7,
        input: toRepoRelativePath(inputPath),
        range: "B7:E12",
        source: "Summary",
        sql: "select ID, question, status from file order by ID",
      });

      expectNoStderr();
      expect(stdout.text).toContain(`Input: ${toRepoRelativePath(inputPath)}`);
      expect(stdout.text).toContain("Format: excel");
      expect(stdout.text).toContain("Source: Summary");
      expect(stdout.text).toContain("Range: B7:E12");
      expect(stdout.text).toContain("Header row: 7");
      expect(stdout.text).toContain("Visible columns: ID, question, status");
      expect(stdout.text).toContain("101 | Confirm tax residency");
      expect(stdout.text).toContain("102 | Collect withholding certificate");
    });
  });

  test("actionDataQuery materializes the stacked merged-band workbook when body-start-row is provided", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      seedStackedMergedBandFixture(fixtureDir);
      const inputPath = join(fixtureDir, "stacked-merged-band.xlsx");

      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        bodyStartRow: 10,
        headerRow: 7,
        input: toRepoRelativePath(inputPath),
        range: "B7:BR20",
        source: "Sheet1",
        sql: "select id, question, status, notes from file order by id",
      });

      expectNoStderr();
      expect(stdout.text).toContain(`Input: ${toRepoRelativePath(inputPath)}`);
      expect(stdout.text).toContain("Source: Sheet1");
      expect(stdout.text).toContain("Range: B7:BR20");
      expect(stdout.text).toContain("Body start row: 10");
      expect(stdout.text).toContain("Header row: 7");
      expect(stdout.text).toContain("Visible columns: id, question, status, notes");
      expect(stdout.text).toContain("1   | Does the customer need");
      expect(stdout.text).toContain("11  | Should the account remain");
    });
  });

  test("actionDataQuery reuses an accepted source-shape artifact when it matches exactly", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "messy.xlsx");
      const artifactPath = join(fixtureDir, "shape.json");
      await writeFile(
        artifactPath,
        `${JSON.stringify(
          {
            input: {
              format: "excel",
              path: toRepoRelativePath(inputPath),
              source: "Summary",
            },
            metadata: {
              artifactType: "data-source-shape",
              issuedAt: "2026-03-20T00:00:00.000Z",
            },
            shape: {
              headerRow: 7,
              range: "B2:E11",
            },
            version: 1,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );

      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        input: toRepoRelativePath(inputPath),
        sourceShape: toRepoRelativePath(artifactPath),
        sql: "select ID, item, status from file order by ID",
      });

      expectNoStderr();
      expect(stdout.text).toContain("Format: excel");
      expect(stdout.text).toContain("Source: Summary");
      expect(stdout.text).toContain("Range: B2:E11");
      expect(stdout.text).toContain("Header row: 7");
      expect(stdout.text).toContain("Visible columns: ID, item, status");
      expect(stdout.text).toContain("1001 | Starter");
    });
  });
});
