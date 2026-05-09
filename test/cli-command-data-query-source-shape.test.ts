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

describe("CLI data query command source-shape artifacts", () => {
  test("reuses an accepted source-shape artifact end to end", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "messy.xlsx");
      const artifactPath = join(fixtureDir, "shape.json");
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
              issuedAt: "2026-03-20T00:00:00.000Z",
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

      const result = runCli([
        "data",
        "query",
        toRepoRelativePath(inputPath),
        "--source-shape",
        toRepoRelativePath(artifactPath),
        "--sql",
        "select ID, item, status from file order by ID",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Format: excel");
      expect(result.stdout).toContain("Source: Summary");
      expect(result.stdout).toContain("Range: B2:E11");
      expect(result.stdout).toContain("Header row: 7");
      expect(result.stdout).toContain("Visible columns: ID, item, status");
      expect(result.stdout).toContain("1001 | Starter");
    });
  });

  test("lists available Excel sources when source is missing", () => {
    if (!excelReady) {
      return;
    }

    const result = runCli([
      "data",
      "query",
      fixturePath("multi.xlsx"),
      "--sql",
      "select * from file",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--source is required for Excel");
    expect(result.stderr).toContain("Available sources: Summary, RawData");
  });

  test("reports install guidance when Excel is not installed in an isolated HOME", async () => {
    await withTempFixtureDir("query-home-excel", async (tempHome) => {
      const result = runCli(
        [
          "data",
          "query",
          fixturePath("multi.xlsx"),
          "--source",
          "Summary",
          "--sql",
          "select * from file",
        ],
        REPO_ROOT,
        { HOME: tempHome },
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("requires the DuckDB excel extension");
      expect(result.stderr).toContain("Install it explicitly in DuckDB");
    });
  });

  test("rejects explicit shape flags when --source-shape is provided", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("multi.xlsx"),
      "--source-shape",
      "shape.json",
      "--range",
      "A1:B3",
      "--sql",
      "select * from file",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--source-shape cannot be used together with --range");
  });

  test("reports exact-match failure when a source-shape artifact does not match the current query input", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "messy.xlsx");
      const artifactPath = join(fixtureDir, "shape.json");
      await writeFile(
        artifactPath,
        `${JSON.stringify(
          {
            input: {
              format: "excel",
              path: "examples/playground/other.xlsx",
              source: "Summary",
            },
            metadata: {
              artifactType: "data-source-shape",
              issuedAt: "2026-03-20T00:00:00.000Z",
            },
            shape: {
              range: "B2:E11",
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
        "query",
        toRepoRelativePath(inputPath),
        "--source-shape",
        toRepoRelativePath(artifactPath),
        "--sql",
        "select * from file",
      ]);

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain(
        "Source shape artifact does not match the current input context exactly",
      );
    });
  });
});
