import type { DuckDBConnection, DuckDBResultReader } from "@duckdb/node-api";
import { extname } from "node:path";

import { stringifyPreviewValue } from "../data-preview/normalize";
import type { DataPreviewRow } from "../data-preview/source";
import { CliError } from "../errors";
import {
  type DuckDbExtensionProbe,
  type DuckDbManagedExtensionName,
  ensureDuckDbManagedExtensionLoaded,
  probeDuckDbManagedExtension,
} from "./extensions";
import {
  normalizeAndValidateAcceptedHeaderMappings,
  type DataHeaderMappingEntry,
} from "./header-mapping";
import { collectXlsxSheetSnapshot, listXlsxSheetNames } from "./xlsx-sources";

export const DATA_QUERY_INPUT_FORMAT_VALUES = ["csv", "tsv", "parquet", "sqlite", "excel"] as const;

export type DataQueryInputFormat = (typeof DATA_QUERY_INPUT_FORMAT_VALUES)[number];

export interface DataQueryTableResult {
  columns: string[];
  rows: DataPreviewRow[];
  truncated: boolean;
}

export interface DataQueryResultSet {
  columns: string[];
  rows: Array<Record<string, unknown>>;
}

export interface DataQueryIntrospectionColumn {
  name: string;
  type: string;
}

export interface DataQuerySourceIntrospection {
  columns: DataQueryIntrospectionColumn[];
  sampleRows: Array<Record<string, string>>;
  selectedHeaderRow?: number;
  selectedSource?: string;
  selectedRange?: string;
  truncated: boolean;
}

export interface DataQuerySourceShape {
  headerMappings?: DataHeaderMappingEntry[];
  headerRow?: number;
  range?: string;
  source?: string;
}

interface PreparedDataQuerySource {
  selectedHeaderRow?: number;
  selectedSource?: string;
  selectedRange?: string;
}

type ExcelImportMode = "default" | "empty_as_varchar" | "all_varchar";

const INPUT_FORMAT_EXTENSION_MAP: Record<string, DataQueryInputFormat> = {
  ".csv": "csv",
  ".tsv": "tsv",
  ".parquet": "parquet",
  ".sqlite": "sqlite",
  ".sqlite3": "sqlite",
  ".xlsx": "excel",
};

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function escapeSqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function quoteSqlIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

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

interface QueryRelationColumn {
  name: string;
  sourceName: string;
  type: string;
}

interface ExcelRangeParts {
  endColumn: string;
  endRow: number;
  startColumn: string;
  startRow: number;
}

function columnNameToNumber(value: string): number {
  let result = 0;
  for (const character of value.toUpperCase()) {
    result = result * 26 + (character.charCodeAt(0) - 64);
  }
  return result;
}

