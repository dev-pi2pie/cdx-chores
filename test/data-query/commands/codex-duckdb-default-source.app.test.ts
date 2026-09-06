import { requireNativePrerequisites } from "../../helpers/native-prerequisites";
import {
  join,
  describe,
  expect,
  test,
  seedDuckDbWorkspaceFixture,
  runCli,
  withTempFixtureDir,
  createCodexStub,
} from "./codex-support";

describe("CLI data query codex command single-source", () => {
  test("requires --source for multi-object DuckDB codex single-source runs", async () => {
    await requireNativePrerequisites("duckdb");

    await withTempFixtureDir("query-codex-cli", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);
      const stubPath = await createCodexStub({
        sql: "select * from file",
        summary: "unused",
        workingDirectory: fixtureDir,
      });

      const result = runCli(
        ["data", "query", "codex", inputPath, "--intent", "list rows"],
        undefined,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("--source is required for DuckDB query inputs");
      expect(result.stderr).toContain("analytics.events, file, time_entries, users");
    });
  });
});
