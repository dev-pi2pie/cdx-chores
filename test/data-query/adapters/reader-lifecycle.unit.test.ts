import { describe, expect, test } from "bun:test";
import type { DuckDBConnection, DuckDBResultReader } from "@duckdb/node-api";

import { executeDataQueryForTable } from "../../../src/cli/duckdb/query/execute";

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
});
