import {
  normalizeMarkdownPdfOptions,
  type NormalizeMarkdownPdfOptionsInput,
} from "../../markdown-pdf";
import {
  bindPreparedMarkdownPdfTemplateInitDestination,
  prepareMarkdownPdfTemplateInit,
  writePreparedMarkdownPdfTemplateInit,
} from "../../markdown-pdf/template/init-service";
import type { CliRuntime } from "../../types";
import { printLine } from "../shared";

export interface MdPdfTemplateInitOptions extends NormalizeMarkdownPdfOptionsInput {
  output: string;
  overwrite?: boolean;
}

export async function actionMdPdfTemplateInit(
  runtime: CliRuntime,
  options: MdPdfTemplateInitOptions,
): Promise<void> {
  const normalizedOptions = normalizeMarkdownPdfOptions(options);
  const prepared = prepareMarkdownPdfTemplateInit(normalizedOptions);
  const destination = await bindPreparedMarkdownPdfTemplateInitDestination(runtime, prepared, {
    output: options.output,
    overwrite: options.overwrite,
  });
  await writePreparedMarkdownPdfTemplateInit(destination);
  printLine(runtime.stdout, `Wrote Markdown PDF template: ${destination.displayOutputDirectory}`);
}
