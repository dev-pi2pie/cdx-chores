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

describe("cli action modules: data query header modes", () => {
  test("actionDataQuery normalizes headerless CSV placeholder names to the shared column_n contract", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "no-head.csv");
      await writeFile(inputPath, "1,Ada,active,2026-03-01\n2,Bob,paused,2026-03-02\n", "utf8");

      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        input: toRepoRelativePath(inputPath),
        sql: "select column_1, column_2, column_3, column_4 from file order by column_1",
      });

      expectNoStderr();
      expect(stdout.text).toContain(`Input: ${toRepoRelativePath(inputPath)}`);
      expect(stdout.text).toContain("Visible columns: column_1, column_2, column_3, column_4");
      expect(stdout.text).toContain("1        | Ada");
      expect(stdout.text).not.toContain("column0");
      expect(stdout.text).not.toContain("column1");
    });
  });

  test("actionDataQuery honors explicit --no-header when DuckDB would otherwise treat row 1 as headers", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "header-row-as-data.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n2,Bob\n", "utf8");

      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        input: toRepoRelativePath(inputPath),
        noHeader: true,
        sql: "select column_1, column_2 from file order by column_1",
      });

      expectNoStderr();
      expect(stdout.text).toContain("Visible columns: column_1, column_2");
      expect(stdout.text).toContain("id       | name");
      expect(stdout.text).toContain("1        | Ada");
    });
  });

  test("actionDataQuery preserves explicit CSV headers that match columnN patterns", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "literal-column-names.csv");
      await writeFile(inputPath, "column1,column2\n1001,active\n1002,paused\n", "utf8");

      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        input: toRepoRelativePath(inputPath),
        sql: "select column1, column2 from file order by column1",
      });

      expectNoStderr();
      expect(stdout.text).toContain("Visible columns: column1, column2");
      expect(stdout.text).toContain("1001    | active");
      expect(stdout.text).not.toContain("column_2");
      expect(stdout.text).not.toContain("column_3");
    });
  });

  test("actionDataQuery suggests semantic headers for headerless CSV inputs using normalized placeholder names", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "no-head.csv");
      const artifactPath = join(fixtureDir, "header-map.json");
      await writeFile(inputPath, "1,Ada,active,2026-03-01\n2,Bob,paused,2026-03-02\n", "utf8");

      const { runtime, stdout, stderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        codexSuggestHeaders: true,
        headerSuggestionRunner: async ({ prompt }) => {
          expect(prompt).toContain("1. column_1 (BIGINT) samples: 1, 2");
          expect(prompt).toContain("2. column_2 (VARCHAR) samples: Ada, Bob");
          expect(prompt).toContain("3. column_3 (VARCHAR) samples: active, paused");
          expect(prompt).toContain("4. column_4 (DATE) samples: 2026-03-01, 2026-03-02");
          return JSON.stringify({
            suggestions: [
              { from: "column_1", to: "id" },
              { from: "column_2", to: "name" },
              { from: "column_3", to: "status" },
              { from: "column_4", to: "created_at" },
            ],
          });
        },
        input: toRepoRelativePath(inputPath),
        overwrite: true,
        writeHeaderMapping: toRepoRelativePath(artifactPath),
      });

      expect(stdout.text).toContain("column_1 -> id");
      expect(stdout.text).toContain("column_4 -> created_at");
      expect(stderr.text).toContain(`Wrote header mapping: ${toRepoRelativePath(artifactPath)}`);
    });
  });

  test("actionDataQuery carries explicit no-header into reviewed header-mapping artifacts and follow-up guidance", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "no-head.csv");
      const artifactPath = join(fixtureDir, "header-map.json");
      await writeFile(inputPath, "1,Ada,active\n2,Bob,paused\n", "utf8");

      const { runtime, stdout, stderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        codexSuggestHeaders: true,
        headerSuggestionRunner: async () =>
          JSON.stringify({
            suggestions: [
              { from: "column_1", to: "id" },
              { from: "column_2", to: "name" },
              { from: "column_3", to: "status" },
            ],
          }),
        input: toRepoRelativePath(inputPath),
        noHeader: true,
        overwrite: true,
        writeHeaderMapping: toRepoRelativePath(artifactPath),
      });

      expect(stdout.text).toContain("column_1 -> id");
      expect(stderr.text).toContain("--no-header");

      const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as {
        input: { format: string; noHeader?: boolean; path: string };
      };
      expect(artifact.input).toEqual({
        format: "csv",
        noHeader: true,
        path: toRepoRelativePath(inputPath),
      });
    });
  });

  test("actionDataQuery shows tty Codex thinking status while reviewing headers", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "generic.csv");
      const artifactPath = join(fixtureDir, "header-map.json");
      await writeFile(inputPath, "column_1,column_2\n1001,active\n1002,paused\n", "utf8");
      const stdout = new TtyCaptureStream();
      const stderr = new TtyCaptureStream();
      const runtime = {
        colorEnabled: true,
        cwd: REPO_ROOT,
        displayPathStyle: "relative" as const,
        now: () => new Date("2026-02-25T00:00:00.000Z"),
        platform: process.platform,
        stderr: stderr as unknown as NodeJS.WritableStream,
        stdin: process.stdin,
        stdout: stdout as unknown as NodeJS.WritableStream,
      };

      await actionDataQuery(runtime, {
        codexSuggestHeaders: true,
        headerSuggestionRunner: async () => {
          await Bun.sleep(420);
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

      expect(stdout.text).toContain("Thinking");
      expect(stdout.text).toContain("Inspecting shaped source");
      expect(stdout.text).toContain("Waiting for Codex header suggestions");
      expect(stdout.text).toContain("Suggested headers");
      expect(stdout.text).toContain("\r\x1b[2K");
    });
  });
});
