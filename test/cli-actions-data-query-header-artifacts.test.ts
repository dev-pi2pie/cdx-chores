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

describe("cli action modules: data query header artifacts", () => {
  test("actionDataQuery writes a reviewed header-mapping artifact and stops before SQL execution", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "generic.csv");
      const artifactPath = join(fixtureDir, "header-map.json");
      await writeFile(inputPath, "column_1,column_2\n1001,active\n1002,paused\n", "utf8");

      const { runtime, stdout, stderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        codexSuggestHeaders: true,
        headerSuggestionRunner: async ({ prompt }) => {
          expect(prompt).toContain("Detected format: csv");
          expect(prompt).toContain("1. column_1 (BIGINT) samples: 1001, 1002");
          expect(prompt).toContain("2. column_2 (VARCHAR) samples: active, paused");
          return JSON.stringify({
            suggestions: [
              { from: "column_1", to: "id" },
              { from: "column_2", to: "status" },
            ],
          });
        },
        input: toRepoRelativePath(inputPath),
        overwrite: true,
        writeHeaderMapping: toRepoRelativePath(artifactPath),
      });

      expect(stdout.text).toContain("Suggested headers");
      expect(stdout.text).toContain("column_1 -> id");
      expect(stdout.text).toContain("column_2 -> status");
      expect(stderr.text).toContain(`Wrote header mapping: ${toRepoRelativePath(artifactPath)}`);
      expect(stderr.text).toContain("--header-mapping");
      expect(stderr.text).toContain("--sql");

      const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as {
        input: { format: string; path: string };
        mappings: Array<{ from: string; inferredType?: string; sample?: string; to: string }>;
        metadata: { artifactType: string; issuedAt: string };
        version: number;
      };
      expect(artifact.version).toBe(1);
      expect(artifact.metadata.artifactType).toBe("data-header-mapping");
      expect(artifact.input).toEqual({
        format: "csv",
        path: toRepoRelativePath(inputPath),
      });
      expect(artifact.mappings).toEqual([
        { from: "column_1", inferredType: "BIGINT", sample: "1001", to: "id" },
        { from: "column_2", inferredType: "VARCHAR", sample: "active", to: "status" },
      ]);
    });
  });

  test("actionDataQuery forwards --install-missing-extension when reviewed header suggestions inspect extension-backed inputs", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const artifactPath = join(fixtureDir, "header-map.json");
      const collectedOptions: Array<{
        installMissingExtension?: boolean;
        statusStream?: NodeJS.WritableStream;
      }> = [];
      const { runtime, stderr } = createActionTestRuntime();

      await actionDataQuery(runtime, {
        codexSuggestHeaders: true,
        headerSuggestionRunner: async () =>
          JSON.stringify({
            suggestions: [{ from: "column_1", to: "id" }],
          }),
        input: toRepoRelativePath(dataQueryFixturePath("multi.xlsx")),
        installMissingExtension: true,
        overwrite: true,
        source: "Summary",
        sourceIntrospectionCollector: async (
          _connection,
          _inputPath,
          _format,
          _shape,
          _sampleRowLimit,
          options = {},
        ) => {
          collectedOptions.push({
            installMissingExtension: options.installMissingExtension,
            statusStream: options.statusStream,
          });
          return {
            columns: [{ name: "column_1", type: "BIGINT" }],
            sampleRows: [{ column_1: "1" }],
            selectedSource: "Summary",
            truncated: false,
          };
        },
        writeHeaderMapping: toRepoRelativePath(artifactPath),
      });

      expect(collectedOptions).toEqual([
        {
          installMissingExtension: true,
          statusStream: runtime.stderr,
        },
      ]);
      expect(stderr.text).toContain(`Wrote header mapping: ${toRepoRelativePath(artifactPath)}`);
    });
  });

  test("actionDataQuery reuses an accepted header-mapping artifact when it matches exactly", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "generic.csv");
      const artifactPath = join(fixtureDir, "header-map.json");
      await writeFile(inputPath, "column_1,column_2\n1001,active\n1002,paused\n", "utf8");
      await writeFile(
        artifactPath,
        `${JSON.stringify(
          {
            input: {
              format: "csv",
              path: toRepoRelativePath(inputPath),
            },
            mappings: [
              { from: "column_1", to: "id" },
              { from: "column_2", to: "status" },
            ],
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

      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        headerMapping: toRepoRelativePath(artifactPath),
        input: toRepoRelativePath(inputPath),
        sql: "select id, status from file order by id",
      });

      expectNoStderr();
      expect(stdout.text).toContain("Visible columns: id, status");
      expect(stdout.text).toContain("1001 | active");
      expect(stdout.text).not.toContain("column_1");
      expect(stdout.text).not.toContain("column_2");
    });
  });
});
