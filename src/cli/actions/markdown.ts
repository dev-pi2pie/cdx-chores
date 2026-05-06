import { mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import { parseMarkdown } from "../../markdown";
import { requireCommandAvailable } from "../deps";
import { CliError } from "../errors";
import { readTextFileRequired, writeTextFileSafe } from "../file-io";
import {
  createMarkdownPdfRecipe,
  normalizeMarkdownPdfOptions,
  renderMarkdownPdf,
  type MarkdownPdfProcessRunner,
  type NormalizeMarkdownPdfOptionsInput,
} from "../markdown-pdf";
import { defaultOutputPath, resolveFromCwd } from "../path-utils";
import { execCommand } from "../process";
import type { CliRuntime } from "../types";
import { assertNonEmpty, displayPath, ensureFileExists, printLine } from "./shared";

export interface MdToDocxOptions {
  input: string;
  output?: string;
  overwrite?: boolean;
}

export async function actionMdToDocx(runtime: CliRuntime, options: MdToDocxOptions): Promise<void> {
  const inputPath = resolveFromCwd(runtime, assertNonEmpty(options.input, "Input path"));
  const outputPath = resolveFromCwd(
    runtime,
    options.output?.trim() || defaultOutputPath(inputPath, ".docx"),
  );
  await ensureFileExists(inputPath, "Input");
  await requireCommandAvailable("pandoc", runtime.platform);

  if (!options.overwrite) {
    try {
      await stat(outputPath);
      throw new CliError(
        `Output file already exists: ${outputPath}. Use --overwrite to replace it.`,
        {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
        },
      );
    } catch (error) {
      if (error instanceof CliError) {
        throw error;
      }
    }
  }

  const args = [inputPath, "-o", outputPath];
  const result = await execCommand("pandoc", args, { cwd: runtime.cwd });
  if (!result.ok) {
    throw new CliError(
      `pandoc failed (${result.code ?? "unknown"}): ${result.stderr || result.stdout}`.trim(),
      {
        code: "PROCESS_FAILED",
        exitCode: 1,
      },
    );
  }

  printLine(runtime.stdout, `Wrote DOCX: ${displayPath(runtime, outputPath)}`);
}

export interface MdToPdfOptions extends NormalizeMarkdownPdfOptionsInput {
  input: string;
  output?: string;
  template?: string;
  css?: string;
  noDefaultCss?: boolean;
  htmlOutput?: string;
  overwrite?: boolean;
  runner?: MarkdownPdfProcessRunner;
}

export interface MdPdfTemplateInitOptions extends NormalizeMarkdownPdfOptionsInput {
  output: string;
  overwrite?: boolean;
}

async function ensureOutputDoesNotExist(
  path: string,
  overwrite: boolean | undefined,
): Promise<void> {
  if (overwrite) {
    return;
  }

  try {
    await stat(path);
    throw new CliError(`Output file already exists: ${path}. Use --overwrite to replace it.`, {
      code: "OUTPUT_EXISTS",
      exitCode: 2,
    });
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    if (isNotFoundError(error)) {
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Failed to inspect output file: ${path} (${message})`, {
      code: "FILE_READ_ERROR",
      exitCode: 2,
    });
  }
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

async function ensureExistingFile(path: string, label: string): Promise<void> {
  let stats: Awaited<ReturnType<typeof stat>>;
  try {
    stats = await stat(path);
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new CliError(`${label} file not found: ${path}`, {
        code: "FILE_NOT_FOUND",
        exitCode: 2,
      });
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Failed to inspect ${label.toLowerCase()} file: ${path} (${message})`, {
      code: "FILE_READ_ERROR",
      exitCode: 2,
    });
  }

  if (!stats.isFile()) {
    throw new CliError(`${label} path is not a file: ${path}`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
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

  const normalizedOptions = normalizeMarkdownPdfOptions(options);
  const recipe = createMarkdownPdfRecipe(normalizedOptions);

  await ensureFileExists(inputPath, "Input");
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
    runner,
  });

  if (result.warnings.length > 0) {
    printLine(runtime.stderr, "Markdown PDF render warnings:");
    for (const warning of result.warnings) {
      printLine(runtime.stderr, `- ${warning}`);
    }
  }

  printLine(runtime.stdout, `Wrote PDF: ${displayPath(runtime, outputPath)}`);
}

export async function actionMdPdfTemplateInit(
  runtime: CliRuntime,
  options: MdPdfTemplateInitOptions,
): Promise<void> {
  const outputDirectory = resolveFromCwd(runtime, assertNonEmpty(options.output, "Output path"));
  const normalizedOptions = normalizeMarkdownPdfOptions(options);
  const recipe = createMarkdownPdfRecipe(normalizedOptions);
  let outputDirectoryExists = false;

  try {
    const stats = await stat(outputDirectory);
    if (!stats.isDirectory()) {
      throw new CliError(`Template output path is not a directory: ${outputDirectory}`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    outputDirectoryExists = true;
  } catch (error) {
    if (!isNotFoundError(error)) {
      if (error instanceof CliError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new CliError(
        `Failed to inspect template output directory: ${outputDirectory} (${message})`,
        {
          code: "FILE_READ_ERROR",
          exitCode: 2,
        },
      );
    }
    await mkdir(outputDirectory, { recursive: true });
  }

  if (outputDirectoryExists && !options.overwrite) {
    const entries = await readdir(outputDirectory);
    if (entries.length > 0) {
      throw new CliError(
        `Template output directory is not empty: ${outputDirectory}. Use --overwrite to replace recipe files.`,
        {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
        },
      );
    }
  }

  await writeTextFileSafe(join(outputDirectory, "template.html"), recipe.templateHtml, {
    overwrite: options.overwrite,
  });
  await writeTextFileSafe(join(outputDirectory, "style.css"), recipe.styleCss, {
    overwrite: options.overwrite,
  });

  printLine(
    runtime.stdout,
    `Wrote Markdown PDF template: ${displayPath(runtime, outputDirectory)}`,
  );
}

export interface MdFrontmatterToJsonOptions {
  input: string;
  output?: string;
  overwrite?: boolean;
  pretty?: boolean;
  dataOnly?: boolean;
  toStdout?: boolean;
}

function stringifyJsonOutput(value: unknown, pretty = false): string {
  const spacing = pretty ? 2 : 0;
  return `${JSON.stringify(value, null, spacing)}\n`;
}

export async function actionMdFrontmatterToJson(
  runtime: CliRuntime,
  options: MdFrontmatterToJsonOptions,
): Promise<void> {
  const inputPath = resolveFromCwd(runtime, assertNonEmpty(options.input, "Input path"));
  await ensureFileExists(inputPath, "Input");

  const raw = await readTextFileRequired(inputPath);
  const parsed = parseMarkdown(raw);

  if (parsed.frontmatterType === null || parsed.frontmatter === null) {
    throw new CliError(`No frontmatter found in Markdown file: ${inputPath}`, {
      code: "FRONTMATTER_NOT_FOUND",
      exitCode: 2,
    });
  }

  if (parsed.data === null || typeof parsed.data !== "object" || Array.isArray(parsed.data)) {
    throw new CliError(`Failed to parse frontmatter as an object in: ${inputPath}`, {
      code: "INVALID_FRONTMATTER",
      exitCode: 2,
    });
  }

  const payload = options.dataOnly
    ? parsed.data
    : {
        frontmatterType: parsed.frontmatterType,
        data: parsed.data,
      };
  const json = stringifyJsonOutput(payload, options.pretty);

  const outputInput = options.output?.trim();
  const writeToStdout = options.toStdout ?? !outputInput;
  if (writeToStdout) {
    runtime.stdout.write(json);
    return;
  }

  const outputPath = resolveFromCwd(
    runtime,
    outputInput || defaultOutputPath(inputPath, ".frontmatter.json"),
  );
  await writeTextFileSafe(outputPath, json, { overwrite: options.overwrite });
  printLine(runtime.stdout, `Wrote JSON: ${displayPath(runtime, outputPath)}`);
}
