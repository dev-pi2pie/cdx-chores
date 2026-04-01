import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { withTempFixtureDir } from "./helpers/cli-test-utils";

function runGenerator(outputDir: string): { exitCode: number; stdout: string; stderr: string } {
  const proc = Bun.spawnSync({
    cmd: [
      "node",
      "scripts/generate-data-query-duckdb-fixtures.mjs",
      "reset",
      "--output-dir",
      outputDir,
    ],
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    exitCode: proc.exitCode,
    stdout: Buffer.from(proc.stdout).toString("utf8"),
    stderr: Buffer.from(proc.stderr).toString("utf8"),
  };
}

describe("data query DuckDB fixture generator", () => {
  test("reset creates deterministic DuckDB fixtures and a .db alias", async () => {
    await withTempFixtureDir("data-query-duckdb-fixtures-a", async (outputA) => {
      await withTempFixtureDir("data-query-duckdb-fixtures-b", async (outputB) => {
        const first = runGenerator(outputA);
        const second = runGenerator(outputB);

        expect(first.exitCode).toBe(0);
        expect(second.exitCode).toBe(0);
        expect(first.stdout).toContain("deterministic data query DuckDB fixtures");
        expect(second.stdout).toContain("deterministic data query DuckDB fixtures");

        const fileNames = ["multi.db", "multi.duckdb"];
        expect(
          await Promise.all(
            fileNames.map(async (name) =>
              createHash("sha256")
                .update(await readFile(join(outputA, name)))
                .digest("hex"),
            ),
          ),
        ).toEqual(
          await Promise.all(
            fileNames.map(async (name) =>
              createHash("sha256")
                .update(await readFile(join(outputB, name)))
                .digest("hex"),
            ),
          ),
        );

        const duckdbContent = await readFile(join(outputA, "multi.duckdb"));
        const dbContent = await readFile(join(outputA, "multi.db"));
        expect(dbContent.equals(duckdbContent)).toBe(true);
      });
    });
  });

  test("reset writes the expected DuckDB catalog fixture for both extensions", async () => {
    const { DuckDBConnection } = await import("@duckdb/node-api");

    await withTempFixtureDir("data-query-fixtures-duckdb", async (outputDir) => {
      const result = runGenerator(outputDir);
      expect(result.exitCode).toBe(0);

      for (const fileName of ["multi.duckdb", "multi.db"]) {
        const connection = await DuckDBConnection.create();
        try {
          await connection.run(
            `attach '${join(outputDir, fileName).replaceAll("'", "''")}' as fixture (read_only)`,
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
      }
    });
  });
});
