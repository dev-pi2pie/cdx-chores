import { extname } from "node:path";

import { CliError } from "../../errors";
import { ensureExistingFile } from "../../actions/markdown/common";
import { readMarkdownPdfProfileFile } from "../profile";
import { normalizeMarkdownPdfOptions } from "../validation";
import type { CliRuntime } from "../../types";
import {
  normalizeOptionalText,
  normalizeTextList,
  resolveOptionalMarkdownInputPath,
  resolveOptionalPath,
} from "../codex-command-state";
import type { MdPdfTemplateCodexOptions, NormalizedMdPdfTemplateCodexCommandState } from "./types";
import {
  imageFormatForPath,
  isAnimatedTemplateCodexCoverImage,
  SUPPORTED_TEMPLATE_CODEX_COVER_IMAGE_EXTENSIONS,
} from "./image-metadata";
import { collectMdPdfTemplateCodexExplicitRecipeSignal } from "./recipe-signals";

async function resolveExistingFile(
  runtime: CliRuntime,
  value: string | undefined,
  label: string,
): Promise<string | undefined> {
  const path = resolveOptionalPath(runtime, value);
  if (!path) {
    return undefined;
  }
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

function resolveOptionalReportPath(
  runtime: CliRuntime,
  value: string | undefined,
): string | undefined {
  const reportPath = resolveOptionalPath(runtime, value);
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
  const inputPath = await resolveOptionalMarkdownInputPath(runtime, options);

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
    outputPath: resolveOptionalPath(runtime, options.output),
    dryRun: options.dryRun === true,
    keepCodexReport: options.keepCodexReport === true || Boolean(codexReportOutputPath),
    codexReportOutputPath,
    overwrite: options.overwrite === true,
    recipeOptions: normalizeMarkdownPdfOptions(explicitRecipe.options),
    explicitRecipe,
    templateBundleIdFactory: options.templateBundleIdFactory,
  };
}
