import { extname } from "node:path";

import { CliError } from "../../errors";
import type { CliRuntime } from "../../types";
import {
  normalizeOptionalText,
  normalizeTextList,
  resolveOptionalMarkdownInputPath,
  resolveOptionalPath,
} from "../codex-command-state";
import type { MdPdfProjectCodexOptions, NormalizedMdPdfProjectCodexCommandState } from "./types";

function resolveOptionalReportPath(
  runtime: CliRuntime,
  value: string | undefined,
): string | undefined {
  const reportPath = resolveOptionalPath(runtime, value);
  if (reportPath && extname(reportPath).toLowerCase() !== ".json") {
    throw new CliError("Markdown PDF project Codex report path must end with .json.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return reportPath;
}

export async function normalizeMdPdfProjectCodexCommandState(
  runtime: CliRuntime,
  options: MdPdfProjectCodexOptions,
): Promise<NormalizedMdPdfProjectCodexCommandState> {
  const codexReportOutputPath = resolveOptionalReportPath(runtime, options.codexReportOutput);

  return {
    inputPath: await resolveOptionalMarkdownInputPath(runtime, options),
    intent: normalizeOptionalText(options.intent),
    fontHints: normalizeTextList(options.fontHint),
    baseProfilePath: resolveOptionalPath(runtime, options.baseProfile),
    coverImagePath: resolveOptionalPath(runtime, options.coverImage),
    outputDirectory: resolveOptionalPath(runtime, options.output),
    dryRun: options.dryRun === true,
    keepCodexReport: options.keepCodexReport === true || Boolean(codexReportOutputPath),
    codexReportOutputPath,
    overwrite: options.overwrite === true,
  };
}
