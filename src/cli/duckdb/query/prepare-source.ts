import type { DuckDBConnection } from "@duckdb/node-api";

import { stringifyPreviewValue } from "../../data-preview/normalize";
import { CliError } from "../../errors";
import {
  normalizeAndValidateAcceptedHeaderMappings,
} from "../header-mapping";
import { collectXlsxSheetSnapshot } from "../xlsx-sources";
import { buildExcelRange, normalizeExcelHeaderRow, normalizeExcelRange, parseNormalizedExcelRange } from "./excel-range";
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
