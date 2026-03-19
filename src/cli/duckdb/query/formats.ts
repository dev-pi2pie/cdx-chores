import type { DuckDBConnection } from "@duckdb/node-api";
import { extname } from "node:path";

import { CliError } from "../../errors";
import {
  type DuckDbManagedExtensionName,
} from "../extensions";
import { DATA_QUERY_INPUT_FORMAT_VALUES, type DataQueryInputFormat } from "./types";

const INPUT_FORMAT_EXTENSION_MAP: Record<string, DataQueryInputFormat> = {
  ".csv": "csv",
  ".tsv": "tsv",
  ".parquet": "parquet",
  ".sqlite": "sqlite",
  ".sqlite3": "sqlite",
  ".xlsx": "excel",
};

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function escapeSqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function quoteSqlIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

export function detectDataQueryInputFormat(
  inputPath: string,
  override?: DataQueryInputFormat,
): DataQueryInputFormat {
  if (override) {
    return override;
  }

  const detected = INPUT_FORMAT_EXTENSION_MAP[extname(inputPath).toLowerCase()];
  if (detected) {
    return detected;
  }

  throw new CliError(
    `Unsupported query file type: ${inputPath}. Supported inputs: .csv, .tsv, .parquet, .sqlite, .sqlite3, .xlsx.`,
    {
      code: "INVALID_INPUT",
      exitCode: 2,
    },
  );
}

export async function createDuckDbConnection(): Promise<DuckDBConnection> {
  try {
    const duckdb = await import("@duckdb/node-api");
    return await duckdb.DuckDBConnection.create();
  } catch (error) {
    throw new CliError(`DuckDB is unavailable for data query: ${toErrorMessage(error)}`, {
      code: "DUCKDB_UNAVAILABLE",
      exitCode: 2,
    });
  }
}

export function getDuckDbManagedExtensionNameForFormat(
  format: "sqlite" | "excel",
): DuckDbManagedExtensionName {
  return format;
}

export function escapeSqlStringLiteral(value: string): string {
  return escapeSqlString(value);
}

export { DATA_QUERY_INPUT_FORMAT_VALUES };
