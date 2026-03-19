import type { DuckDBConnection } from "@duckdb/node-api";

import { CliError } from "../../errors";
import {
  normalizeAndValidateAcceptedHeaderMappings,
} from "../header-mapping";
import { collectXlsxSheetSnapshot } from "../xlsx-sources";
import {
  buildExcelRange,
  normalizeExcelBodyStartRow,
  normalizeExcelHeaderRow,
  normalizeExcelRange,
  parseNormalizedExcelRange,
} from "./excel-range";
import {
  escapeSqlStringLiteral,
  getDuckDbManagedExtensionNameForFormat,
  quoteSqlIdentifier,
  toErrorMessage,
} from "./formats";
import { resolveMultiObjectSource } from "./source-resolution";
import type {
  DataQueryInputFormat,
  DataQuerySourceShape,
  ExcelImportMode,
  PreparedDataQuerySource,
  QueryRelationColumn,
} from "./types";
import { ensureDuckDbManagedExtensionLoaded } from "../extensions";

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

function buildRelationSql(
  inputPath: string,
  format: DataQueryInputFormat,
  shape: DataQuerySourceShape = {},
  options: {
    excelHeader?: boolean;
    excelImportMode?: ExcelImportMode;
  } = {},
): string {
  const escapedInput = escapeSqlStringLiteral(inputPath);
  switch (format) {
    case "csv":
      return `select * from read_csv_auto(${escapedInput}, delim = ',')`;
    case "tsv":
      return `select * from read_csv_auto(${escapedInput}, delim = '\t')`;
    case "parquet":
      return `select * from read_parquet(${escapedInput})`;
    case "sqlite":
      return `select * from sqlite_scan(${escapedInput}, ${escapeSqlStringLiteral(shape.source ?? "")})`;
    case "excel":
      return `select * from read_xlsx(${[
        escapedInput,
        `sheet = ${escapeSqlStringLiteral(shape.source ?? "")}`,
        ...(shape.range ? [`range = ${escapeSqlStringLiteral(shape.range)}`] : []),
        ...(options.excelHeader ? ["header = true"] : []),
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

  if (shape.bodyStartRow !== undefined) {
    throw new CliError("--body-start-row is only valid for Excel inputs.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
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
      `select HasHeader from sniff_csv(${escapeSqlStringLiteral(inputPath)}, delim = ${escapeSqlStringLiteral(delimiter)})`,
    );
    const rows = reader.getRowObjectsJson() as Array<{ HasHeader?: boolean }>;
    return rows[0]?.HasHeader === false;
  } catch {
    return false;
  }
}

function buildPreparedFileProjectionSql(
  columns: readonly QueryRelationColumn[],
  headerMappings: readonly import("../header-mapping").DataHeaderMappingEntry[],
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

function buildExcelImportModes(isShapedExcel: boolean): ExcelImportMode[] {
  return isShapedExcel ? ["empty_as_varchar", "all_varchar"] : ["default"];
}

async function createExcelTempViewWithRetries(options: {
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

async function resolveExcelBoundaryRange(options: {
  inputPath: string;
  selectedRange?: string;
  selectedSource: string;
}): Promise<{ parts: import("./types").ExcelRangeParts; range: string }> {
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

async function createSplitHeaderBodyExcelSourceView(options: {
  connection: DuckDBConnection;
  inputPath: string;
  rangeParts: import("./types").ExcelRangeParts;
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

  const bodyColumns = await collectQueryRelationColumns(options.connection, "file_source_body_raw", {
    format: "excel",
    inputPath: options.inputPath,
  });
  const headerReader = await options.connection.runAndReadAll(
    `select * from ${quoteSqlIdentifier("file_source_header_raw")} limit 1`,
  );
  const headerRow = (headerReader.getRowObjectsJson() as Array<Record<string, unknown>>)[0] ?? {};
  const nonEmptyBodyColumns = await collectNonEmptyBodyColumns(
    options.connection,
    "file_source_body_raw",
    bodyColumns,
  );

  const selectedColumns = (bodyColumns.filter((column) => {
    const headerName = normalizeHeaderCellName(headerRow[column.sourceName]);
    return headerName !== undefined || nonEmptyBodyColumns.has(column.sourceName);
  }) || bodyColumns).map((column) => ({
    aliasBase: normalizeHeaderCellName(headerRow[column.sourceName]) ?? column.name,
    column,
  }));
  const effectiveSelectedColumns = selectedColumns.length > 0
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
  const selectedBodyStartRow =
    shape.bodyStartRow !== undefined ? normalizeExcelBodyStartRow(shape.bodyStartRow) : undefined;
  const selectedRange = shape.range?.trim() ? normalizeExcelRange(shape.range) : undefined;
  const selectedHeaderRow =
    shape.headerRow !== undefined ? normalizeExcelHeaderRow(shape.headerRow) : undefined;
  let effectiveRange = selectedRange;
  let boundaryRangeParts: import("./types").ExcelRangeParts | undefined;

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
    if (selectedBodyStartRow !== undefined) {
      throw new CliError("--body-start-row is only valid for Excel inputs.", {
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

    if (selectedHeaderRow !== undefined || selectedBodyStartRow !== undefined) {
      const boundaryRange = await resolveExcelBoundaryRange({
        inputPath,
        selectedRange,
        selectedSource,
      });
      boundaryRangeParts = boundaryRange.parts;

      if (
        selectedHeaderRow !== undefined &&
        (selectedHeaderRow < boundaryRange.parts.startRow || selectedHeaderRow > boundaryRange.parts.endRow)
      ) {
        throw new CliError(
          `--header-row must fall within the ${selectedRange ? "selected Excel range" : "detected Excel sheet used range"} ${boundaryRange.range}.`,
          {
            code: "INVALID_INPUT",
            exitCode: 2,
          },
        );
      }

      if (
        selectedBodyStartRow !== undefined &&
        (selectedBodyStartRow < boundaryRange.parts.startRow ||
          selectedBodyStartRow > boundaryRange.parts.endRow)
      ) {
        throw new CliError(
          `--body-start-row must fall within the ${selectedRange ? "selected Excel range" : "detected Excel sheet used range"} ${boundaryRange.range}.`,
          {
            code: "INVALID_INPUT",
            exitCode: 2,
          },
        );
      }

      if (
        selectedHeaderRow !== undefined &&
        selectedBodyStartRow !== undefined &&
        selectedBodyStartRow <= selectedHeaderRow
      ) {
        throw new CliError("--body-start-row must be greater than --header-row when both are provided.", {
          code: "INVALID_INPUT",
          exitCode: 2,
        });
      }

      if (selectedBodyStartRow !== undefined && selectedHeaderRow === undefined) {
        effectiveRange = buildExcelRange({
          ...boundaryRange.parts,
          startRow: selectedBodyStartRow,
        });
      } else if (selectedHeaderRow !== undefined && selectedBodyStartRow === undefined) {
        effectiveRange = buildExcelRange({
          ...boundaryRange.parts,
          startRow: selectedHeaderRow,
        });
      }
    }
  }

  if (format === "csv" || format === "tsv" || format === "parquet") {
    assertSingleObjectSourceContract(format, shape);
  }

  const isShapedExcel =
    format === "excel" &&
    (selectedRange !== undefined ||
      selectedHeaderRow !== undefined ||
      selectedBodyStartRow !== undefined);

  if (
    format === "excel" &&
    selectedHeaderRow !== undefined &&
    selectedBodyStartRow !== undefined &&
    boundaryRangeParts
  ) {
    try {
      await createSplitHeaderBodyExcelSourceView({
        connection,
        inputPath,
        rangeParts: boundaryRangeParts,
        selectedBodyStartRow,
        selectedHeaderRow,
        selectedSource: selectedSource ?? "",
      });
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
            excludeBlankRows: true,
          },
        )}`,
      );
      return {
        selectedBodyStartRow,
        selectedHeaderRow,
        selectedRange,
        selectedSource,
      };
    } catch (error) {
      throw new CliError(`Failed to prepare ${format} query input: ${toErrorMessage(error)}`, {
        code: "DATA_QUERY_SOURCE_FAILED",
        exitCode: 2,
      });
    }
  }

  const excelImportModes = buildExcelImportModes(isShapedExcel);

  for (let index = 0; index < excelImportModes.length; index += 1) {
    const excelImportMode = excelImportModes[index] ?? "default";
    try {
      await connection.run(
        `create or replace temp view file_source as ${buildRelationSql(
          inputPath,
          format,
          {
            range: effectiveRange,
            source: selectedSource,
          },
          {
            excelHeader: selectedHeaderRow !== undefined,
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
            excludeBlankRows: isShapedExcel,
          },
        )}`,
      );
      return {
        selectedBodyStartRow,
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
