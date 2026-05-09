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

describe("cli action modules: data extract source-shape review", () => {
  test("actionDataExtract writes a reviewed source-shape artifact and stops before materialization", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "messy.xlsx");
      const artifactPath = join(fixtureDir, "shape.json");

      const { runtime, stdout, stderr } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        codexSuggestShape: true,
        input: toRepoRelativePath(inputPath),
        overwrite: true,
        source: "Summary",
        sourceShapeSuggestionRunner: async ({ prompt }) => {
          expect(prompt).toContain("Selected sheet: Summary");
          expect(prompt).toContain("Current range: (whole sheet)");
          expect(prompt).toContain("Worksheet non-empty row summaries:");
          expect(prompt).toContain('B2="Quarterly Operations Report"');
          return JSON.stringify({
            header_row: 7,
            range: "B2:E11",
            reasoning_summary: "The clean table starts at worksheet row 7 and spans columns B:E.",
          });
        },
        writeSourceShape: toRepoRelativePath(artifactPath),
      });

      expect(stdout.text).toContain("Suggested source shape");
      expect(stdout.text).toContain("--range B2:E11");
      expect(stdout.text).toContain("--header-row 7");
      expect(stdout.text).toContain("The clean table starts at worksheet row 7");
      expect(stderr.text).toContain(`Wrote source shape: ${toRepoRelativePath(artifactPath)}`);
      expect(stderr.text).toContain("--source-shape");
      expect(stderr.text).toContain("--output");

      const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as {
        input: { format: string; path: string; source: string };
        metadata: { artifactType: string; issuedAt: string };
        shape: { headerRow: number; range: string };
        version: number;
      };
      expect(artifact).toEqual({
        input: {
          format: "excel",
          path: toRepoRelativePath(inputPath),
          source: "Summary",
        },
        metadata: {
          artifactType: "data-source-shape",
          issuedAt: "2026-02-25T00:00:00.000Z",
        },
        shape: {
          headerRow: 7,
          range: "B2:E11",
        },
        version: 1,
      });
    });
  });

  test("actionDataExtract shows tty Codex thinking status while reviewing a source shape", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "messy.xlsx");
      const artifactPath = join(fixtureDir, "shape.json");
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

      await actionDataExtract(runtime, {
        codexSuggestShape: true,
        input: toRepoRelativePath(inputPath),
        overwrite: true,
        source: "Summary",
        sourceShapeSuggestionRunner: async () => {
          await Bun.sleep(420);
          return JSON.stringify({
            header_row: 7,
            range: "B2:E11",
            reasoning_summary: "The clean table starts at worksheet row 7 and spans columns B:E.",
          });
        },
        writeSourceShape: toRepoRelativePath(artifactPath),
      });

      expect(stdout.text).toContain("Thinking");
      expect(stdout.text).toContain("Inspecting worksheet structure");
      expect(stdout.text).toContain("Waiting for Codex source-shape suggestions");
      expect(stdout.text).toContain("Suggested source shape");
      expect(stdout.text).toContain("\r\x1b[2K");
    });
  });

  test("actionDataExtract writes a reviewed source-shape artifact that includes bodyStartRow", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      seedStackedMergedBandFixture(fixtureDir);
      const inputPath = join(fixtureDir, "stacked-merged-band.xlsx");
      const artifactPath = join(fixtureDir, "shape-with-body-start.json");

      const { runtime, stdout, stderr } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        codexSuggestShape: true,
        input: toRepoRelativePath(inputPath),
        overwrite: true,
        source: "Sheet1",
        sourceShapeSuggestionRunner: async ({ prompt }) => {
          expect(prompt).toContain("Selected sheet: Sheet1");
          expect(prompt).toContain("Current body start row: (not set)");
          expect(prompt).toContain("Worksheet non-empty row summaries:");
          return JSON.stringify({
            body_start_row: 10,
            header_row: 7,
            range: "B7:BR20",
            reasoning_summary:
              "The logical table uses row 7 for headers and row 10 for the first true body records.",
          });
        },
        writeSourceShape: toRepoRelativePath(artifactPath),
      });

      expect(stdout.text).toContain("Suggested source shape");
      expect(stdout.text).toContain("--range B7:BR20");
      expect(stdout.text).toContain("--body-start-row 10");
      expect(stdout.text).toContain("--header-row 7");
      expect(stderr.text).toContain(`Wrote source shape: ${toRepoRelativePath(artifactPath)}`);
      expect(stderr.text).toContain("--codex-suggest-headers");

      const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as {
        shape: { bodyStartRow: number; headerRow: number; range: string };
      };
      expect(artifact.shape).toEqual({
        bodyStartRow: 10,
        headerRow: 7,
        range: "B7:BR20",
      });
    });
  });

  test("actionDataExtract writes a reviewed source-shape artifact when body-start-row is the only deterministic change", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      seedStackedMergedBandFixture(fixtureDir);
      const inputPath = join(fixtureDir, "stacked-merged-band.xlsx");
      const artifactPath = join(fixtureDir, "shape-body-only.json");

      const { runtime, stdout, stderr } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        codexSuggestShape: true,
        input: toRepoRelativePath(inputPath),
        overwrite: true,
        source: "Sheet1",
        sourceShapeSuggestionRunner: async () =>
          JSON.stringify({
            body_start_row: 10,
            header_row: null,
            range: null,
            reasoning_summary:
              "The current sheet selection is fine; only the logical body boundary needs to move to worksheet row 10.",
          }),
        writeSourceShape: toRepoRelativePath(artifactPath),
      });

      expect(stdout.text).toContain("Suggested source shape");
      expect(stdout.text).toContain("--body-start-row 10");
      expect(stdout.text).not.toContain("--range ");
      expect(stdout.text).not.toContain("--header-row ");
      expect(stderr.text).toContain(`Wrote source shape: ${toRepoRelativePath(artifactPath)}`);
      expect(stderr.text).toContain("--source-shape");
      expect(stderr.text).toContain("--codex-suggest-headers");

      const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as {
        shape: { bodyStartRow: number };
      };
      expect(artifact.shape).toEqual({
        bodyStartRow: 10,
      });
    });
  });
});
