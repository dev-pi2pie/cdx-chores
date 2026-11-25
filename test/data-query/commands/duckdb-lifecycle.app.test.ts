import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { REPO_ROOT, runCli, toRepoRelativePath, withTempFixtureDir, fixturePath } from "./support";

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

  test("inspection and ordinary reads do not populate an empty extension cache", async () => {
    await withTempFixtureDir("duckdb-empty-cache", async (fixtureDir) => {
      const home = join(fixtureDir, "home");
      await mkdir(home);
      const env = { HOME: home, FORCE_COLOR: undefined };
      const cache = join(home, ".duckdb");

      const managedDoctor = runCli(["data", "duckdb", "doctor", "--json"], REPO_ROOT, env);
      expect(managedDoctor.exitCode).toBe(0);
      expect(managedDoctor.stderr).toBe("");
      const managedState = JSON.parse(managedDoctor.stdout).duckdb.extensions;
      for (const name of ["sqlite", "excel"]) {
        expect(managedState[name].installed).toBe(false);
        expect(managedState[name].loadability).toBe(false);
        expect(managedState[name].installability).toBe(true);
      }
      expect(existsSync(cache)).toBe(false);

      const doctor = runCli(["doctor", "--json"], REPO_ROOT, env);
      expect(doctor.exitCode).toBe(0);
      expect(doctor.stderr).toBe("");
      const formats = JSON.parse(doctor.stdout).query.formats;
      expect(formats.sqlite.loadability).toBe(false);
      expect(formats.excel.loadability).toBe(false);
      expect(existsSync(cache)).toBe(false);

      for (const [input, source] of [
        ["multi.sqlite", "users"],
        ["multi.xlsx", "Summary"],
      ] as const) {
        const query = runCli(
          ["data", "query", fixturePath(input), "--source", source, "--sql", "select * from file"],
          REPO_ROOT,
          env,
        );
        expect(query.exitCode).toBe(2);
        expect(query.stderr).toContain("Install it explicitly");
        expect(existsSync(cache)).toBe(false);

        const output = join(fixtureDir, `${input}.json`);
        const extract = runCli(
          [
            "data",
            "extract",
            fixturePath(input),
            "--source",
            source,
            "--output",
            toRepoRelativePath(output),
          ],
          REPO_ROOT,
          env,
        );
        expect(extract.exitCode).toBe(2);
        expect(extract.stderr).toContain("Install it explicitly");
        expect(existsSync(output)).toBe(false);
        expect(existsSync(cache)).toBe(false);
      }

      const parquet = runCli(
        ["data", "parquet", "preview", "test/fixtures/parquet-preview/basic.parquet"],
        REPO_ROOT,
        env,
      );
      expect(parquet.exitCode).toBe(0);
      expect(parquet.stderr).toBe("");
      expect(parquet.stdout).toContain("Rows: 3");
      expect(existsSync(cache)).toBe(false);
    });
  }, 20_000);
});
