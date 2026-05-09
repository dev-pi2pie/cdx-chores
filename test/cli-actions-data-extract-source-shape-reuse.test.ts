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

describe("cli action modules: data extract source-shape reuse", () => {
  test("actionDataExtract reuses an accepted source-shape artifact when it matches exactly", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "messy.xlsx");
      const artifactPath = join(fixtureDir, "shape.json");
      const outputPath = join(fixtureDir, "messy.clean.csv");
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
              issuedAt: "2026-03-18T00:00:00.000Z",
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

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
        sourceShape: toRepoRelativePath(artifactPath),
      });

      expectNoStdout();
      expect(stderr.text).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe(
        "ID,item,status,description\n1001,Starter,active,Initial package\n1002,Expansion,paused,Requires follow-up\n1003,Renewal,active,Ready to ship\n1004,Archive,draft,Awaiting approval\n",
      );
    });
  });

  test("actionDataExtract reuses a body-start-row-only source-shape artifact to replay source interpretation", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      seedStackedMergedBandFixture(fixtureDir);
      const inputPath = join(fixtureDir, "stacked-merged-band.xlsx");
      const artifactPath = join(fixtureDir, "shape-body-only.json");
      const outputPath = join(fixtureDir, "stacked-merged-band.body-only.csv");
      await writeFile(
        artifactPath,
        `${JSON.stringify(
          {
            input: {
              format: "excel",
              path: toRepoRelativePath(inputPath),
              source: "Sheet1",
            },
            metadata: {
              artifactType: "data-source-shape",
              issuedAt: "2026-03-20T00:00:00.000Z",
            },
            shape: {
              bodyStartRow: 10,
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
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
        sourceShape: toRepoRelativePath(artifactPath),
      });

      expectNoStdout();
      expect(stderr.text).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      const output = await readFile(outputPath, "utf8");
      expect(output).toContain("B,C,D,E");
      expect(output).toContain("Does the customer need a follow-up call after the outage review?");
      expect(output).toContain("callback");
    });
  });
});
