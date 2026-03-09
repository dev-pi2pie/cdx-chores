import { readTextFileRequired, resolveFromCwd } from "../fs-utils";
import type { CliRuntime } from "../types";
import { printLine, assertNonEmpty, ensureFileExists } from "./shared";
import { createDataPreviewSource } from "../data-preview/source";
import { renderDataPreview } from "../data-preview/render";
import { CliError } from "../errors";

export interface DataPreviewOptions {
  columns?: string[];
  input: string;
  offset?: number;
  rows?: number;
}

const DEFAULT_DATA_PREVIEW_ROWS = 20;

export async function actionDataPreview(runtime: CliRuntime, options: DataPreviewOptions): Promise<void> {
  const inputPath = resolveFromCwd(runtime, assertNonEmpty(options.input, "Input path"));
  await ensureFileExists(inputPath, "Input");

  const raw = await readTextFileRequired(inputPath);
  const source = createDataPreviewSource(inputPath, raw);
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
    if (error instanceof Error && error.message.startsWith("Unknown columns:")) {
      throw new CliError(error.message, { code: "INVALID_INPUT", exitCode: 2 });
    }
    throw error;
  }
}
