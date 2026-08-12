import { parseMarkdown } from "../../../markdown";

import { requireCommandAvailable, requireCommandMinimumVersion } from "../../deps";
import { CliError } from "../../errors";
import { readTextFileRequired } from "../../file-io";
import { defaultOutputPath, resolveFromCwd } from "../../path-utils";
import { execCommand } from "../../process";
import type { CliRuntime } from "../../types";
import { assertNonEmpty, displayPath, ensureFileExists } from "../shared";
import { definedRecipeOptions, ensureExistingFile, ensureOutputDoesNotExist } from "./common";
import { createMarkdownPdfRecipe, type MarkdownPdfRecipe } from "../../markdown-pdf/recipe";
import {
  discoverMarkdownPdfRenderBundle,
  resolveMarkdownPdfRenderBundleInputs,
  type MarkdownPdfRenderBundleResolvedInputs,
} from "../../markdown-pdf/render-bundle";
import {
  normalizeMarkdownPdfProfile,
  readMarkdownPdfProfileFile,
  resolveMarkdownPdfCodeOptions,
  type EffectiveMarkdownPdfCodeOptions,
  type NormalizedMarkdownPdfProfile,
} from "../../markdown-pdf/profile";
import {
  collectMarkdownPdfTitleSignals,
  type MarkdownPdfTitleSignals,
} from "../../markdown-pdf/profile/signals";
import {
  renderMarkdownPdf,
  type MarkdownPdfCodeHighlighter,
  type MarkdownPdfProcessRunner,
  type RenderMarkdownPdfResult,
} from "../../markdown-pdf/render";
import { MARKDOWN_PDF_MINIMUM_PANDOC_VERSION } from "../../markdown-pdf/requirements";
import {
  normalizeMarkdownPdfOptions,
  type NormalizeMarkdownPdfOptionsInput,
  type NormalizedMarkdownPdfOptions,
} from "../../markdown-pdf/validation";
import { assessMarkdownPdfTemplateCompatibility } from "../../markdown-pdf/template-compatibility";
import type { MarkdownPdfTemplateCompatibilityResult } from "../../markdown-pdf/template-compatibility";

export interface PrepareMarkdownPdfRenderInput extends NormalizeMarkdownPdfOptionsInput {
  input: string;
  bundle?: string;
  profile?: string;
  meta?: string[];
  template?: string;
  css?: string;
  noDefaultCss?: boolean;
  codeHighlight?: boolean;
}

export interface PreparedMarkdownPdfRender {
  bundleDirectory?: string;
  code: EffectiveMarkdownPdfCodeOptions;
  customCssPath?: string;
  customTemplatePath?: string;
  ignoredBundleProfileFiles: string[];
  inputPath: string;
  noDefaultCss?: boolean;
  normalizedProfile: NormalizedMarkdownPdfProfile;
  options: NormalizedMarkdownPdfOptions;
  recipe: MarkdownPdfRecipe;
  resolvedInputs: MarkdownPdfRenderBundleResolvedInputs;
  resolvedBundle?: MarkdownPdfRenderBundleResolvedInputs;
  templateCompatibility: MarkdownPdfTemplateCompatibilityResult;
  titleSignals: MarkdownPdfTitleSignals;
}

export interface MarkdownPdfRenderOutputInput {
  output?: string;
  htmlOutput?: string;
  overwrite?: boolean;
}

export interface PlannedMarkdownPdfRender {
  htmlOutputPath?: string;
  outputPath: string;
  overwrite?: boolean;
  prepared: PreparedMarkdownPdfRender;
}

export interface ResolvedMarkdownPdfRenderOutput {
  htmlOutputPath?: string;
  outputPath: string;
  overwrite?: boolean;
}

export interface ExecutePlannedMarkdownPdfRenderOptions {
  runner?: MarkdownPdfProcessRunner;
  codeHighlighter?: MarkdownPdfCodeHighlighter;
}

