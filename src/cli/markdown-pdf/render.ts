import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, parse as parsePath } from "node:path";

import { CliError } from "../errors";
import { readTextFileRequired, writeBufferFileSafe, writeTextFileSafe } from "../file-io";
import { execCommand, type ExecCommandResult } from "../process";
import { highlightMarkdownPdfCodeBlocks } from "./code-highlight";
import { finalizeMarkdownPdfPageNumberHtml } from "./page-number-html";
import type { EffectiveMarkdownPdfCodeOptions, NormalizedMarkdownPdfPageNumbers } from "./profile";
import {
  rejectRemoteMarkdownPdfAssetsWhenDisabled,
  rewriteMarkdownPdfTemplateLocalAssets,
} from "./template-assets";
import type { MarkdownPdfTemplateCompatibilityResult } from "./template-compatibility";
import type { NormalizedMarkdownPdfOptions } from "./validation";

export type MarkdownPdfProcessRunner = typeof execCommand;
export type MarkdownPdfCodeHighlighter = typeof highlightMarkdownPdfCodeBlocks;

export interface RenderMarkdownPdfInput {
  bodyBoundary: MarkdownPdfTemplateCompatibilityResult["bodyBoundary"];
  inputPath: string;
  outputPath: string;
  templateHtml: string;
  defaultCss?: string;
  customTemplatePath?: string;
  customCssPath?: string;
  noDefaultCss?: boolean;
  htmlOutputPath?: string;
  overwrite?: boolean;
  options: NormalizedMarkdownPdfOptions;
  pageNumbers: NormalizedMarkdownPdfPageNumbers;
  code?: EffectiveMarkdownPdfCodeOptions;
  runner?: MarkdownPdfProcessRunner;
  codeHighlighter?: MarkdownPdfCodeHighlighter;
}

export interface RenderMarkdownPdfResult {
  pandoc: ExecCommandResult;
  weasyprint: ExecCommandResult;
  warnings: string[];
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function formatProcessFailure(command: string, result: ExecCommandResult): CliError {
  return new CliError(
    `${command} failed (${result.code ?? "unknown"}): ${result.stderr || result.stdout}`.trim(),
    {
      code: "PROCESS_FAILED",
      exitCode: 1,
    },
  );
}

async function createTempFile(dir: string, name: string, content: string): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, content, "utf8");
  return path;
}

async function createFinalHtml(
  input: RenderMarkdownPdfInput,
  pandocHtmlPath: string,
): Promise<string> {
  const pandocHtml = await readTextFileRequired(pandocHtmlPath);
  const highlightedHtml = input.code?.highlight
    ? await (input.codeHighlighter ?? highlightMarkdownPdfCodeBlocks)(pandocHtml, input.code)
    : pandocHtml;
  return finalizeMarkdownPdfPageNumberHtml({
    bodyBoundary: input.bodyBoundary,
    html: highlightedHtml,
    pageNumbers: input.pageNumbers,
  });
}

async function createCustomTemplateRenderFile(input: {
  sourcePath: string;
  tempDir: string;
}): Promise<string> {
  const templateHtml = await readTextFileRequired(input.sourcePath);
  return await createTempFile(
    input.tempDir,
    "template.html",
    await rewriteMarkdownPdfTemplateLocalAssets(templateHtml, dirname(input.sourcePath)),
  );
}

export async function renderMarkdownPdf(
  input: RenderMarkdownPdfInput,
): Promise<RenderMarkdownPdfResult> {
  const runner = input.runner ?? execCommand;
  const tempDir = await mkdtemp(join(tmpdir(), "cdx-chores-md-pdf-"));
  try {
    const templatePath = input.customTemplatePath
      ? await createCustomTemplateRenderFile({
          sourcePath: input.customTemplatePath,
          tempDir,
        })
      : await createTempFile(tempDir, "template.html", input.templateHtml);
    const defaultCssPath =
      input.noDefaultCss || !input.defaultCss
        ? undefined
        : await createTempFile(tempDir, "style.css", input.defaultCss);
    const pandocHtmlPath = join(tempDir, `${basename(input.inputPath)}.pandoc.html`);
    const finalHtmlPath = join(tempDir, `${basename(input.inputPath)}.render.html`);
    const cssPaths = [defaultCssPath, input.customCssPath].filter(
      (path): path is string => typeof path === "string" && path.length > 0,
    );

    const pandocArgs = [
      input.inputPath,
      "--standalone",
      "--from",
      "markdown",
      "--to",
      "html",
      "--template",
      templatePath,
      "--output",
      pandocHtmlPath,
    ];
    if (input.options.toc) {
      pandocArgs.push("--toc", "--toc-depth", String(input.options.tocDepth));
    }

    const pandoc = await runner("pandoc", pandocArgs, { cwd: dirname(input.inputPath) });
    if (!pandoc.ok) {
      throw formatProcessFailure("pandoc", pandoc);
    }

    const html = await createFinalHtml(input, pandocHtmlPath);
    await writeFile(finalHtmlPath, html, "utf8");

    await rejectRemoteMarkdownPdfAssetsWhenDisabled({
      html,
      cssPaths,
      htmlBaseDirectory: dirname(input.inputPath),
      allowRemoteAssets: input.options.allowRemoteAssets,
      htmlCssAdditionalRootDirectories: input.customTemplatePath
        ? [dirname(input.customTemplatePath)]
        : [],
    });

    if (input.htmlOutputPath) {
      await writeTextFileSafe(input.htmlOutputPath, html, {
        label: "HTML output",
        overwrite: input.overwrite,
        parentRootDirectory: parsePath(input.htmlOutputPath).root,
      });
    }

    const renderedPdfPath = join(tempDir, "rendered.pdf");
    const weasyprintArgs = ["--base-url", dirname(input.inputPath)];
    for (const cssPath of cssPaths) {
      weasyprintArgs.push("--stylesheet", cssPath);
    }
    weasyprintArgs.push(finalHtmlPath, renderedPdfPath);

    const weasyprint = await runner("weasyprint", weasyprintArgs, {
      cwd: dirname(input.inputPath),
    });
    if (!weasyprint.ok) {
      throw formatProcessFailure("weasyprint", weasyprint);
    }
    await writeBufferFileSafe(input.outputPath, await readFile(renderedPdfPath), {
      label: "PDF output",
      overwrite: input.overwrite,
      parentRootDirectory: parsePath(input.outputPath).root,
    });

    return {
      pandoc,
      weasyprint,
      warnings: [...splitLines(pandoc.stderr), ...splitLines(weasyprint.stderr)],
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
