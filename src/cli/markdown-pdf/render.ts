import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { CliError } from "../errors";
import { ensureParentDir, readTextFileRequired, writeTextFileSafe } from "../file-io";
import { execCommand, type ExecCommandResult } from "../process";
import type { NormalizedMarkdownPdfOptions } from "./validation";

export type MarkdownPdfProcessRunner = typeof execCommand;

export interface RenderMarkdownPdfInput {
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
  runner?: MarkdownPdfProcessRunner;
}

export interface RenderMarkdownPdfResult {
  pandoc: ExecCommandResult;
  weasyprint: ExecCommandResult;
  warnings: string[];
}

const URL_SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):/i;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[a-z]:[\\/]/i;
const HTML_TAG_PATTERN = /<\s*([a-z][\w:-]*)\b[^>]*>/gi;
const HTML_ASSET_TAGS = new Set([
  "img",
  "image",
  "source",
  "video",
  "audio",
  "iframe",
  "embed",
  "object",
  "script",
  "link",
]);
const HTML_ASSET_ATTR_PATTERN =
  /\b(src|href|poster|data|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const HTML_STYLE_TAG_PATTERN = /<\s*style\b[^>]*>([\s\S]*?)<\s*\/\s*style\s*>/gi;
const HTML_STYLE_ATTR_PATTERN = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const CSS_URL_PATTERNS = [
  /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]+))\s*\)/gi,
  /@import\s+(?:url\(\s*)?(?:"([^"]*)"|'([^']*)'|([^)"'\s;]+))/gi,
] as const;

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

function collectRemoteValuesFromPattern(value: string, pattern: RegExp): string[] {
  const remotes: string[] = [];
  for (const match of value.matchAll(pattern)) {
    const candidate = (match[2] ?? match[3] ?? match[4] ?? match[1] ?? "").trim();
    if (shouldBlockAssetUrl(candidate)) {
      remotes.push(candidate);
    }
  }
  return remotes;
}

function shouldBlockAssetUrl(candidate: string): boolean {
  if (candidate.startsWith("//")) {
    return true;
  }
  if (WINDOWS_ABSOLUTE_PATH_PATTERN.test(candidate)) {
    return false;
  }

  const scheme = candidate.match(URL_SCHEME_PATTERN)?.[1]?.toLowerCase();
  return scheme !== undefined && scheme !== "file" && scheme !== "data";
}

function collectRemoteHtmlAssets(html: string): string[] {
  const remotes: string[] = [];
  for (const tagMatch of html.matchAll(HTML_TAG_PATTERN)) {
    const tag = tagMatch[0] ?? "";
    const tagName = (tagMatch[1] ?? "").toLowerCase();
    if (HTML_ASSET_TAGS.has(tagName)) {
      remotes.push(...collectRemoteValuesFromPattern(tag, HTML_ASSET_ATTR_PATTERN));
    }
    for (const styleMatch of tag.matchAll(HTML_STYLE_ATTR_PATTERN)) {
      const style = styleMatch[1] ?? styleMatch[2] ?? styleMatch[3] ?? "";
      remotes.push(...collectRemoteCssAssets(style));
    }
  }

  for (const tagMatch of html.matchAll(HTML_STYLE_TAG_PATTERN)) {
    remotes.push(...collectRemoteCssAssets(tagMatch[1] ?? ""));
  }

  return remotes;
}

function collectRemoteCssAssets(css: string): string[] {
  return CSS_URL_PATTERNS.flatMap((pattern) => collectRemoteValuesFromPattern(css, pattern));
}

async function rejectRemoteAssetsWhenDisabled(
  html: string,
  cssPaths: string[],
  allowRemoteAssets: boolean,
): Promise<void> {
  if (allowRemoteAssets) {
    return;
  }

  const remotes = new Set<string>(collectRemoteHtmlAssets(html));
  for (const cssPath of cssPaths) {
    const css = await readTextFileRequired(cssPath);
    for (const remote of collectRemoteCssAssets(css)) {
      remotes.add(remote);
    }
  }

  if (remotes.size > 0) {
    throw new CliError(
      `Remote assets are disabled by default. Use --allow-remote-assets to allow: ${Array.from(remotes).join(", ")}`,
      {
        code: "REMOTE_ASSET_BLOCKED",
        exitCode: 2,
      },
    );
  }
}

async function createTempFile(dir: string, name: string, content: string): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, content, "utf8");
  return path;
}

export async function renderMarkdownPdf(
  input: RenderMarkdownPdfInput,
): Promise<RenderMarkdownPdfResult> {
  const runner = input.runner ?? execCommand;
  const tempDir = await mkdtemp(join(tmpdir(), "cdx-chores-md-pdf-"));
  try {
    const templatePath =
      input.customTemplatePath ??
      (await createTempFile(tempDir, "template.html", input.templateHtml));
    const defaultCssPath =
      input.noDefaultCss || !input.defaultCss
        ? undefined
        : await createTempFile(tempDir, "style.css", input.defaultCss);
    const htmlPath = join(tempDir, `${basename(input.inputPath)}.render.html`);
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
      htmlPath,
    ];
    if (input.options.toc) {
      pandocArgs.push("--toc", "--toc-depth", String(input.options.tocDepth));
    }

    const pandoc = await runner("pandoc", pandocArgs, { cwd: dirname(input.inputPath) });
    if (!pandoc.ok) {
      throw formatProcessFailure("pandoc", pandoc);
    }

    const html = await readTextFileRequired(htmlPath);
    await rejectRemoteAssetsWhenDisabled(html, cssPaths, input.options.allowRemoteAssets);

    if (input.htmlOutputPath) {
      await writeTextFileSafe(input.htmlOutputPath, html, { overwrite: input.overwrite });
    }

    await ensureParentDir(input.outputPath);
    const weasyprintArgs = ["--base-url", dirname(input.inputPath)];
    for (const cssPath of cssPaths) {
      weasyprintArgs.push("--stylesheet", cssPath);
    }
    weasyprintArgs.push(htmlPath, input.outputPath);

    const weasyprint = await runner("weasyprint", weasyprintArgs, {
      cwd: dirname(input.inputPath),
    });
    if (!weasyprint.ok) {
      throw formatProcessFailure("weasyprint", weasyprint);
    }

    return {
      pandoc,
      weasyprint,
      warnings: [...splitLines(pandoc.stderr), ...splitLines(weasyprint.stderr)],
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
