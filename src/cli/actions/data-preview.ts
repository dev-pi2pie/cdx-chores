import { readTextFileRequired, resolveFromCwd } from "../fs-utils";
import type { CliRuntime } from "../types";
import { printLine, assertNonEmpty, ensureFileExists } from "./shared";
import {
  applyContainsFilters,
  createDataPreviewSource,
  parseContainsFilterValue,
} from "../data-preview/source";
import { renderDataPreview } from "../data-preview/render";
import { CliError } from "../errors";

export interface DataPreviewOptions {
  columns?: string[];
  contains?: string[];
  input: string;
  offset?: number;
  rows?: number;
}

const DEFAULT_DATA_PREVIEW_ROWS = 20;

export async function actionDataPreview(runtime: CliRuntime, options: DataPreviewOptions): Promise<void> {
  const inputPath = resolveFromCwd(runtime, assertNonEmpty(options.input, "Input path"));
  await ensureFileExists(inputPath, "Input");

  const raw = await readTextFileRequired(inputPath);
  let source = createDataPreviewSource(inputPath, raw);
  if (options.contains && options.contains.length > 0) {
    source = applyContainsFilters(source, options.contains.map((value) => parseContainsFilterValue(value)));
  }
  const rowCount = options.rows ?? DEFAULT_DATA_PREVIEW_ROWS;
  const offset = options.offset ?? 0;

  try {
    const result = renderDataPreview(runtime, source, {
      columns: options.columns,
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
