import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";

import { withTempFixtureDir } from "../../helpers/cli-test-utils";
import { requireNativePrerequisites } from "../../helpers/native-prerequisites";
import { seedSingleTableDuckDbFixture } from "../fixtures/duckdb";

async function readFixture(inputPath: string) {
  const { DuckDBConnection } = await import("@duckdb/node-api");
  const connection = await DuckDBConnection.create();
  try {
    await connection.run(`attach '${inputPath.replaceAll("'", "''")}' as fixture (read_only)`);
    const storage = await connection.runAndReadAll(
      "select tags['storage_version'] from duckdb_databases() where database_name = 'fixture'",
    );
    const rows = await connection.runAndReadAll("select id, name from fixture.users order by id");
    return { storage: storage.getRowsJson(), rows: rows.getRowsJson() };
  } finally {
    connection.closeSync();
  }
}

describe("DuckDB fixture storage targets", () => {
  for (const { label, options, storage } of [
    { label: "an omitted target", options: undefined, storage: "v2.0.0+" },
    { label: "an undefined target", options: { storageVersion: undefined }, storage: "v2.0.0+" },
    { label: "an alternate target", options: { storageVersion: "v1.4.0" }, storage: "v1.4.0+" },
  ]) {
    test(`creates the expected storage format for ${label}`, async () => {
      await requireNativePrerequisites("duckdb");

      let ownedDir = "";
      await withTempFixtureDir("duckdb-fixture-storage", async (fixtureDir) => {
        ownedDir = fixtureDir;
        const inputPath = await seedSingleTableDuckDbFixture(fixtureDir, options);
        expect(await readFixture(inputPath)).toEqual({
          storage: [[storage]],
          rows: [
            [1, "Ada"],
            [2, "Bob"],
          ],
        });
      });
      expect(existsSync(ownedDir)).toBe(false);
    });
  }

  for (const { label, storageVersion, message } of [
    { label: "empty", storageVersion: "", message: "Version string can not be empty" },
    { label: "malformed", storageVersion: "not-a-version" },
    { label: "unsupported", storageVersion: "v999.0.0" },
    { label: "quoted", storageVersion: "v1.5.6'); select 1; --" },
  ]) {
    test(`preserves the engine error for ${label} targets and permits reseeding and cleanup`, async () => {
      await requireNativePrerequisites("duckdb");

      let ownedDir = "";
      await withTempFixtureDir("duckdb-fixture-invalid", async (fixtureDir) => {
        ownedDir = fixtureDir;
        await expect(seedSingleTableDuckDbFixture(fixtureDir, { storageVersion })).rejects.toThrow(
          `Invalid Input Error: ${message ?? `The version string '${storageVersion}' is not a known DuckDB version`}`,
        );
        const inputPath = await seedSingleTableDuckDbFixture(fixtureDir);
        expect((await readFixture(inputPath)).rows).toEqual([
          [1, "Ada"],
          [2, "Bob"],
        ]);
      });
      expect(existsSync(ownedDir)).toBe(false);
    });
  }
});
