import { stat } from "node:fs/promises";
import { extname } from "node:path";

import { CliError } from "../../errors";
import { ensureExistingFile } from "../../actions/markdown/common";
import { readMarkdownPdfProfileFile } from "../profile";
import { normalizeMarkdownPdfOptions } from "../validation";
import { resolveFromCwd } from "../../path-utils";
import type { CliRuntime } from "../../types";
import type { MdPdfTemplateCodexOptions, NormalizedMdPdfTemplateCodexCommandState } from "./types";
import {
  imageFormatForPath,
  isAnimatedTemplateCodexCoverImage,
  SUPPORTED_TEMPLATE_CODEX_COVER_IMAGE_EXTENSIONS,
} from "./image-metadata";
import { collectMdPdfTemplateCodexExplicitRecipeSignal } from "./recipe-signals";

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
  options: MdPdfTemplateCodexOptions,
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

  return resolvedOptionInput ?? resolvedPositionalInput;
}

async function resolveExistingFile(
  runtime: CliRuntime,
  value: string | undefined,
  label: string,
): Promise<string | undefined> {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    return undefined;
  }
  const path = resolveFromCwd(runtime, normalized);
  await ensureExistingFile(path, label);
  return path;
}

async function resolveBaseProfile(
  runtime: CliRuntime,
  value: string | undefined,
): Promise<string | undefined> {
  const baseProfilePath = await resolveExistingFile(runtime, value, "Base profile");
  if (!baseProfilePath) {
    return undefined;
  }
  await readMarkdownPdfProfileFile(baseProfilePath);
  return baseProfilePath;
}

async function resolveCoverImage(
  runtime: CliRuntime,
  value: string | undefined,
): Promise<string | undefined> {
  const normalized = normalizeOptionalText(value);
  if (/^(?:https?:|file:|data:)/i.test(normalized ?? "")) {
    throw new CliError("Cover image must be a local PNG, JPEG, or WebP file.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  const coverImagePath = await resolveExistingFile(runtime, normalized, "Cover image");
  if (!coverImagePath) {
    return undefined;
  }
  const extension = extname(coverImagePath).toLowerCase();
  if (!SUPPORTED_TEMPLATE_CODEX_COVER_IMAGE_EXTENSIONS.has(extension)) {
    throw new CliError("Cover image must be a local PNG, JPEG, or WebP file.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  if (await isAnimatedTemplateCodexCoverImage(coverImagePath, imageFormatForPath(coverImagePath))) {
    throw new CliError("Cover image must be a local still PNG, JPEG, or WebP file.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return coverImagePath;
}

function resolveOptionalOutputPath(
  runtime: CliRuntime,
  value: string | undefined,
): string | undefined {
  const normalized = normalizeOptionalText(value);
  return normalized ? resolveFromCwd(runtime, normalized) : undefined;
}

function resolveOptionalReportPath(
  runtime: CliRuntime,
  value: string | undefined,
): string | undefined {
  const reportPath = resolveOptionalOutputPath(runtime, value);
  if (reportPath && extname(reportPath).toLowerCase() !== ".json") {
    throw new CliError("Markdown PDF template Codex report path must end with .json.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return reportPath;
}

export async function normalizeMdPdfTemplateCodexCommandState(
  runtime: CliRuntime,
  options: MdPdfTemplateCodexOptions,
): Promise<NormalizedMdPdfTemplateCodexCommandState> {
  const inputPath = await resolveOptionalInputPath(runtime, options);
  if (inputPath) {
    await ensureExistingFile(inputPath, "Markdown input");
  }

  const [baseProfilePath, coverImagePath] = await Promise.all([
    resolveBaseProfile(runtime, options.baseProfile),
    resolveCoverImage(runtime, options.coverImage),
  ]);
  const codexReportOutputPath = resolveOptionalReportPath(runtime, options.codexReportOutput);
  const explicitRecipe = collectMdPdfTemplateCodexExplicitRecipeSignal(options);

  return {
    inputPath,
    intent: normalizeOptionalText(options.intent),
    fontHints: normalizeTextList(options.fontHint),
    baseProfilePath,
    coverImagePath,
    outputPath: resolveOptionalOutputPath(runtime, options.output),
    dryRun: options.dryRun === true,
    keepCodexReport: options.keepCodexReport === true || Boolean(codexReportOutputPath),
    codexReportOutputPath,
    overwrite: options.overwrite === true,
    recipeOptions: normalizeMarkdownPdfOptions(explicitRecipe.options),
    explicitRecipe,
    templateBundleIdFactory: options.templateBundleIdFactory,
  };
}
