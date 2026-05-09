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

describe("cli action modules: data query option validation", () => {
  test("actionDataQuery rejects --json with --output", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n", "utf8");
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionDataQuery(runtime, {
            input: toRepoRelativePath(inputPath),
            json: true,
            output: toRepoRelativePath(join(fixtureDir, "people.json")),
            sql: "select * from file",
          }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "--json cannot be used together" },
      );

      expectNoOutput();
    });
  });

  test("actionDataQuery rejects --pretty without JSON output", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n", "utf8");
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionDataQuery(runtime, {
            input: toRepoRelativePath(inputPath),
            pretty: true,
            sql: "select * from file",
          }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "--pretty requires either --json" },
      );

      expectNoOutput();
    });
  });

  test("actionDataQuery rejects unsupported output extensions", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n", "utf8");
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionDataQuery(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(join(fixtureDir, "people.txt")),
            sql: "select * from file",
          }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "Unsupported --output extension" },
      );

      expectNoOutput();
    });
  });

  test("actionDataQuery rejects --install-missing-extension for built-in formats", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n", "utf8");
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionDataQuery(runtime, {
            input: toRepoRelativePath(inputPath),
            installMissingExtension: true,
            sql: "select * from file",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes:
            "--install-missing-extension is only valid for extension-backed query formats",
        },
      );

      expectNoOutput();
    });
  });

  test("actionDataQuery requires source for SQLite inputs", async () => {
    if (!sqliteReady) {
      return;
    }

    const { runtime, expectNoOutput } = createActionTestRuntime();
    await expectCliError(
      () =>
        actionDataQuery(runtime, {
          input: toRepoRelativePath(dataQueryFixturePath("multi.sqlite")),
          sql: "select * from file",
        }),
      { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "--source is required for SQLite" },
    );

    expectNoOutput();
  });

  test("actionDataQuery rejects source for single-object inputs", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n", "utf8");
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionDataQuery(runtime, {
            input: toRepoRelativePath(inputPath),
            source: "sheet1",
            sql: "select * from file",
          }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "--source is not valid for CSV" },
      );

      expectNoOutput();
    });
  });

  test("actionDataQuery rejects --range for non-Excel inputs", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n", "utf8");
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionDataQuery(runtime, {
            input: toRepoRelativePath(inputPath),
            range: "A1:B2",
            sql: "select * from file",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--range is only valid for Excel query inputs",
        },
      );

      expectNoOutput();
    });
  });
});
