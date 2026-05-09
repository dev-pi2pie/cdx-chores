/* oxlint-disable no-unused-vars */
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

describe("CLI DuckDB lifecycle commands", () => {
  test("reports managed DuckDB extension state", () => {
    const result = runCli(["data", "duckdb", "doctor"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("cdx-chores data duckdb doctor");
    expect(result.stdout).toContain("DuckDB runtime:");
    expect(result.stdout).toContain("Managed extensions:");
    expect(result.stdout).toContain("sqlite:");
    expect(result.stdout).toContain("excel:");
  });

  test("requires an extension name unless --all-supported is used", () => {
    const result = runCli(["data", "duckdb", "extension", "install"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Extension name is required unless --all-supported is used");
  });
});