export async function prepareMarkdownPdfRender(
  runtime: CliRuntime,
  input: PrepareMarkdownPdfRenderInput,
): Promise<PreparedMarkdownPdfRender> {
  const inputPath = resolveFromCwd(runtime, assertNonEmpty(input.input, "Input path"));
  const bundleInput =
    input.bundle === undefined ? undefined : assertNonEmpty(input.bundle, "Bundle directory");
  const bundleDirectory = bundleInput ? resolveFromCwd(runtime, bundleInput) : undefined;
  const templateInput = input.template?.trim();
  let customTemplatePath = templateInput ? resolveFromCwd(runtime, templateInput) : undefined;
  const cssInput = input.css?.trim();
  let customCssPath = cssInput ? resolveFromCwd(runtime, cssInput) : undefined;
  const profileInput = input.profile?.trim();
  let profilePath = profileInput ? resolveFromCwd(runtime, profileInput) : undefined;
  let resolvedBundle: MarkdownPdfRenderBundleResolvedInputs | undefined;
  let ignoredBundleProfileFiles: string[] = [];

  if (bundleDirectory) {
    const candidates = await discoverMarkdownPdfRenderBundle(bundleDirectory, {
      profileResolved: profilePath !== undefined,
    });
    ignoredBundleProfileFiles = candidates.ignoredProfileFiles;
    resolvedBundle = resolveMarkdownPdfRenderBundleInputs(
      candidates,
      {
        profile: profilePath,
        template: customTemplatePath,
        css: customCssPath,
      },
      { displayDirectory: displayPath(runtime, bundleDirectory) },
    );
    profilePath = resolvedBundle.profile?.path;
    customTemplatePath = resolvedBundle.template?.path;
    customCssPath = resolvedBundle.css?.path;
  }

  await ensureFileExists(inputPath, "Input");
  const rawMarkdown = await readTextFileRequired(inputPath);
  const parsedMarkdown = parseMarkdown(rawMarkdown);
  const profileData = profilePath ? await readMarkdownPdfProfileFile(profilePath) : undefined;
  const normalizedProfile = normalizeMarkdownPdfProfile({
    profile: profileData,
    frontmatter: parsedMarkdown.data,
    meta: input.meta,
  });
  const options = normalizeMarkdownPdfOptions({
    ...normalizedProfile.recipeOptions,
    ...definedRecipeOptions(input),
  });
  const code = resolveMarkdownPdfCodeOptions({
    profile: normalizedProfile.profile.code,
    cliHighlight: input.codeHighlight,
  });
  const titleSignals = collectMarkdownPdfTitleSignals(parsedMarkdown.content, parsedMarkdown.data);
  const initialRecipe = createMarkdownPdfRecipe(options, {
    profile: normalizedProfile.profile,
    titleSignals,
  });

  if (customTemplatePath) {
    await ensureExistingFile(customTemplatePath, "Template");
  }
  if (customCssPath) {
    await ensureExistingFile(customCssPath, "CSS");
  }

  const selectedTemplateHtml = customTemplatePath
    ? await readTextFileRequired(customTemplatePath)
    : initialRecipe.templateHtml;
  const templateCompatibility = assessMarkdownPdfTemplateCompatibility({
    builtIn: customTemplatePath === undefined,
    profile: normalizedProfile.profile,
    templateHtml: selectedTemplateHtml,
  });
  const recipe = createMarkdownPdfRecipe(options, {
    bodyBoundary: templateCompatibility.bodyBoundary,
    profile: normalizedProfile.profile,
    titleSignals,
  });

  const resolvedInputs =
    resolvedBundle ??
    ({
      profile: profilePath ? { path: profilePath, source: "explicit" } : undefined,
      template: customTemplatePath ? { path: customTemplatePath, source: "explicit" } : undefined,
      css: customCssPath ? { path: customCssPath, source: "explicit" } : undefined,
    } satisfies MarkdownPdfRenderBundleResolvedInputs);

  return {
    bundleDirectory,
    code,
    customCssPath,
    customTemplatePath,
    ignoredBundleProfileFiles,
    inputPath,
    noDefaultCss: input.noDefaultCss,
    normalizedProfile: normalizedProfile.profile,
    options,
    recipe,
    resolvedInputs,
    resolvedBundle,
    templateCompatibility,
    titleSignals,
  };
}

export async function planMarkdownPdfRender(
  runtime: CliRuntime,
  prepared: PreparedMarkdownPdfRender,
  input: MarkdownPdfRenderOutputInput,
): Promise<PlannedMarkdownPdfRender> {
  return bindResolvedMarkdownPdfRenderOutput(
    prepared,
    await resolveMarkdownPdfRenderOutput(runtime, prepared.inputPath, input),
  );
}

export async function resolveMarkdownPdfRenderOutput(
  runtime: CliRuntime,
  inputPath: string,
  input: MarkdownPdfRenderOutputInput,
): Promise<ResolvedMarkdownPdfRenderOutput> {
  const outputPath = resolveFromCwd(
    runtime,
    input.output?.trim() || defaultOutputPath(inputPath, ".pdf"),
  );
  const htmlOutputInput = input.htmlOutput?.trim();
  const htmlOutputPath = htmlOutputInput ? resolveFromCwd(runtime, htmlOutputInput) : undefined;

  if (htmlOutputPath && htmlOutputPath === outputPath) {
    throw new CliError("--html-output must be different from the PDF output path.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  await ensureOutputDoesNotExist(outputPath, input.overwrite);
  if (htmlOutputPath) {
    await ensureOutputDoesNotExist(htmlOutputPath, input.overwrite);
  }

  return { htmlOutputPath, outputPath, overwrite: input.overwrite };
}

export function bindResolvedMarkdownPdfRenderOutput(
  prepared: PreparedMarkdownPdfRender,
  output: ResolvedMarkdownPdfRenderOutput,
): PlannedMarkdownPdfRender {
  return { ...output, prepared };
}

export async function executePlannedMarkdownPdfRender(
  runtime: CliRuntime,
  plan: PlannedMarkdownPdfRender,
  options: ExecutePlannedMarkdownPdfRenderOptions = {},
): Promise<RenderMarkdownPdfResult> {
  const runner = options.runner ?? execCommand;
  const pandoc = await requireCommandAvailable("pandoc", runtime.platform, runner);
  requireCommandMinimumVersion(pandoc, MARKDOWN_PDF_MINIMUM_PANDOC_VERSION, "md to-pdf");
  await requireCommandAvailable("weasyprint", runtime.platform, runner);

  const result = await renderMarkdownPdf({
    inputPath: plan.prepared.inputPath,
    outputPath: plan.outputPath,
    templateHtml: plan.prepared.recipe.templateHtml,
    defaultCss: plan.prepared.recipe.styleCss,
    customTemplatePath: plan.prepared.customTemplatePath,
    customCssPath: plan.prepared.customCssPath,
    noDefaultCss: plan.prepared.noDefaultCss,
    htmlOutputPath: plan.htmlOutputPath,
    overwrite: plan.overwrite,
    options: plan.prepared.options,
    code: plan.prepared.code,
    runner,
    codeHighlighter: options.codeHighlighter,
  });
  return {
    ...result,
    warnings: [...plan.prepared.templateCompatibility.warnings, ...result.warnings],
  };
}
