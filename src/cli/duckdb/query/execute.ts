import type { DuckDBConnection, DuckDBResultReader } from "@duckdb/node-api";

import { stringifyPreviewValue } from "../../data-preview/normalize";
import { CliError } from "../../errors";
import { toErrorMessage } from "./formats";
import type { DataQueryResultSet, DataQueryTableResult } from "./types";

function assertResultSet(reader: DuckDBResultReader): void {
  if (reader.columnCount > 0) {
    return;
  }
  throw new CliError("data query requires a SQL statement that returns rows.", {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

function normalizeResultRows(
  columns: readonly string[],
  rows: ReadonlyArray<Record<string, unknown>>,
) {
  return rows.map((row) => {
    const values: Record<string, string> = {};
    for (const column of columns) {
      values[column] = stringifyPreviewValue(row[column]);
    }
    return { values };
  });
}

export async function executeDataQueryForTable(
  connection: DuckDBConnection,
  sql: string,
  rowLimit: number,
): Promise<DataQueryTableResult> {
  try {
    const reader = await connection.streamAndReadUntil(sql, rowLimit + 1);
    assertResultSet(reader);
    const columns = reader.deduplicatedColumnNames();
    const allRows = reader.getRowObjectsJson() as Array<Record<string, unknown>>;
    const truncated = allRows.length > rowLimit || !reader.done;
    const visibleRows = allRows.slice(0, rowLimit);
    return {
      columns,
      rows: normalizeResultRows(columns, visibleRows),
      truncated,
    };
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    throw new CliError(`Failed to execute query: ${toErrorMessage(error)}`, {
      code: "DATA_QUERY_FAILED",
      exitCode: 2,
    });
  }
}

export async function executeDataQueryForAllRows(
  connection: DuckDBConnection,
  sql: string,
): Promise<DataQueryResultSet> {
  try {
    const reader = await connection.runAndReadAll(sql);
    assertResultSet(reader);
    return {
      columns: reader.deduplicatedColumnNames(),
      rows: reader.getRowObjectsJson() as Array<Record<string, unknown>>,
    };
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    throw new CliError(`Failed to execute query: ${toErrorMessage(error)}`, {
      code: "DATA_QUERY_FAILED",
      exitCode: 2,
    });
  }
}
