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

describe("cli action modules: data extract header artifacts", () => {
  test("actionDataExtract writes a reviewed header-mapping artifact and stops before materialization", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "generic.csv");
      const artifactPath = join(fixtureDir, "header-map.json");
      await writeFile(inputPath, "column_1,column_2\n1001,active\n1002,paused\n", "utf8");

      const { runtime, stdout, stderr } = createActionTestRuntime();
      await actionDataExtract(runtime, {
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
      expect(stderr.text).toContain("data extract");
      expect(stderr.text).toContain("--header-mapping");
      expect(stderr.text).toContain("--output");

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

  test("actionDataExtract reuses an accepted header-mapping artifact when it matches exactly", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "generic.csv");
      const artifactPath = join(fixtureDir, "header-map.json");
      const outputPath = join(fixtureDir, "generic.clean.csv");
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

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        headerMapping: toRepoRelativePath(artifactPath),
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
      });

      expectNoStdout();
      expect(stderr.text).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe("id,status\n1001,active\n1002,paused\n");
    });
  });
});
