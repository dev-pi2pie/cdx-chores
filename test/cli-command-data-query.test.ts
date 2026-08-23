import {
  writeFile,
  join,
  describe,
  expect,
  test,
  REPO_ROOT,
  runCli,
  withTempFixtureDir,
} from "./data-query/commands/support";

describe("CLI data query command basic formats", () => {
  test("queries headerless CSV input end to end with normalized placeholder names", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "no-head.csv");
      await writeFile(inputPath, "1,Ada,active,2026-03-01\n2,Bob,paused,2026-03-02\n", "utf8");

      const result = runCli([
        "data",
        "query",
        inputPath.slice(REPO_ROOT.length + 1),
        "--sql",
        "select column_1, column_2, column_3, column_4 from file order by column_1",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Visible columns: column_1, column_2, column_3, column_4");
      expect(result.stdout).toContain("Ada");
      expect(result.stdout).not.toContain("column0");
      expect(result.stdout).not.toContain("column1");
    });
  });

  test("queries CSV input with explicit columnN headers without renaming them", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "literal-column-names.csv");
      await writeFile(inputPath, "column1,column2\n1001,active\n1002,paused\n", "utf8");

      const result = runCli([
        "data",
        "query",
        inputPath.slice(REPO_ROOT.length + 1),
        "--sql",
        "select column1, column2 from file order by column1",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Visible columns: column1, column2");
      expect(result.stdout).toContain("1001    | active");
      expect(result.stdout).not.toContain("column_2");
      expect(result.stdout).not.toContain("column_3");
    });
  });
});
