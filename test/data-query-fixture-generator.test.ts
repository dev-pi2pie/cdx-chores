import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";

import { withTempFixtureDir } from "./helpers/cli-test-utils";

function runGenerator(outputDir: string): { exitCode: number; stdout: string; stderr: string } {
  const proc = Bun.spawnSync({
    cmd: ["node", "scripts/generate-data-query-fixtures.mjs", "reset", "--output-dir", outputDir],
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    exitCode: proc.exitCode,
    stdout: Buffer.from(proc.stdout).toString("utf8"),
    stderr: Buffer.from(proc.stderr).toString("utf8"),
  };
}

async function snapshotDirectory(
  outputDir: string,
): Promise<Array<{ hash: string; name: string }>> {
  const names = (await readdir(outputDir)).sort();
  const entries = [];
  for (const name of names) {
    const content = await readFile(`${outputDir}/${name}`);
    const hash = createHash("sha256").update(content).digest("hex");
    entries.push({ hash, name });
  }
  return entries;
}

describe("data query fixture generator", () => {
  test("reset creates a deterministic representative fixture set", async () => {
    await withTempFixtureDir("data-query-fixtures-a", async (outputA) => {
      await withTempFixtureDir("data-query-fixtures-b", async (outputB) => {
        const first = runGenerator(outputA);
        const second = runGenerator(outputB);

        expect(first.exitCode).toBe(0);
        expect(second.exitCode).toBe(0);
        expect(first.stdout).toContain("deterministic data query fixtures");
        expect(second.stdout).toContain("deterministic data query fixtures");

        const snapshotA = await snapshotDirectory(outputA);
        const snapshotB = await snapshotDirectory(outputB);

        expect(snapshotA).toEqual(snapshotB);
        expect(snapshotA.map((entry) => entry.name)).toEqual([
          "basic.csv",
          "basic.parquet",
          "basic.tsv",
          "generic.csv",
          "large.csv",
          "large.parquet",
          "multi.duckdb",
          "multi.sqlite",
          "multi.xlsx",
        ]);
      });
    });
  });

  test("reset writes the expected DuckDB catalog fixture", async () => {
    const { DuckDBConnection } = await import("@duckdb/node-api");

    await withTempFixtureDir("data-query-fixtures-duckdb", async (outputDir) => {
      const result = runGenerator(outputDir);
      expect(result.exitCode).toBe(0);

      const connection = await DuckDBConnection.create();
      try {
        await connection.run(
          `attach '${`${outputDir}/multi.duckdb`.replaceAll("'", "''")}' as fixture (read_only)`,
        );
        const reader = await connection.runAndReadAll(
          "select table_schema, table_name from information_schema.tables where table_catalog = 'fixture' and table_schema not in ('information_schema', 'pg_catalog') order by table_schema, table_name",
        );
        expect(reader.getRowObjectsJson()).toEqual([
          { table_name: "events", table_schema: "analytics" },
          { table_name: "file", table_schema: "main" },
          { table_name: "time_entries", table_schema: "main" },
          { table_name: "users", table_schema: "main" },
        ]);

        const usersReader = await connection.runAndReadAll(
          "select id, name, status from fixture.main.users order by id",
        );
        expect(usersReader.getRowObjectsJson()).toEqual([
          { id: 1, name: "Ada", status: "active" },
          { id: 2, name: "Bob", status: "paused" },
          { id: 3, name: "Cyd", status: "active" },
        ]);

        const eventsReader = await connection.runAndReadAll(
          "select id, user_id, event_type from fixture.analytics.events order by id",
        );
        expect(eventsReader.getRowObjectsJson()).toEqual([
          { event_type: "login", id: 10, user_id: 1 },
          { event_type: "export", id: 11, user_id: 1 },
          { event_type: "login", id: 12, user_id: 2 },
        ]);

        const timeEntriesReader = await connection.runAndReadAll(
          "select entry_id, team, hours from fixture.main.time_entries order by entry_id",
        );
        expect(timeEntriesReader.getRowObjectsJson()).toEqual([
          { entry_id: 1, hours: "8", team: "Core" },
          { entry_id: 2, hours: "5", team: "Infra" },
          { entry_id: 3, hours: "3", team: "Core" },
        ]);
      } finally {
        connection.closeSync();
      }
    });
  });
});
