import type { DuckDBConnection } from "@duckdb/node-api";

import { escapeSqlStringLiteral, quoteSqlIdentifier } from "../formats";
import type { DataQueryInputFormat, QueryRelationColumn } from "../types";

function normalizeGeneratedQueryColumnName(name: string): string {
  const match = /^column(\d+)$/i.exec(name.trim());
  if (!match) {
    return name;
  }

  const index = Number(match[1] ?? "");
  if (!Number.isInteger(index) || index < 0) {
    return name;
  }

  return `column_${index + 1}`;
}

function isGeneratedQueryPlaceholderSequence(names: readonly string[]): boolean {
  return names.length > 0 && names.every((name, index) => {
    const match = /^column(\d+)$/i.exec(name.trim());
    if (!match) {
      return false;
    }

    const detectedIndex = Number(match[1] ?? "");
    return Number.isInteger(detectedIndex) && detectedIndex === index;
  });
}

async function shouldNormalizeGeneratedQueryColumnNames(
  connection: DuckDBConnection,
  inputPath: string,
  format: DataQueryInputFormat,
  columnNames: readonly string[],
): Promise<boolean> {
  if ((format !== "csv" && format !== "tsv") || !isGeneratedQueryPlaceholderSequence(columnNames)) {
    return false;
  }

  try {
    const delimiter = format === "tsv" ? "\t" : ",";
    const reader = await connection.runAndReadAll(
      `select HasHeader from sniff_csv(${escapeSqlStringLiteral(inputPath)}, delim = ${escapeSqlStringLiteral(delimiter)})`,
    );
    const rows = reader.getRowObjectsJson() as Array<{ HasHeader?: boolean }>;
    return rows[0]?.HasHeader === false;
  } catch {
    return false;
  }
}

export async function collectQueryRelationColumns(
  connection: DuckDBConnection,
  relationName: string,
  options: {
    format: DataQueryInputFormat;
    inputPath: string;
  },
): Promise<QueryRelationColumn[]> {
  const reader = await connection.runAndReadAll(
    `select * from ${quoteSqlIdentifier(relationName)} limit 0`,
  );
  const columnNames = reader.deduplicatedColumnNames();
  const columnTypes = reader.columnTypes();
  const shouldNormalizeGeneratedColumns = await shouldNormalizeGeneratedQueryColumnNames(
    connection,
    options.inputPath,
    options.format,
    columnNames,
  );
  return columnNames.map((name, index) => ({
    name: shouldNormalizeGeneratedColumns ? normalizeGeneratedQueryColumnName(name) : name,
    sourceName: name,
    type: columnTypes[index]?.toString() ?? "UNKNOWN",
  }));
}
