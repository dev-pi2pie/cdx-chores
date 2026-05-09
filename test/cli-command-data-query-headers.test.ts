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

describe("CLI data query command header mapping", () => {
  test("writes a reviewed header-mapping artifact and stops before SQL execution", async () => {
    await withTempFixtureDir("query-header-review", async (fixtureDir) => {
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
          "query",
          inputPath.slice(REPO_ROOT.length + 1),
          "--codex-suggest-headers",
          "--write-header-mapping",
          artifactPath.slice(REPO_ROOT.length + 1),
        ],
        REPO_ROOT,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Suggested headers");
      expect(result.stdout).toContain("column_1 -> id");
      expect(result.stdout).toContain("column_2 -> status");
      expect(result.stderr).toContain("--header-mapping");
      expect(result.stderr).toContain("--sql");

      const prompt = await readFile(promptPath, "utf8");
      expect(prompt).toContain("Detected format: csv");
      expect(prompt).toContain("1. column_1 (BIGINT) samples: 1001, 1002");

      const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as {
        input: { format: string; path: string };
        mappings: Array<{ from: string; inferredType?: string; sample?: string; to: string }>;
      };
      expect(artifact.input).toEqual({
        format: "csv",
        path: inputPath.slice(REPO_ROOT.length + 1),
      });
      expect(artifact.mappings).toEqual([
        { from: "column_1", inferredType: "BIGINT", sample: "1001", to: "id" },
        { from: "column_2", inferredType: "VARCHAR", sample: "active", to: "status" },
      ]);
    });
  });
});