export function normalizeExcelRange(value: string): string {
  const trimmed = value.trim();
  const match = /^([A-Za-z]+)([1-9][0-9]*):([A-Za-z]+)([1-9][0-9]*)$/.exec(trimmed);
  if (!match) {
    throw new CliError("--range must use A1:Z99 cell notation.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const startColumn = (match[1] ?? "").toUpperCase();
  const startRow = Number(match[2] ?? "");
  const endColumn = (match[3] ?? "").toUpperCase();
  const endRow = Number(match[4] ?? "");

  if (
    columnNameToNumber(startColumn) > columnNameToNumber(endColumn) ||
    startRow > endRow
  ) {
    throw new CliError("--range must start at the top-left cell of the selected rectangle.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  return `${startColumn}${startRow}:${endColumn}${endRow}`;
}

function parseNormalizedExcelRange(value: string): ExcelRangeParts {
  const normalized = normalizeExcelRange(value);
  const match = /^([A-Z]+)([1-9][0-9]*):([A-Z]+)([1-9][0-9]*)$/.exec(normalized);
  if (!match) {
    throw new CliError("--range must use A1:Z99 cell notation.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  return {
    endColumn: match[3] ?? "",
    endRow: Number(match[4] ?? ""),
    startColumn: match[1] ?? "",
    startRow: Number(match[2] ?? ""),
  };
}

function buildExcelRange(parts: ExcelRangeParts): string {
  return `${parts.startColumn}${parts.startRow}:${parts.endColumn}${parts.endRow}`;
}

export function normalizeExcelHeaderRow(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new CliError("--header-row must be a positive integer.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  return value;
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

function getDuckDbManagedExtensionNameForFormat(
  format: "sqlite" | "excel",
): DuckDbManagedExtensionName {
  return format;
}

function buildRelationSql(
  inputPath: string,
  format: DataQueryInputFormat,
  shape: DataQuerySourceShape = {},
  options: {
    excelImportMode?: ExcelImportMode;
  } = {},
): string {
  const escapedInput = escapeSqlString(inputPath);
  switch (format) {
    case "csv":
      return `select * from read_csv_auto(${escapedInput}, delim = ',')`;
    case "tsv":
      return `select * from read_csv_auto(${escapedInput}, delim = '\t')`;
    case "parquet":
      return `select * from read_parquet(${escapedInput})`;
    case "sqlite":
      return `select * from sqlite_scan(${escapedInput}, ${escapeSqlString(shape.source ?? "")})`;
    case "excel":
      return `select * from read_xlsx(${[
        escapedInput,
        `sheet = ${escapeSqlString(shape.source ?? "")}`,
        ...(shape.range ? [`range = ${escapeSqlString(shape.range)}`] : []),
        ...(shape.headerRow ? ["header = true"] : []),
        ...(options.excelImportMode === "empty_as_varchar" ? ["empty_as_varchar = true"] : []),
        ...(options.excelImportMode === "all_varchar" ? ["all_varchar = true"] : []),
      ].join(", ")})`;
  }
}

function isRetryableExcelImportError(error: unknown): boolean {
  const message = toErrorMessage(error);
  return /read_xlsx/i.test(message) && /Failed to parse cell|Could not convert string/i.test(message);
}

function assertSingleObjectSourceContract(
  format: DataQueryInputFormat,
  shape: DataQuerySourceShape,
): void {
  const normalizedSource = shape.source?.trim();
  if (normalizedSource) {
    throw new CliError(`--source is not valid for ${format.toUpperCase()} query inputs.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (shape.range?.trim()) {
    throw new CliError("--range is only valid for Excel query inputs.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (shape.headerRow !== undefined) {
    throw new CliError("--header-row is only valid for Excel inputs.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
}

function formatAvailableSources(sources: readonly string[]): string {
  return sources.join(", ");
}

async function listSQLiteSources(connection: DuckDBConnection, inputPath: string): Promise<string[]> {
  const reader = await connection.runAndReadAll(
    `select name from sqlite_scan(${escapeSqlString(inputPath)}, 'sqlite_master') where type in ('table', 'view') and name not like 'sqlite_%' order by name`,
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

async function resolveMultiObjectSource(
  connection: DuckDBConnection,
  inputPath: string,
  format: "sqlite" | "excel",
  source?: string,
): Promise<string> {
  const sources = await listDataQuerySources(connection, inputPath, format);
  if (!sources) {
    throw new CliError(`No queryable ${format === "sqlite" ? "SQLite" : "Excel"} sources were found.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (sources.length === 0) {
    throw new CliError(`No queryable ${format === "sqlite" ? "SQLite" : "Excel"} sources were found.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
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

export async function prepareDataQuerySource(
  connection: DuckDBConnection,
  inputPath: string,
  format: DataQueryInputFormat,
  shape: DataQuerySourceShape = {},
  options: {
    installMissingExtension?: boolean;
    statusStream?: NodeJS.WritableStream;
  } = {},
): Promise<PreparedDataQuerySource> {
  let selectedSource = shape.source?.trim();
  const selectedRange = shape.range?.trim() ? normalizeExcelRange(shape.range) : undefined;
  const selectedHeaderRow =
    shape.headerRow !== undefined ? normalizeExcelHeaderRow(shape.headerRow) : undefined;
  let effectiveRange = selectedRange;

  if (format === "sqlite") {
    if (selectedRange) {
      throw new CliError("--range is only valid for Excel query inputs.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    if (selectedHeaderRow !== undefined) {
      throw new CliError("--header-row is only valid for Excel inputs.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    await ensureDuckDbManagedExtensionLoaded(
      connection,
      getDuckDbManagedExtensionNameForFormat("sqlite"),
      {
        installIfMissing: options.installMissingExtension,
        statusStream: options.statusStream,
      },
    );
    selectedSource = await resolveMultiObjectSource(connection, inputPath, "sqlite", shape.source);
  }
  if (format === "excel") {
    await ensureDuckDbManagedExtensionLoaded(
      connection,
      getDuckDbManagedExtensionNameForFormat("excel"),
      {
        installIfMissing: options.installMissingExtension,
        statusStream: options.statusStream,
      },
    );
    selectedSource = await resolveMultiObjectSource(connection, inputPath, "excel", shape.source);

    if (selectedHeaderRow !== undefined) {
      if (selectedRange) {
        const rangeParts = parseNormalizedExcelRange(selectedRange);
        if (selectedHeaderRow < rangeParts.startRow || selectedHeaderRow > rangeParts.endRow) {
          throw new CliError(
            `--header-row must fall within the selected Excel range ${selectedRange}.`,
            {
              code: "INVALID_INPUT",
              exitCode: 2,
            },
          );
        }
        effectiveRange = buildExcelRange({
          ...rangeParts,
          startRow: selectedHeaderRow,
        });
      } else {
        const sheetSnapshot = await collectXlsxSheetSnapshot(inputPath, selectedSource);
        const usedRange = sheetSnapshot.usedRange;
        if (!usedRange) {
          throw new CliError(
            `Cannot apply --header-row because the selected Excel sheet has no detectable used range: ${selectedSource}.`,
            {
              code: "INVALID_INPUT",
              exitCode: 2,
            },
          );
        }

        const usedRangeParts = parseNormalizedExcelRange(usedRange);
        if (selectedHeaderRow < usedRangeParts.startRow || selectedHeaderRow > usedRangeParts.endRow) {
          throw new CliError(
            `--header-row must fall within the detected Excel sheet used range ${usedRange}.`,
            {
              code: "INVALID_INPUT",
              exitCode: 2,
            },
          );
        }
        effectiveRange = buildExcelRange({
          ...usedRangeParts,
          startRow: selectedHeaderRow,
        });
      }
    }
  }

  if (format === "csv" || format === "tsv" || format === "parquet") {
    assertSingleObjectSourceContract(format, shape);
  }

  const excelImportModes: ExcelImportMode[] =
    format === "excel" && (selectedRange || selectedHeaderRow !== undefined)
      ? ["empty_as_varchar", "all_varchar"]
      : ["default"];

  for (let index = 0; index < excelImportModes.length; index += 1) {
    const excelImportMode = excelImportModes[index] ?? "default";
    try {
      await connection.run(
        `create or replace temp view file_source as ${buildRelationSql(
          inputPath,
          format,
          {
            headerRow: selectedHeaderRow,
            range: effectiveRange,
            source: selectedSource,
          },
          {
            excelImportMode,
          },
        )}`,
      );
      const relationColumns = await collectQueryRelationColumns(connection, "file_source", {
        format,
        inputPath,
      });
      const appliedHeaderMappings = normalizeAndValidateAcceptedHeaderMappings({
        availableColumns: relationColumns.map((column) => column.name),
        mappings: shape.headerMappings ?? [],
      });
      await connection.run(
        `create or replace temp view file as ${buildPreparedFileProjectionSql(
          relationColumns,
          appliedHeaderMappings,
          {
            excludeBlankRows: format === "excel" && Boolean(selectedRange || selectedHeaderRow !== undefined),
          },
        )}`,
      );
      return {
        selectedHeaderRow,
        selectedRange,
        selectedSource,
      };
    } catch (error) {
      const isLastAttempt = index === excelImportModes.length - 1;
      if (!isLastAttempt && isRetryableExcelImportError(error)) {
        continue;
      }
      throw new CliError(`Failed to prepare ${format} query input: ${toErrorMessage(error)}`, {
        code: "DATA_QUERY_SOURCE_FAILED",
        exitCode: 2,
      });
    }
  }

  throw new CliError(`Failed to prepare ${format} query input: exhausted Excel import retries.`, {
    code: "DATA_QUERY_SOURCE_FAILED",
    exitCode: 2,
  });
}

async function collectQueryRelationColumns(
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
  assertResultSet(reader);
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
      `select HasHeader from sniff_csv(${escapeSqlString(inputPath)}, delim = ${escapeSqlString(delimiter)})`,
    );
    const rows = reader.getRowObjectsJson() as Array<{ HasHeader?: boolean }>;
    return rows[0]?.HasHeader === false;
  } catch {
    return false;
  }
}

function buildPreparedFileProjectionSql(
  columns: readonly QueryRelationColumn[],
  headerMappings: readonly DataHeaderMappingEntry[],
  options: {
    excludeBlankRows?: boolean;
  } = {},
): string {
  const targetBySource = new Map(headerMappings.map((mapping) => [mapping.from, mapping.to]));
  const selectList =
    columns.length > 0
      ? columns
          .map((column) => {
            const renamedTarget = targetBySource.get(column.name);
            if (!renamedTarget) {
              if (column.sourceName === column.name) {
                return quoteSqlIdentifier(column.sourceName);
              }
              return `${quoteSqlIdentifier(column.sourceName)} as ${quoteSqlIdentifier(column.name)}`;
            }
            return `${quoteSqlIdentifier(column.sourceName)} as ${quoteSqlIdentifier(renamedTarget)}`;
          })
          .join(", ")
      : "*";
  const blankRowPredicate =
    options.excludeBlankRows && columns.length > 0
      ? columns
          .map(
            (column) =>
              `nullif(trim(cast(${quoteSqlIdentifier(column.sourceName)} as varchar)), '') is not null`,
          )
          .join(" or ")
      : undefined;
  return `select ${selectList} from file_source${blankRowPredicate ? ` where ${blankRowPredicate}` : ""}`;
}

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
): DataPreviewRow[] {
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

export async function collectDataQuerySourceIntrospection(
  connection: DuckDBConnection,
  inputPath: string,
  format: DataQueryInputFormat,
  shape: DataQuerySourceShape,
  sampleRowLimit: number,
  options: {
    installMissingExtension?: boolean;
    statusStream?: NodeJS.WritableStream;
  } = {},
): Promise<DataQuerySourceIntrospection> {
  const preparedSource = await prepareDataQuerySource(connection, inputPath, format, shape, {
    installMissingExtension: options.installMissingExtension,
    statusStream: options.statusStream,
  });

  try {
    const reader = await connection.streamAndReadUntil("select * from file", sampleRowLimit + 1);
    assertResultSet(reader);

    const columnNames = reader.deduplicatedColumnNames();
    const columnTypes = reader.columnTypes();
    const allRows = reader.getRowObjectsJson() as Array<Record<string, unknown>>;
    const visibleRows = allRows.slice(0, sampleRowLimit).map((row) =>
      Object.fromEntries(
        columnNames.map((column) => [column, stringifyPreviewValue(row[column])]),
      ),
    );

    return {
      columns: columnNames.map((name, index) => ({
        name,
        type: columnTypes[index]?.toString() ?? "UNKNOWN",
      })),
      selectedHeaderRow: preparedSource.selectedHeaderRow,
      sampleRows: visibleRows,
      selectedRange: preparedSource.selectedRange,
      selectedSource: preparedSource.selectedSource,
      truncated: allRows.length > sampleRowLimit || !reader.done,
    };
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    throw new CliError(`Failed to inspect ${format} query input: ${toErrorMessage(error)}`, {
      code: "DATA_QUERY_SOURCE_FAILED",
      exitCode: 2,
    });
  }
}

export async function inspectDataQueryExtensions(): Promise<{
  available: boolean;
  detail?: string;
  runtimeVersion?: string;
  excel?: DuckDbExtensionProbe;
  sqlite?: DuckDbExtensionProbe;
}> {
  let connection: DuckDBConnection | undefined;
  try {
    connection = await createDuckDbConnection();
    const excel = await probeDuckDbManagedExtension(connection, "excel");
    const sqlite = await probeDuckDbManagedExtension(connection, "sqlite");
    return {
      available: true,
      excel,
      runtimeVersion: excel.runtimeVersion,
      sqlite,
    };
  } catch (error) {
    return {
      available: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    connection?.closeSync();
  }
}
