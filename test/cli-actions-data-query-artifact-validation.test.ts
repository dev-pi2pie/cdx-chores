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

describe("cli action modules: data query artifact validation", () => {
  test("actionDataQuery rejects --source-shape for non-Excel inputs", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      const artifactPath = join(fixtureDir, "shape.json");
      await writeFile(inputPath, "id,name\n1,Ada\n", "utf8");
      await writeFile(
        artifactPath,
        `${JSON.stringify(
          {
            input: {
              format: "excel",
              path: "test/fixtures/data-query/multi.xlsx",
              source: "Summary",
            },
            metadata: {
              artifactType: "data-source-shape",
              issuedAt: "2026-03-20T00:00:00.000Z",
            },
            shape: {
              range: "A1:B3",
            },
            version: 1,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );

      const { runtime, expectNoOutput } = createActionTestRuntime();
      await expectCliError(
        () =>
          actionDataQuery(runtime, {
            input: toRepoRelativePath(inputPath),
            sourceShape: toRepoRelativePath(artifactPath),
            sql: "select * from file",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--source-shape is only valid for Excel query inputs",
        },
      );

      expectNoOutput();
    });
  });

  test("actionDataQuery rejects explicit shape flags when --source-shape is provided", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();

    await expectCliError(
      () =>
        actionDataQuery(runtime, {
          input: "test/fixtures/data-query/multi.xlsx",
          range: "A1:B3",
          sourceShape: "shape.json",
          sql: "select * from file",
        }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "--source-shape cannot be used together with --range",
      },
    );

    expectNoOutput();
  });

  test("actionDataQuery rejects mismatched header-mapping artifacts", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "generic.csv");
      const artifactPath = join(fixtureDir, "header-map.json");
      await writeFile(inputPath, "column_1,column_2\n1001,active\n", "utf8");
      await writeFile(
        artifactPath,
        `${JSON.stringify(
          {
            input: {
              format: "csv",
              path: "examples/playground/other.csv",
            },
            mappings: [{ from: "column_1", to: "id" }],
            metadata: {
              artifactType: "data-header-mapping",
              issuedAt: "2026-03-18T00:00:00.000Z",
            },
            version: 1,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );

      const { runtime, expectNoOutput } = createActionTestRuntime();
      await expectCliError(
        () =>
          actionDataQuery(runtime, {
            headerMapping: toRepoRelativePath(artifactPath),
            input: toRepoRelativePath(inputPath),
            sql: "select * from file",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "does not match the current input context exactly",
        },
      );

      expectNoOutput();
    });
  });

  test("actionDataQuery rejects mismatched source-shape artifacts", async () => {
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
              path: "examples/playground/other.xlsx",
              source: "Summary",
            },
            metadata: {
              artifactType: "data-source-shape",
              issuedAt: "2026-03-20T00:00:00.000Z",
            },
            shape: {
              range: "B2:E11",
            },
            version: 1,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );

      const { runtime, expectNoOutput } = createActionTestRuntime();
      await expectCliError(
        () =>
          actionDataQuery(runtime, {
            input: toRepoRelativePath(inputPath),
            sourceShape: toRepoRelativePath(artifactPath),
            sql: "select * from file",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Source shape artifact does not match the current input context exactly",
        },
      );

      expectNoOutput();
    });
  });
});
