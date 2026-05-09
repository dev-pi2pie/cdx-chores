import {
  createMarkdownPdfProfileConfig,
  inferMarkdownPdfProfileFormat,
  normalizeMarkdownPdfOptions,
  serializeMarkdownPdfProfile,
  type NormalizeMarkdownPdfOptionsInput,
} from "../../markdown-pdf";
import { writeTextFileSafe } from "../../file-io";
import { resolveFromCwd } from "../../path-utils";
import type { CliRuntime } from "../../types";
import { assertNonEmpty, displayPath, printLine } from "../shared";

export interface MdPdfProfileInitOptions extends NormalizeMarkdownPdfOptionsInput {
  output: string;
  overwrite?: boolean;
}

export async function actionMdPdfProfileInit(
  runtime: CliRuntime,
  options: MdPdfProfileInitOptions,
): Promise<void> {
  const outputPath = resolveFromCwd(runtime, assertNonEmpty(options.output, "Output path"));
  const format = inferMarkdownPdfProfileFormat(outputPath);
  const normalizedOptions = normalizeMarkdownPdfOptions(options);
  const profile = createMarkdownPdfProfileConfig(normalizedOptions);
  const serialized = serializeMarkdownPdfProfile(profile, format);

  await writeTextFileSafe(outputPath, serialized, {
    overwrite: options.overwrite,
  });

  printLine(runtime.stdout, `Wrote Markdown PDF profile: ${displayPath(runtime, outputPath)}`);
}
