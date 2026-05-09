/* oxlint-disable no-unused-vars */
import {
  readFile,
  writeFile,
  join,
  describe,
  expect,
  test,
  seedDuckDbWorkspaceFixture,
  seedStackedMergedBandFixture,
  runCli,
  toRepoRelativePath,
  withTempFixtureDir,
  fixturePath,
  duckdbReady,
  excelReady,
} from "./cli-command-data-extract.helpers";

describe("CLI data extract command basic sources", () => {
  test("extracts CSV input end to end", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "basic.json");

      const result = runCli([
        "data",
        "extract",
        fixturePath("basic.csv"),
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`Wrote JSON: ${toRepoRelativePath(outputPath)}`);
      expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual([
        { created_at: "2026-03-01", id: "1", name: "Ada", status: "active" },
        { created_at: "2026-03-02", id: "2", name: "Bob", status: "paused" },
        { created_at: "2026-03-03", id: "3", name: "Cyd", status: "draft" },
      ]);
    });
  });

  test("extracts CSV input with explicit --no-header and preserves row 1 as data", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "header-row-as-data.csv");
      const outputPath = join(fixtureDir, "header-row-as-data.clean.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n2,Bob\n", "utf8");

      const result = runCli([
        "data",
        "extract",
        toRepoRelativePath(inputPath),
        "--no-header",
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe("column_1,column_2\nid,name\n1,Ada\n2,Bob\n");
    });
  });

  test("extracts a DuckDB-file source end to end", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);
      const outputPath = join(fixtureDir, "users.json");

      const result = runCli([
        "data",
        "extract",
        toRepoRelativePath(inputPath),
        "--source",
        "users",
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`Wrote JSON: ${toRepoRelativePath(outputPath)}`);
      expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual([
        { id: 1, name: "Ada", status: "active" },
        { id: 2, name: "Bob", status: "paused" },
        { id: 3, name: "Cyd", status: "active" },
      ]);
    });
  });

  test("extracts the main-schema DuckDB file table end to end", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);
      const outputPath = join(fixtureDir, "file.csv");

      const result = runCli([
        "data",
        "extract",
        toRepoRelativePath(inputPath),
        "--source",
        "file",
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe(
        "user_id,note\n1,welcome\n2,paused-review\n3,follow-up\n",
      );
    });
  });

  test("requires --source for multi-object DuckDB extract inputs", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);
      const outputPath = join(fixtureDir, "users.json");

      const result = runCli([
        "data",
        "extract",
        toRepoRelativePath(inputPath),
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("--source is required for DuckDB query inputs");
      expect(result.stderr).toContain("analytics.events, file, time_entries, users");
    });
  });

  test("reports unknown DuckDB sources clearly during extraction", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);
      const outputPath = join(fixtureDir, "missing.json");

      const result = runCli([
        "data",
        "extract",
        toRepoRelativePath(inputPath),
        "--source",
        "analytics.missing",
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("Unknown DuckDB source: analytics.missing");
      expect(result.stderr).toContain("Available sources:");
      expect(result.stderr).toContain("analytics.events");
    });
  });
});
