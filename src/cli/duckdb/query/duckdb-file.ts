import type { DuckDBConnection } from "@duckdb/node-api";

import { escapeSqlStringLiteral, quoteSqlIdentifier } from "./formats";

const DUCKDB_FILE_ATTACHMENT_NAME = "__cdx_input_db";

interface DuckDbAttachedDatabaseRow {
  database_name?: string;
  path?: string | null;
}

interface DuckDbCatalogRow {
  table_name?: string;
  table_schema?: string;
}

export interface DuckDbSourceEntry {
  schemaName: string;
  selector: string;
  tableName: string;
}

const SIMPLE_SELECTOR_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function formatDuckDbSelectorIdentifier(name: string): string {
  return SIMPLE_SELECTOR_IDENTIFIER_PATTERN.test(name) ? name : quoteSqlIdentifier(name);
}

function formatDuckDbSourceSelector(
  schemaName: string,
  tableName: string,
  tableNameCounts: ReadonlyMap<string, number>,
): string {
  return schemaName === "main" && (tableNameCounts.get(tableName) ?? 0) === 1
    ? formatDuckDbSelectorIdentifier(tableName)
    : `${formatDuckDbSelectorIdentifier(schemaName)}.${formatDuckDbSelectorIdentifier(tableName)}`;
}

export async function ensureDuckDbFileAttached(
  connection: DuckDBConnection,
  inputPath: string,
): Promise<string> {
  const reader = await connection.runAndReadAll(
    `select database_name, path
       from duckdb_databases()
      where database_name = ${escapeSqlStringLiteral(DUCKDB_FILE_ATTACHMENT_NAME)}`,
  );
  const rows = reader.getRowObjectsJson() as DuckDbAttachedDatabaseRow[];
  const attached = rows.find((row) => row.database_name === DUCKDB_FILE_ATTACHMENT_NAME);

  if (attached) {
    if (attached.path === inputPath) {
      return DUCKDB_FILE_ATTACHMENT_NAME;
    }

    await connection.run(`detach ${quoteSqlIdentifier(DUCKDB_FILE_ATTACHMENT_NAME)}`);
  }

  await connection.run(
    `attach ${escapeSqlStringLiteral(inputPath)} as ${quoteSqlIdentifier(DUCKDB_FILE_ATTACHMENT_NAME)} (read_only)`,
  );
  return DUCKDB_FILE_ATTACHMENT_NAME;
}

export async function listDuckDbFileSourceEntries(
  connection: DuckDBConnection,
  inputPath: string,
): Promise<DuckDbSourceEntry[]> {
  const attachmentName = await ensureDuckDbFileAttached(connection, inputPath);
  const reader = await connection.runAndReadAll(
    `select table_schema, table_name
       from information_schema.tables
      where table_catalog = ${escapeSqlStringLiteral(attachmentName)}
        and table_schema not in ('information_schema', 'pg_catalog')
        and table_type in ('BASE TABLE', 'VIEW')
      order by table_schema, table_name`,
  );
  const rows = reader.getRowObjectsJson() as DuckDbCatalogRow[];

  const tableNameCounts = new Map<string, number>();
  for (const row of rows) {
    const tableName = typeof row.table_name === "string" ? row.table_name.trim() : "";
    if (tableName) {
      tableNameCounts.set(tableName, (tableNameCounts.get(tableName) ?? 0) + 1);
    }
  }

  return rows
    .map((row) => {
      const schemaName = typeof row.table_schema === "string" ? row.table_schema.trim() : "";
      const tableName = typeof row.table_name === "string" ? row.table_name.trim() : "";
      if (!schemaName || !tableName) {
        return undefined;
      }

      return {
        schemaName,
        selector: formatDuckDbSourceSelector(schemaName, tableName, tableNameCounts),
        tableName,
      } satisfies DuckDbSourceEntry;
    })
    .filter((entry): entry is DuckDbSourceEntry => entry !== undefined);
}

export async function listDuckDbFileSources(
  connection: DuckDBConnection,
  inputPath: string,
): Promise<string[]> {
  const entries = await listDuckDbFileSourceEntries(connection, inputPath);
  return entries.map((entry) => entry.selector);
}

export function buildDuckDbFileRelationSql(source: DuckDbSourceEntry): string {
  return `select * from ${quoteSqlIdentifier(DUCKDB_FILE_ATTACHMENT_NAME)}.${quoteSqlIdentifier(source.schemaName)}.${quoteSqlIdentifier(source.tableName)}`;
}
