import {
  normalizeMarkdownPdfOptions,
  type NormalizeMarkdownPdfOptionsInput,
} from "../../markdown-pdf";
import {
  bindPreparedMarkdownPdfProfileInitDestination,
  prepareMarkdownPdfProfileInit,
  writePreparedMarkdownPdfProfileInit,
} from "../../markdown-pdf/profile/init-service";
import type { CliRuntime } from "../../types";
import { printLine } from "../shared";

export interface MdPdfProfileInitOptions extends NormalizeMarkdownPdfOptionsInput {
  output: string;
  overwrite?: boolean;
}

export async function actionMdPdfProfileInit(
  runtime: CliRuntime,
  options: MdPdfProfileInitOptions,
): Promise<void> {
  const normalizedOptions = normalizeMarkdownPdfOptions(options);
  const prepared = prepareMarkdownPdfProfileInit(normalizedOptions);
  const destination = bindPreparedMarkdownPdfProfileInitDestination(runtime, prepared, {
    output: options.output,
    overwrite: options.overwrite,
  });
  await writePreparedMarkdownPdfProfileInit(destination);
  printLine(runtime.stdout, `Wrote Markdown PDF profile: ${destination.displayOutputPath}`);
}
