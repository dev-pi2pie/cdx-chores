import { readTextFileRequired, resolveFromCwd } from "../fs-utils";
import type { CliRuntime } from "../types";
import { printLine, assertNonEmpty, ensureFileExists } from "./shared";
import {
  applyContainsFilters,
  createDataPreviewSource,
  parseContainsFilterValues,
  type DataPreviewSource,
} from "../data-preview/source";
import { renderInMemoryDataPreview } from "../data-preview/render";
import { CliError } from "../errors";

export interface DataPreviewOptions {
  columns?: string[];
  contains?: string[];
  input: string;
  offset?: number;
  rows?: number;
}

const DEFAULT_DATA_PREVIEW_ROWS = 20;

export async function loadDataPreviewSource(
  runtime: CliRuntime,
  input: string,
): Promise<{ inputPath: string; source: DataPreviewSource }> {
  const inputPath = resolveFromCwd(runtime, assertNonEmpty(input, "Input path"));
  await ensureFileExists(inputPath, "Input");

  const raw = await readTextFileRequired(inputPath);
  return {
    inputPath,
    source: createDataPreviewSource(inputPath, raw),
  };
}

export async function actionDataPreview(runtime: CliRuntime, options: DataPreviewOptions): Promise<void> {
  const { inputPath, source: loadedSource } = await loadDataPreviewSource(runtime, options.input);
  const containsFilters = parseContainsFilterValues(options.contains);
  let source = loadedSource;
  if (containsFilters.length > 0) {
    source = applyContainsFilters(source, containsFilters);
  }
  const rowCount = options.rows ?? DEFAULT_DATA_PREVIEW_ROWS;
  const offset = options.offset ?? 0;

  try {
    const result = renderInMemoryDataPreview(runtime, source, {
      columns: options.columns,
      containsFilters,
      inputPath,
      offset,
      rowCount,
    });

    result.lines.forEach((line) => {
      printLine(runtime.stdout, line);
    });
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    if (error instanceof Error && error.message.startsWith("Unknown columns:")) {
      throw new CliError(error.message, { code: "INVALID_INPUT", exitCode: 2 });
    }
    throw error;
  }
}
