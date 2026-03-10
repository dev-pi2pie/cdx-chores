import { chmod } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { inspectDataQueryExtensions } from "../src/cli/duckdb/query";
import { REPO_ROOT, runCli, withTempFixtureDir } from "./helpers/cli-test-utils";

const queryExtensions = await inspectDataQueryExtensions();
const sqliteReady = queryExtensions.available && queryExtensions.sqlite?.loadable === true;
const excelReady = queryExtensions.available && queryExtensions.excel?.loadable === true;

function fixturePath(name: string): string {
  return join("test", "fixtures", "data-query", name);
}

describe("CLI data query command", () => {
  test("queries CSV input end to end", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("basic.csv"),
      "--sql",
      "select id, name from file order by id",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Format: csv");
    expect(result.stdout).toContain("1   | Ada");
    expect(result.stdout).toContain("3   | Cyd");
  });

  test("queries TSV input end to end", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("basic.tsv"),
      "--sql",
      "select name, status from file order by id",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Format: tsv");
    expect(result.stdout).toContain("Ada  | active");
  });

  test("queries Parquet input end to end", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("basic.parquet"),
      "--sql",
      "select id, name from file order by id",
      "--json",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual([
      { id: "1", name: "Ada" },
      { id: "2", name: "Bob" },
      { id: "3", name: "Cyd" },
    ]);
  });

  test("queries SQLite input end to end when the extension is ready", () => {
    if (!sqliteReady) {
      return;
    }

    const result = runCli([
      "data",
      "query",
      fixturePath("multi.sqlite"),
      "--source",
      "users",
      "--sql",
      "select id, name from file order by id",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Format: sqlite");
    expect(result.stdout).toContain("Source: users");
    expect(result.stdout).toContain("1   | Ada");
  });

  test("queries Excel input end to end when the extension is ready", () => {
    if (!excelReady) {
      return;
    }

    const result = runCli([
      "data",
      "query",
      fixturePath("multi.xlsx"),
      "--source",
      "Summary",
      "--sql",
      "select id, name from file order by id",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Format: excel");
    expect(result.stdout).toContain("Source: Summary");
    expect(result.stdout).toContain("1   | Ada");
  });

  test("honors explicit row bounds for bounded table output", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("large.csv"),
      "--sql",
      "select id, note from file order by id",
      "--rows",
      "1",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Result rows: 1+ (bounded)");
    expect(result.stdout).toContain("1   | fixture-row-0001");
    expect(result.stdout).not.toContain("fixture-row-0002");
  });

  test("uses the default bounded row count when --rows is omitted", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("large.csv"),
      "--sql",
      "select id, note from file order by id",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Result rows: 20+ (bounded)");
    expect(result.stdout).toContain("20  | fixture-row-0020");
    expect(result.stdout).not.toContain("fixture-row-0021");
  });

  test("lists available SQLite sources when source is missing", () => {
    if (!sqliteReady) {
      return;
    }

    const result = runCli([
      "data",
      "query",
      fixturePath("multi.sqlite"),
      "--sql",
      "select * from file",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--source is required for SQLite");
    expect(result.stderr).toContain("Available sources: active_users, time_entries, users");
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

  test("reports install-unavailable guidance when SQLite cannot cache extensions", async () => {
    await withTempFixtureDir("query-home-sqlite", async (tempHome) => {
      await chmod(tempHome, 0o500);

      const result = runCli(
        [
          "data",
          "query",
          fixturePath("multi.sqlite"),
          "--source",
          "users",
          "--sql",
          "select * from file",
        ],
        REPO_ROOT,
        { HOME: tempHome },
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("requires the DuckDB sqlite extension");
      expect(result.stderr).toContain("cannot install or cache it");
    });
  });
});
