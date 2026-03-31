import type { DuckDBConnection } from "@duckdb/node-api";

import { CliError } from "../../errors";
import { ensureDuckDbManagedExtensionLoaded } from "../extensions";
import { listDuckDbFileSourceEntries, type DuckDbSourceEntry } from "./duckdb-file";
import {
  escapeSqlStringLiteral,
  getDuckDbManagedExtensionNameForFormat,
  getMultiObjectSourceDisplayLabel,
} from "./formats";
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
  options: {
    ensureExtensionLoaded?: boolean;
  } = {},
): Promise<string[] | undefined> {
  if (format === "sqlite") {
    if (options.ensureExtensionLoaded !== false) {
      await ensureDuckDbManagedExtensionLoaded(
        connection,
        getDuckDbManagedExtensionNameForFormat("sqlite"),
      );
    }
    return await listSQLiteSources(connection, inputPath);
  }

  if (format === "excel") {
    if (options.ensureExtensionLoaded !== false) {
      await ensureDuckDbManagedExtensionLoaded(
        connection,
        getDuckDbManagedExtensionNameForFormat("excel"),
      );
    }
    return await listXlsxSheetNames(inputPath);
  }

  if (format === "duckdb") {
    return (await listDuckDbFileSourceEntries(connection, inputPath)).map(
      (entry) => entry.selector,
    );
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
      `No queryable ${getMultiObjectSourceDisplayLabel(format)} sources were found.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  const normalizedSource = source?.trim();
  if (!normalizedSource) {
    throw new CliError(
      `--source is required for ${getMultiObjectSourceDisplayLabel(format)} query inputs. Available sources: ${formatAvailableSources(sources)}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  if (!sources.includes(normalizedSource)) {
    throw new CliError(
      `Unknown ${getMultiObjectSourceDisplayLabel(format)} source: ${normalizedSource}. Available sources: ${formatAvailableSources(sources)}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  return normalizedSource;
}

export async function resolveDuckDbFileSource(
  connection: DuckDBConnection,
  inputPath: string,
  source?: string,
  options: {
    entries?: readonly DuckDbSourceEntry[];
  } = {},
): Promise<DuckDbSourceEntry> {
  const entries = options.entries
    ? [...options.entries]
    : await listDuckDbFileSourceEntries(connection, inputPath);
  if (entries.length === 0) {
    throw new CliError(
      `No queryable ${getMultiObjectSourceDisplayLabel("duckdb")} sources were found.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  const normalizedSource = source?.trim();
  if (!normalizedSource) {
    throw new CliError(
      `--source is required for ${getMultiObjectSourceDisplayLabel("duckdb")} query inputs. Available sources: ${formatAvailableSources(entries.map((entry) => entry.selector))}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  const entry = entries.find((candidate) => candidate.selector === normalizedSource);
  if (!entry) {
    throw new CliError(
      `Unknown ${getMultiObjectSourceDisplayLabel("duckdb")} source: ${normalizedSource}. Available sources: ${formatAvailableSources(entries.map((candidate) => candidate.selector))}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  return entry;
}
