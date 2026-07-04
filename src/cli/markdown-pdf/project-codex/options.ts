import { stat } from "node:fs/promises";
import { extname } from "node:path";

import { ensureExistingFile } from "../../actions/markdown/common";
import { CliError } from "../../errors";
import { resolveFromCwd } from "../../path-utils";
import type { CliRuntime } from "../../types";
import type { MdPdfProjectCodexOptions, NormalizedMdPdfProjectCodexCommandState } from "./types";

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function normalizeTextList(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter((value) => value.length > 0);
}

async function existingPathIdentity(path: string): Promise<{ dev: number; ino: number }> {
  const stats = await stat(path);
  return { dev: stats.dev, ino: stats.ino };
}

function samePathIdentity(
  left: { dev: number; ino: number },
  right: { dev: number; ino: number },
): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

async function resolveOptionalInputPath(
  runtime: CliRuntime,
  options: MdPdfProjectCodexOptions,
): Promise<string | undefined> {
  const optionInput = normalizeOptionalText(options.input);
  const positionalInput = normalizeOptionalText(options.positionalInput);
  const resolvedOptionInput = optionInput ? resolveFromCwd(runtime, optionInput) : undefined;
  const resolvedPositionalInput = positionalInput
    ? resolveFromCwd(runtime, positionalInput)
    : undefined;

  if (resolvedOptionInput && resolvedPositionalInput) {
    await Promise.all([
      ensureExistingFile(resolvedOptionInput, "Markdown input"),
      ensureExistingFile(resolvedPositionalInput, "Markdown input"),
    ]);
    const [optionIdentity, positionalIdentity] = await Promise.all([
      existingPathIdentity(resolvedOptionInput),
      existingPathIdentity(resolvedPositionalInput),
    ]);
    if (!samePathIdentity(optionIdentity, positionalIdentity)) {
      throw new CliError("Positional input and --input must refer to the same Markdown file.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
  }

  const inputPath = resolvedOptionInput ?? resolvedPositionalInput;
  if (inputPath) {
    await ensureExistingFile(inputPath, "Markdown input");
  }
  return inputPath;
}

function resolveOptionalPath(runtime: CliRuntime, value: string | undefined): string | undefined {
  const normalized = normalizeOptionalText(value);
  return normalized ? resolveFromCwd(runtime, normalized) : undefined;
}

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
    inputPath: await resolveOptionalInputPath(runtime, options),
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
