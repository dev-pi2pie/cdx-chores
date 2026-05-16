import { parseMarkdown } from "../../../markdown";
import { requireCommandAvailable } from "../../deps";
import { CliError } from "../../errors";
import { readTextFileRequired } from "../../file-io";
import {
  createMarkdownPdfRecipe,
  normalizeMarkdownPdfProfile,
  normalizeMarkdownPdfOptions,
  readMarkdownPdfProfileFile,
  renderMarkdownPdf,
  resolveMarkdownPdfCodeOptions,
  type MarkdownPdfCodeHighlighter,
  type MarkdownPdfProcessRunner,
  type NormalizeMarkdownPdfOptionsInput,
} from "../../markdown-pdf";
import { defaultOutputPath, resolveFromCwd } from "../../path-utils";
import { execCommand } from "../../process";
import type { CliRuntime } from "../../types";
import { assertNonEmpty, displayPath, ensureFileExists, printLine } from "../shared";
import { definedRecipeOptions, ensureExistingFile, ensureOutputDoesNotExist } from "./common";

export interface MdToPdfOptions extends NormalizeMarkdownPdfOptionsInput {
  input: string;
  output?: string;
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

export async function actionMdToPdf(runtime: CliRuntime, options: MdToPdfOptions): Promise<void> {
  const inputPath = resolveFromCwd(runtime, assertNonEmpty(options.input, "Input path"));
  const outputPath = resolveFromCwd(
    runtime,
    options.output?.trim() || defaultOutputPath(inputPath, ".pdf"),
  );
  const htmlOutputInput = options.htmlOutput?.trim();
  const htmlOutputPath = htmlOutputInput ? resolveFromCwd(runtime, htmlOutputInput) : undefined;
  const templateInput = options.template?.trim();
  const customTemplatePath = templateInput ? resolveFromCwd(runtime, templateInput) : undefined;
  const cssInput = options.css?.trim();
  const customCssPath = cssInput ? resolveFromCwd(runtime, cssInput) : undefined;
  const profileInput = options.profile?.trim();
  const profilePath = profileInput ? resolveFromCwd(runtime, profileInput) : undefined;

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
  const recipe = createMarkdownPdfRecipe(normalizedOptions, {
    profile: normalizedProfile.profile,
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
