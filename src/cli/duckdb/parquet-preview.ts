import type { DuckDBConnection } from "@duckdb/node-api";

import { CliError } from "../errors";
import { stringifyPreviewValue } from "../data-preview/normalize";
import type { DataPreviewRow } from "../data-preview/source";

export interface LoadParquetPreviewWindowOptions {
  columns?: readonly string[];
  inputPath: string;
  offset: number;
  rowCount: number;
}

export interface ParquetPreviewWindow {
  allColumns: string[];
  rows: DataPreviewRow[];
  totalRows: number;
}

function quoteSqlIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function validateRequestedColumns(
  availableColumns: readonly string[],
  requestedColumns: readonly string[] | undefined,
): string[] {
  const normalized = requestedColumns
    ?.map((column) => column.trim())
    .filter((column) => column.length > 0);

  if (!normalized || normalized.length === 0) {
    return [...availableColumns];
  }

  const selected: string[] = [];
  const seen = new Set<string>();
  for (const column of normalized) {
    if (seen.has(column)) {
      continue;
    }
    selected.push(column);
    seen.add(column);
  }

  const available = new Set(availableColumns);
  const missing = selected.filter((column) => !available.has(column));
  if (missing.length > 0) {
    throw new CliError(`Unknown columns: ${missing.join(", ")}`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  return selected;
}

async function createDuckDbConnection(): Promise<DuckDBConnection> {
  try {
    const duckdb = await import("@duckdb/node-api");
    return await duckdb.DuckDBConnection.create();
  } catch (error) {
    throw new CliError(`DuckDB is unavailable for Parquet preview: ${toErrorMessage(error)}`, {
      code: "DUCKDB_UNAVAILABLE",
      exitCode: 2,
    });
  }
}

async function readParquetColumns(connection: DuckDBConnection, inputPath: string): Promise<string[]> {
  const reader = await connection.runAndReadAll("select * from read_parquet(?) limit 0", [inputPath]);
  return reader.columnNames();
}

async function readParquetTotalRows(connection: DuckDBConnection, inputPath: string): Promise<number> {
  const reader = await connection.runAndReadAll("select count(*) as total_rows from read_parquet(?)", [inputPath]);
  const rows = reader.getRowObjectsJson();
  return Number(rows[0]?.total_rows ?? 0);
}

async function readParquetWindowRows(
  connection: DuckDBConnection,
  inputPath: string,
  columns: readonly string[],
  offset: number,
  rowCount: number,
): Promise<DataPreviewRow[]> {
  const projection = columns.map((column) => quoteSqlIdentifier(column)).join(", ");
  const reader = await connection.runAndReadAll(
    `select ${projection} from read_parquet(?) limit ? offset ?`,
    [inputPath, rowCount, offset],
  );
  const rowObjects = reader.getRowObjectsJson();

  return rowObjects.map((row) => {
    const values: Record<string, string> = {};
    for (const column of columns) {
      values[column] = stringifyPreviewValue(row[column]);
    }
    return { values };
  });
}

export async function loadParquetPreviewWindow(
  options: LoadParquetPreviewWindowOptions,
): Promise<ParquetPreviewWindow> {
  let connection: DuckDBConnection | undefined;
  try {
    connection = await createDuckDbConnection();
    const allColumns = await readParquetColumns(connection, options.inputPath);
    const selectedColumns = validateRequestedColumns(allColumns, options.columns);
    const totalRows = await readParquetTotalRows(connection, options.inputPath);
    const rows = await readParquetWindowRows(
      connection,
      options.inputPath,
      selectedColumns,
      options.offset,
      options.rowCount,
    );

    return {
      allColumns,
      rows,
      totalRows,
    };
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    throw new CliError(`Failed to preview Parquet file: ${toErrorMessage(error)}`, {
      code: "PARQUET_PREVIEW_FAILED",
      exitCode: 2,
    });
  } finally {
    connection?.closeSync();
  }
}
