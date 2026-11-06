import { describe, expect, test } from "bun:test";
import type { DuckDBConnection, DuckDBResultReader } from "@duckdb/node-api";

import { executeDataQueryForTable } from "../../../src/cli/duckdb/query/execute";
import {
  collectDataQuerySourceIntrospection,
  collectDataQueryWorkspaceIntrospection,
} from "../../../src/cli/duckdb/query/introspection";

describe("bounded DuckDB reader ownership", () => {
  test.each(["success", "no-columns", "conversion-error"])("closes after %s", async (outcome) => {
    let closed = false;
    const reader = {
      columnCount: outcome === "no-columns" ? 0 : 1,
      deduplicatedColumnNames: () => ["id"],
      getRowObjectsJson: () => {
        expect(closed).toBe(false);
        if (outcome === "conversion-error") throw new Error("conversion failed");
        return [{ id: 1 }, { id: 2 }];
      },
      done: false,
      closeSync: () => {
        closed = true;
      },
    } as unknown as DuckDBResultReader;
    const connection = {
      streamAndReadUntil: async () => reader,
    } as unknown as DuckDBConnection;

    const result = executeDataQueryForTable(connection, "select id from file", 1);
    if (outcome === "success") {
      expect(await result).toEqual({
        columns: ["id"],
        rows: [{ values: { id: "1" } }],
        truncated: true,
      });
    } else {
      await expect(result).rejects.toMatchObject({
        code: outcome === "no-columns" ? "INVALID_INPUT" : "DATA_QUERY_FAILED",
        exitCode: 2,
      });
    }
    expect(closed).toBe(true);
  });

  for (const mode of ["single-source", "workspace"] as const) {
    test.each(["no-columns", "metadata-error", "conversion-error"])(
      `closes ${mode} previews after %s`,
      async (outcome) => {
        const closedReaders: number[] = [];
        const connection = {
          run: async () => {},
          runAndReadAll: async (sql: string) => {
            if (sql.includes("from duckdb_databases()")) {
              return { getRowObjectsJson: () => [] };
            }
            if (sql.includes("from information_schema.tables")) {
              return {
                getRowObjectsJson: () => [
                  { table_schema: "main", table_name: "users" },
                  { table_schema: "main", table_name: "time_entries" },
                ],
              };
            }
            if (sql === 'select * from "file_source" limit 0') {
              return {
                deduplicatedColumnNames: () => ["id"],
                columnTypes: () => [{ toString: () => "INTEGER" }],
              };
            }
            throw new Error(`Unexpected preparation query: ${sql}`);
          },
          streamAndReadUntil: async () => {
            const index = closedReaders.length;
            closedReaders.push(0);
            const failing = mode === "single-source" || index === 1;
            const assertOpen = () => expect(closedReaders[index]).toBe(0);
            return {
              columnCount: failing && outcome === "no-columns" ? 0 : 1,
              deduplicatedColumnNames: () => ["id"],
              columnTypes: () => {
                assertOpen();
                if (failing && outcome === "metadata-error") throw new Error("metadata failed");
                return [
                  {
                    toString: () => {
                      assertOpen();
                      return "INTEGER";
                    },
                  },
                ];
              },
              getRowObjectsJson: () => {
                assertOpen();
                if (failing && outcome === "conversion-error") throw new Error("conversion failed");
                return [{ id: 1 }, { id: 2 }];
              },
              done: false,
              closeSync: () => {
                closedReaders[index]! += 1;
              },
            };
          },
        } as unknown as DuckDBConnection;

        const result =
          mode === "single-source"
            ? collectDataQuerySourceIntrospection(connection, "input.csv", "csv", {}, 1)
            : collectDataQueryWorkspaceIntrospection(
                connection,
                "input.duckdb",
                "duckdb",
                [
                  { alias: "people", source: "users" },
                  { alias: "time", source: "time_entries" },
                ],
                1,
              );
        await expect(result).rejects.toMatchObject({
          code: outcome === "no-columns" ? "INVALID_INPUT" : "DATA_QUERY_SOURCE_FAILED",
          exitCode: 2,
        });
        expect(closedReaders).toEqual(mode === "single-source" ? [1] : [1, 1]);
      },
    );
  }
});
