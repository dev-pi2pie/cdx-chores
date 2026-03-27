import type { DuckDBConnection } from "@duckdb/node-api";

import { CliError } from "../../errors";
import { ensureDuckDbManagedExtensionLoaded } from "../extensions";
import { escapeSqlStringLiteral, getDuckDbManagedExtensionNameForFormat } from "./formats";
import type { DataQueryInputFormat } from "./types";
import { listXlsxSheetNames } from "../xlsx-sources";

function formatAvailableSources(sources: readonly string[]): string {
  return sources.join(", ");
}

async function listSQLiteSources(
  connection: DuckDBConnection,
  inputPath: string,
): Promise<string[]> {
  const reader = await connection.runAndReadAll(
    `select name from sqlite_scan(${escapeSqlStringLiteral(inputPath)}, 'sqlite_master') where type in ('table', 'view') and name not like 'sqlite_%' order by name`,
  );
  const rows = reader.getRowObjectsJson() as Array<{ name?: string }>;
  return rows
    .map((row) => (typeof row.name === "string" ? row.name : ""))
    .filter((name) => name.length > 0);
}

export async function listDataQuerySources(
  connection: DuckDBConnection,
  inputPath: string,
  format: DataQueryInputFormat,
): Promise<string[] | undefined> {
  if (format === "sqlite") {
    await ensureDuckDbManagedExtensionLoaded(
      connection,
      getDuckDbManagedExtensionNameForFormat("sqlite"),
    );
    return await listSQLiteSources(connection, inputPath);
  }

  if (format === "excel") {
    await ensureDuckDbManagedExtensionLoaded(
      connection,
      getDuckDbManagedExtensionNameForFormat("excel"),
    );
    return await listXlsxSheetNames(inputPath);
  }

  return undefined;
}

export async function resolveMultiObjectSource(
  connection: DuckDBConnection,
  inputPath: string,
  format: "sqlite" | "excel",
  source?: string,
): Promise<string> {
  const sources = await listDataQuerySources(connection, inputPath, format);
  if (!sources || sources.length === 0) {
    throw new CliError(
      `No queryable ${format === "sqlite" ? "SQLite" : "Excel"} sources were found.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  const normalizedSource = source?.trim();
  if (!normalizedSource) {
    throw new CliError(
      `--source is required for ${format === "sqlite" ? "SQLite" : "Excel"} query inputs. Available sources: ${formatAvailableSources(sources)}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  if (!sources.includes(normalizedSource)) {
    throw new CliError(
      `Unknown ${format === "sqlite" ? "SQLite" : "Excel"} source: ${normalizedSource}. Available sources: ${formatAvailableSources(sources)}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  return normalizedSource;
}
