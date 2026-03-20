import type { DuckDBConnection } from "@duckdb/node-api";

import { ensureDuckDbManagedExtensionLoaded } from "../extensions";
import { normalizeAndValidateAcceptedHeaderMappings } from "../header-mapping";
import { CliError } from "../../errors";
import { normalizeExcelBodyStartRow, normalizeExcelHeaderRow, normalizeExcelRange, buildExcelRange } from "./excel-range";
import { getDuckDbManagedExtensionNameForFormat, toErrorMessage } from "./formats";
import { resolveMultiObjectSource } from "./source-resolution";
import type { DataQueryInputFormat, DataQuerySourceShape, PreparedDataQuerySource } from "./types";
import { collectQueryRelationColumns } from "./prepare-source/columns";
import {
  createSplitHeaderBodyExcelSourceView,
  isRetryableExcelImportError,
  resolveExcelBoundaryRange,
} from "./prepare-source/excel";
import {
  buildExcelImportModes,
  buildPreparedFileProjectionSql,
  buildRelationSql,
} from "./prepare-source/sql";
import { assertSingleObjectSourceContract } from "./prepare-source/validation";

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
  const noHeader = shape.noHeader === true;
  let effectiveRange = selectedRange;
  let boundaryRangeParts: import("./types").ExcelRangeParts | undefined;

  if (noHeader && format !== "csv" && format !== "tsv") {
    throw new CliError("--no-header is only valid for CSV and TSV query inputs.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

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
        noHeader,
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
            noHeader,
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
        noHeader,
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
