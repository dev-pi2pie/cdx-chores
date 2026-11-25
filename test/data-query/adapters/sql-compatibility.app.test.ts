import { describe, expect, test } from "bun:test";

import { executeDataQueryForAllRows } from "../../../src/cli/duckdb/query/execute";
import { createDuckDbConnection } from "../../../src/cli/duckdb/query/formats";
import { requireNativePrerequisites } from "../../helpers/native-prerequisites";

describe("DuckDB 2 submitted SQL compatibility", () => {
  test("retains explicit matching, lambda, literal, and arithmetic semantics", async () => {
    await requireNativePrerequisites("duckdb");
    const connection = await createDuckDbConnection();
    try {
      const result = await executeDataQueryForAllRows(
        connection,
        `select
        'abc' ~ 'b' as partial,
        regexp_full_match('abc', 'b') as full,
        regexp_matches('abc', 'b') as explicit_partial,
        list_transform([1, 2], lambda x: x + 1) as transformed,
        2 * 3! as factorial, (2 * 3)! as grouped_factorial,
        typeof(X'AB') as hex_type, typeof(B'101') as bit_type,
        'xAB' as text_hex, 'b101' as text_bit,
        try(1 // 0) as safe_division, try(1 % 0) as safe_modulo,
        1.0 / 0 as float_division`,
      );
      expect(result.rows).toEqual([
        {
          partial: true,
          full: false,
          explicit_partial: true,
          transformed: [2, 3],
          factorial: "12",
          grouped_factorial: "720",
          hex_type: "BLOB",
          bit_type: "BIT",
          text_hex: "xAB",
          text_bit: "b101",
          safe_division: null,
          safe_modulo: null,
          float_division: "Infinity",
        },
      ]);
      for (const sql of [
        "select list_transform([1,2], x -> x + 1)",
        "select 1 // 0",
        "select 1 % 0",
      ]) {
        await expect(executeDataQueryForAllRows(connection, sql)).rejects.toMatchObject({
          code: "DATA_QUERY_FAILED",
          exitCode: 2,
        });
      }
    } finally {
      connection.closeSync();
    }
  });

  test("uses explicit NULL types and rollback after transaction errors", async () => {
    await requireNativePrerequisites("duckdb");
    const connection = await createDuckDbConnection();
    try {
      await connection.run("create temp table untyped as select NULL as value");
      await expect(connection.run("insert into untyped values (1)")).rejects.toThrow();
      await connection.run("create temp table typed as select NULL::VARCHAR as value");
      await connection.run("insert into typed values ('text')");
      expect(
        (
          await executeDataQueryForAllRows(
            connection,
            "select value from typed order by value nulls first",
          )
        ).rows,
      ).toEqual([{ value: null }, { value: "text" }]);
      await connection.run("begin");
      await expect(
        executeDataQueryForAllRows(connection, "select missing_column"),
      ).rejects.toMatchObject({ code: "DATA_QUERY_FAILED" });
      await expect(executeDataQueryForAllRows(connection, "select 1 as value")).rejects.toThrow(
        "aborted",
      );
      await connection.run("rollback");
      expect((await executeDataQueryForAllRows(connection, "select 1 as value")).rows).toEqual([
        { value: 1 },
      ]);
      for (const [setting, expected] of [
        ["false", "lowercase"],
        ["true", "preserve_case"],
      ]) {
        await connection.run(`set preserve_identifier_case = ${setting}`);
        expect(
          (
            await executeDataQueryForAllRows(
              connection,
              "select current_setting('preserve_identifier_case') as value",
            )
          ).rows,
        ).toEqual([{ value: expected }]);
      }
    } finally {
      connection.closeSync();
    }
  });

  test("preserves JSON precision, nested values, timestamps, and empty schemas", async () => {
    await requireNativePrerequisites("duckdb");
    const connection = await createDuckDbConnection();
    try {
      expect(
        (
          await executeDataQueryForAllRows(
            connection,
            "select 9007199254740993::BIGINT as big, 123456789012345.125::DECIMAL(18,3) as dec, timestamp '2026-03-01 12:34:56.123456' as stamp, [1, NULL, 3] as list, {'key': 'value'} as obj",
          )
        ).rows,
      ).toEqual([
        {
          big: "9007199254740993",
          dec: "123456789012345.125",
          stamp: "2026-03-01 12:34:56.123456",
          list: [1, null, 3],
          obj: { key: "value" },
        },
      ]);
      expect(
        await executeDataQueryForAllRows(
          connection,
          "select 1::INTEGER as id, NULL::VARCHAR as name where false",
        ),
      ).toEqual({ columns: ["id", "name"], rows: [] });
      expect(
        (
          await executeDataQueryForAllRows(
            connection,
            "select {'key': [1, NULL]}::VARIANT as value",
          )
        ).rows,
      ).toEqual([{ value: { key: [1, null] } }]);
    } finally {
      connection.closeSync();
    }
  });
});
