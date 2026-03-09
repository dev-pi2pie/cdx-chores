import { extname } from "node:path";

import { resolveFromCwd } from "../fs-utils";
import type { CliRuntime } from "../types";
import { renderDataPreview, type RenderDataPreviewSource } from "../data-preview/render";
import { loadParquetPreviewWindow } from "../duckdb/parquet-preview";
import { CliError } from "../errors";
import { assertNonEmpty, ensureFileExists, printLine } from "./shared";

export interface DataParquetPreviewOptions {
  columns?: string[];
  input: string;
  offset?: number;
  rows?: number;
}

const DEFAULT_PARQUET_PREVIEW_ROWS = 20;

export async function actionDataParquetPreview(
  runtime: CliRuntime,
  options: DataParquetPreviewOptions,
): Promise<void> {
  const inputPath = resolveFromCwd(runtime, assertNonEmpty(options.input, "Input path"));
  await ensureFileExists(inputPath, "Input");

  if (extname(inputPath).toLowerCase() !== ".parquet") {
    throw new CliError("Parquet preview requires a .parquet input file.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const rowCount = options.rows ?? DEFAULT_PARQUET_PREVIEW_ROWS;
  const offset = options.offset ?? 0;
  const preview = await loadParquetPreviewWindow({
    columns: options.columns,
    inputPath,
    offset,
    rowCount,
  });

  const source: RenderDataPreviewSource = {
    columns: preview.allColumns,
    format: "parquet",
    totalRows: preview.totalRows,
    getWindow(requestedOffset, requestedRowCount) {
      const start = Math.max(0, requestedOffset - offset);
      return preview.rows.slice(start, start + requestedRowCount);
    },
  };

  const result = renderDataPreview(runtime, source, {
    columns: options.columns,
    inputPath,
    offset,
    rowCount,
  });

  result.lines.forEach((line) => {
    printLine(runtime.stdout, line);
  });
}
