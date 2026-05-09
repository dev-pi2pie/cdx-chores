/* oxlint-disable no-unused-vars */
import {
  describe,
  expect,
  test,
  readFile,
  writeFile,
  join,
  actionDataExtract,
  createActionTestRuntime,
  expectCliError,
  seedDataExtractFixtures,
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
} from "./cli-actions-data-extract.helpers";

describe("cli action modules: data extract validation", () => {
  test("actionDataExtract requires --output for materialization runs", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n", "utf8");

      await expectCliError(
        () =>
          actionDataExtract(createActionTestRuntime().runtime, {
            input: toRepoRelativePath(inputPath),
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--output is required for data extract materialization runs",
        },
      );
    });
  });

  test("actionDataExtract rejects unsupported output extensions", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n", "utf8");

      await expectCliError(
        () =>
          actionDataExtract(createActionTestRuntime().runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(join(fixtureDir, "people.txt")),
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Unsupported --output extension",
        },
      );
    });
  });

  test("actionDataExtract rejects --codex-suggest-headers with --output", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n", "utf8");

      await expectCliError(
        () =>
          actionDataExtract(createActionTestRuntime().runtime, {
            codexSuggestHeaders: true,
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(join(fixtureDir, "people.json")),
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--codex-suggest-headers stops after writing a header mapping artifact",
        },
      );
    });
  });

  test("actionDataExtract rejects --codex-suggest-shape with --output", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      await expectCliError(
        () =>
          actionDataExtract(createActionTestRuntime().runtime, {
            codexSuggestShape: true,
            input: "test/fixtures/data-query/multi.xlsx",
            output: toRepoRelativePath(join(fixtureDir, "summary.json")),
            source: "Summary",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--codex-suggest-shape stops after writing a source shape artifact",
        },
      );
    });
  });

  test("actionDataExtract rejects --codex-suggest-shape with --header-row", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();

    await expectCliError(
      () =>
        actionDataExtract(runtime, {
          codexSuggestShape: true,
          headerRow: 7,
          input: "test/fixtures/data-query/multi.xlsx",
          source: "Summary",
        }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "--codex-suggest-shape cannot be used together with --header-row",
      },
    );

    expectNoOutput();
  });

  test("actionDataExtract rejects --source-shape for non-Excel inputs", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
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
              issuedAt: "2026-03-18T00:00:00.000Z",
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

      await expectCliError(
        () =>
          actionDataExtract(createActionTestRuntime().runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(join(fixtureDir, "people.json")),
            sourceShape: toRepoRelativePath(artifactPath),
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--source-shape is only valid for Excel extract inputs",
        },
      );
    });
  });

  test("actionDataExtract enforces explicit overwrite behavior", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      const outputPath = join(fixtureDir, "people.clean.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n", "utf8");
      await writeFile(outputPath, "existing\n", "utf8");

      await expectCliError(
        () =>
          actionDataExtract(createActionTestRuntime().runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(outputPath),
          }),
        {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
          messageIncludes: "Output file already exists",
        },
      );
    });
  });
});
