import type { DuckDBConnection } from "@duckdb/node-api";

import { CliError } from "../../../errors";
import { collectXlsxSheetSnapshot } from "../../xlsx-sources";
import { buildExcelRange, parseNormalizedExcelRange } from "../excel-range";
import { quoteSqlIdentifier, toErrorMessage } from "../formats";
import type { ExcelRangeParts, ExcelImportMode, QueryRelationColumn } from "../types";
import { collectQueryRelationColumns } from "./columns";
import { buildExcelImportModes, buildRelationSql } from "./sql";

export function isRetryableExcelImportError(error: unknown): boolean {
  const message = toErrorMessage(error);
  return (
    /read_xlsx/i.test(message) && /Failed to parse cell|Could not convert string/i.test(message)
  );
}

export async function createExcelTempViewWithRetries(options: {
  connection: DuckDBConnection;
  inputPath: string;
  range?: string;
  selectedSource: string;
  viewName: string;
  modes: readonly ExcelImportMode[];
}): Promise<void> {
  for (let index = 0; index < options.modes.length; index += 1) {
    const excelImportMode = options.modes[index] ?? "default";
    try {
      await options.connection.run(
        `create or replace temp view ${quoteSqlIdentifier(options.viewName)} as ${buildRelationSql(
          options.inputPath,
          "excel",
          {
            range: options.range,
            source: options.selectedSource,
          },
          {
            excelHeader: false,
            excelImportMode,
          },
        )}`,
      );
      return;
    } catch (error) {
      const isLastAttempt = index === options.modes.length - 1;
      if (!isLastAttempt && isRetryableExcelImportError(error)) {
        continue;
      }
      throw error;
    }
  }
}

export async function resolveExcelBoundaryRange(options: {
  inputPath: string;
  selectedRange?: string;
  selectedSource: string;
}): Promise<{ parts: ExcelRangeParts; range: string }> {
  if (options.selectedRange) {
    return {
      parts: parseNormalizedExcelRange(options.selectedRange),
      range: options.selectedRange,
    };
  }

  const sheetSnapshot = await collectXlsxSheetSnapshot(options.inputPath, options.selectedSource);
  const usedRange = sheetSnapshot.usedRange;
  if (!usedRange) {
    throw new CliError(
      `Cannot apply Excel row-based shaping because the selected Excel sheet has no detectable used range: ${options.selectedSource}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  return {
    parts: parseNormalizedExcelRange(usedRange),
    range: usedRange,
  };
}

function normalizeHeaderCellName(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function deduplicateSelectedColumnNames(names: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const base = name.trim() || "column";
    const normalizedKey = base.toLowerCase();
    const nextCount = (seen.get(normalizedKey) ?? 0) + 1;
    seen.set(normalizedKey, nextCount);
    return nextCount === 1 ? base : `${base}_${nextCount}`;
  });
}

async function collectNonEmptyBodyColumns(
  connection: DuckDBConnection,
  relationName: string,
  columns: readonly QueryRelationColumn[],
): Promise<Set<string>> {
  if (columns.length === 0) {
    return new Set();
  }

  const reader = await connection.runAndReadAll(
    `select ${columns
      .map(
        (column) =>
          `max(case when nullif(trim(cast(${quoteSqlIdentifier(column.sourceName)} as varchar)), '') is not null then 1 else 0 end) as ${quoteSqlIdentifier(column.sourceName)}`,
      )
      .join(", ")} from ${quoteSqlIdentifier(relationName)}`,
  );
  const row = (reader.getRowObjectsJson() as Array<Record<string, unknown>>)[0] ?? {};
  return new Set(
    columns
      .filter((column) => row[column.sourceName] === 1 || row[column.sourceName] === true)
      .map((column) => column.sourceName),
  );
}

export async function createSplitHeaderBodyExcelSourceView(options: {
  connection: DuckDBConnection;
  inputPath: string;
  rangeParts: ExcelRangeParts;
  selectedBodyStartRow: number;
  selectedHeaderRow: number;
  selectedSource: string;
}): Promise<void> {
  const headerRange = buildExcelRange({
    ...options.rangeParts,
    endRow: options.selectedHeaderRow,
    startRow: options.selectedHeaderRow,
  });
  const bodyRange = buildExcelRange({
    ...options.rangeParts,
    startRow: options.selectedBodyStartRow,
  });

  await options.connection.run(
    `create or replace temp view ${quoteSqlIdentifier("file_source_header_raw")} as ${buildRelationSql(
      options.inputPath,
      "excel",
      {
        range: headerRange,
        source: options.selectedSource,
      },
      {
        excelHeader: false,
        excelImportMode: "all_varchar",
      },
    )}`,
  );

  await createExcelTempViewWithRetries({
    connection: options.connection,
    inputPath: options.inputPath,
    modes: buildExcelImportModes(true),
    range: bodyRange,
    selectedSource: options.selectedSource,
    viewName: "file_source_body_raw",
  });

  const bodyColumns = await collectQueryRelationColumns(
    options.connection,
    "file_source_body_raw",
    {
      format: "excel",
      inputPath: options.inputPath,
    },
  );
  const headerReader = await options.connection.runAndReadAll(
    `select * from ${quoteSqlIdentifier("file_source_header_raw")} limit 1`,
  );
  const headerRow = (headerReader.getRowObjectsJson() as Array<Record<string, unknown>>)[0] ?? {};
  const nonEmptyBodyColumns = await collectNonEmptyBodyColumns(
    options.connection,
    "file_source_body_raw",
    bodyColumns,
  );

  const selectedColumns = (
    bodyColumns.filter((column) => {
      const headerName = normalizeHeaderCellName(headerRow[column.sourceName]);
      return headerName !== undefined || nonEmptyBodyColumns.has(column.sourceName);
    }) || bodyColumns
  ).map((column) => ({
    aliasBase: normalizeHeaderCellName(headerRow[column.sourceName]) ?? column.name,
    column,
  }));
  const effectiveSelectedColumns =
    selectedColumns.length > 0
      ? selectedColumns
      : bodyColumns.map((column) => ({ aliasBase: column.name, column }));
  const deduplicatedNames = deduplicateSelectedColumnNames(
    effectiveSelectedColumns.map((column) => column.aliasBase),
  );

  await options.connection.run(
    `create or replace temp view ${quoteSqlIdentifier("file_source")} as select ${effectiveSelectedColumns
      .map(
        (entry, index) =>
          `${quoteSqlIdentifier(entry.column.sourceName)} as ${quoteSqlIdentifier(deduplicatedNames[index] ?? entry.aliasBase)}`,
      )
      .join(", ")} from ${quoteSqlIdentifier("file_source_body_raw")}`,
  );
}
