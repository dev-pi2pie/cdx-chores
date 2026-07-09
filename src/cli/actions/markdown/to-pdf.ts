import { parseMarkdown } from "../../../markdown";
import { relative } from "node:path";
import { requireCommandAvailable } from "../../deps";
import { CliError } from "../../errors";
import { readTextFileRequired } from "../../file-io";
import {
  createMarkdownPdfRecipe,
  discoverMarkdownPdfRenderBundle,
  normalizeMarkdownPdfProfile,
  normalizeMarkdownPdfOptions,
  readMarkdownPdfProfileFile,
  renderMarkdownPdf,
  resolveMarkdownPdfRenderBundleInputs,
  resolveMarkdownPdfCodeOptions,
  type MarkdownPdfCodeHighlighter,
  type MarkdownPdfProcessRunner,
  type MarkdownPdfRenderBundleResolvedInputs,
  type NormalizeMarkdownPdfOptionsInput,
} from "../../markdown-pdf";
import { collectMarkdownPdfTitleSignals } from "../../markdown-pdf/profile/signals";
import { defaultOutputPath, resolveFromCwd } from "../../path-utils";
import { execCommand } from "../../process";
import type { CliRuntime } from "../../types";
import { assertNonEmpty, displayPath, ensureFileExists, printLine } from "../shared";
import { definedRecipeOptions, ensureExistingFile, ensureOutputDoesNotExist } from "./common";

export interface MdToPdfOptions extends NormalizeMarkdownPdfOptionsInput {
  input: string;
  output?: string;
  bundle?: string;
  profile?: string;
  meta?: string[];
  template?: string;
  css?: string;
  noDefaultCss?: boolean;
  htmlOutput?: string;
  codeHighlight?: boolean;
  overwrite?: boolean;
  runner?: MarkdownPdfProcessRunner;
  codeHighlighter?: MarkdownPdfCodeHighlighter;
}

function printRenderBundleSummary(input: {
  bundleDirectory: string;
  resolved: MarkdownPdfRenderBundleResolvedInputs;
  runtime: CliRuntime;
}): void {
  printLine(
    input.runtime.stdout,
    `Resolved Markdown PDF bundle: ${displayPath(input.runtime, input.bundleDirectory)}`,
  );
  for (const role of ["profile", "template", "css"] as const) {
    const resolvedInput = input.resolved[role];
    if (!resolvedInput) {
      continue;
    }
    const resolvedPath =
      resolvedInput.source === "bundle"
        ? relative(input.bundleDirectory, resolvedInput.path)
        : displayPath(input.runtime, resolvedInput.path);
    const sourceLabel = resolvedInput.source === "explicit" ? " (explicit)" : "";
    printLine(input.runtime.stdout, `- ${role}: ${resolvedPath}${sourceLabel}`);
  }
}

export async function actionMdToPdf(runtime: CliRuntime, options: MdToPdfOptions): Promise<void> {
  const inputPath = resolveFromCwd(runtime, assertNonEmpty(options.input, "Input path"));
  const bundleInput =
    options.bundle === undefined ? undefined : assertNonEmpty(options.bundle, "Bundle directory");
  const bundleDirectory = bundleInput ? resolveFromCwd(runtime, bundleInput) : undefined;
  const outputPath = resolveFromCwd(
    runtime,
    options.output?.trim() || defaultOutputPath(inputPath, ".pdf"),
  );
  const htmlOutputInput = options.htmlOutput?.trim();
  const htmlOutputPath = htmlOutputInput ? resolveFromCwd(runtime, htmlOutputInput) : undefined;
  const templateInput = options.template?.trim();
  let customTemplatePath = templateInput ? resolveFromCwd(runtime, templateInput) : undefined;
  const cssInput = options.css?.trim();
  let customCssPath = cssInput ? resolveFromCwd(runtime, cssInput) : undefined;
  const profileInput = options.profile?.trim();
  let profilePath = profileInput ? resolveFromCwd(runtime, profileInput) : undefined;
  let resolvedBundle: MarkdownPdfRenderBundleResolvedInputs | undefined;

  if (bundleDirectory) {
    const candidates = await discoverMarkdownPdfRenderBundle(bundleDirectory);
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
    meta: options.meta,
  });
  const normalizedOptions = normalizeMarkdownPdfOptions({
    ...normalizedProfile.recipeOptions,
    ...definedRecipeOptions(options),
  });
  const codeOptions = resolveMarkdownPdfCodeOptions({
    profile: normalizedProfile.profile.code,
    cliHighlight: options.codeHighlight,
  });
  const titleSignals = collectMarkdownPdfTitleSignals(parsedMarkdown.content, parsedMarkdown.data);
  const recipe = createMarkdownPdfRecipe(normalizedOptions, {
    profile: normalizedProfile.profile,
    titleSignals,
  });

  if (customTemplatePath) {
    await ensureExistingFile(customTemplatePath, "Template");
  }
  if (customCssPath) {
    await ensureExistingFile(customCssPath, "CSS");
  }
  if (htmlOutputPath && htmlOutputPath === outputPath) {
    throw new CliError("--html-output must be different from the PDF output path.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  await ensureOutputDoesNotExist(outputPath, options.overwrite);
  if (htmlOutputPath) {
    await ensureOutputDoesNotExist(htmlOutputPath, options.overwrite);
  }

  if (bundleDirectory && resolvedBundle) {
    printRenderBundleSummary({ bundleDirectory, resolved: resolvedBundle, runtime });
  }

  const runner = options.runner ?? execCommand;
  await requireCommandAvailable("pandoc", runtime.platform, runner);
  await requireCommandAvailable("weasyprint", runtime.platform, runner);

  const result = await renderMarkdownPdf({
    inputPath,
    outputPath,
    templateHtml: recipe.templateHtml,
    defaultCss: recipe.styleCss,
    customTemplatePath,
    customCssPath,
    noDefaultCss: options.noDefaultCss,
    htmlOutputPath,
    overwrite: options.overwrite,
    options: normalizedOptions,
    code: codeOptions,
    runner,
    codeHighlighter: options.codeHighlighter,
  });

  if (result.warnings.length > 0) {
    printLine(runtime.stderr, "Markdown PDF render warnings:");
    for (const warning of result.warnings) {
      printLine(runtime.stderr, `- ${warning}`);
    }
  }

  printLine(runtime.stdout, `Wrote PDF: ${displayPath(runtime, outputPath)}`);
}
