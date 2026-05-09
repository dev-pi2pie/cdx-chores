import {
  readFile,
  writeFile,
  join,
  describe,
  expect,
  test,
  createHeaderSuggestionStub,
  seedStackedMergedBandFixture,
  REPO_ROOT,
  runCli,
  toRepoRelativePath,
  withTempFixtureDir,
  fixturePath,
  duckdbReady,
  excelReady,
} from "./cli-command-data-extract.helpers";

describe("CLI data extract command review artifacts", () => {
  test("writes a reviewed header-mapping artifact and stops before extraction", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "generic.csv");
      const artifactPath = join(fixtureDir, "header-map.json");
      const promptPath = join(fixtureDir, "header-suggest-prompt.txt");
      await writeFile(inputPath, "column_1,column_2\n1001,active\n1002,paused\n", "utf8");
      const stubPath = await createHeaderSuggestionStub({
        promptPath,
        suggestions: [
          { from: "column_1", to: "id" },
          { from: "column_2", to: "status" },
        ],
        workingDirectory: fixtureDir,
      });

      const result = runCli(
        [
          "data",
          "extract",
          toRepoRelativePath(inputPath),
          "--codex-suggest-headers",
          "--write-header-mapping",
          toRepoRelativePath(artifactPath),
        ],
        REPO_ROOT,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Suggested headers");
      expect(result.stdout).toContain("column_1 -> id");
      expect(result.stdout).toContain("column_2 -> status");
      expect(result.stderr).toContain("--header-mapping");
      expect(result.stderr).toContain("--output");
      expect(result.stderr).toContain("data extract");

      const prompt = await readFile(promptPath, "utf8");
      expect(prompt).toContain("Detected format: csv");
      expect(prompt).toContain("1. column_1 (BIGINT) samples: 1001, 1002");

      const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as {
        input: { format: string; path: string };
        mappings: Array<{ from: string; inferredType?: string; sample?: string; to: string }>;
      };
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

  test("reuses an accepted header-mapping artifact end to end", async () => {
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

      const result = runCli([
        "data",
        "extract",
        toRepoRelativePath(inputPath),
        "--header-mapping",
        toRepoRelativePath(artifactPath),
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe("id,status\n1001,active\n1002,paused\n");
    });
  });
});
