import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CliError } from "../../errors";
import { readTextFileRequired } from "../../file-io";
import {
  CSS_IMPORT_PATTERN,
  CSS_URL_FUNCTION_PATTERN,
  getReferenceScheme,
  isHtmlAssetTag,
  isWindowsAbsolutePath,
  realFilePath,
  relativePathStaysInside,
  splitAssetReference,
  splitSrcsetCandidates,
} from "./reference";

const HTML_TAG_PATTERN = /<\s*([a-z][\w:-]*)\b[^>]*>/gi;
const HTML_ASSET_ATTR_PATTERN =
  /\b(src|href|poster|data|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const HTML_SRCSET_ATTR_PATTERN = /\bsrcset\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const HTML_STYLE_TAG_PATTERN = /<\s*style\b[^>]*>([\s\S]*?)<\s*\/\s*style\s*>/gi;
const HTML_STYLE_ATTR_PATTERN = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const CSS_URL_PATTERNS = [CSS_URL_FUNCTION_PATTERN, CSS_IMPORT_PATTERN] as const;

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

function collectRemoteSrcsetAssets(value: string): string[] {
  return splitSrcsetCandidates(value)
    .map((candidate) => candidate.split(/\s+/u)[0]?.trim() ?? "")
    .filter((candidate) => candidate.length > 0 && shouldBlockAssetUrl(candidate));
}

function shouldBlockAssetUrl(candidate: string): boolean {
  if (candidate.startsWith("//")) {
    return true;
  }
  if (isWindowsAbsolutePath(candidate)) {
    return false;
  }

  const scheme = getReferenceScheme(candidate);
  return scheme !== undefined && scheme !== "file" && scheme !== "data";
}

function collectRemoteHtmlAssets(html: string): string[] {
  const remotes: string[] = [];
  for (const tagMatch of html.matchAll(HTML_TAG_PATTERN)) {
    const tag = tagMatch[0] ?? "";
    const tagName = (tagMatch[1] ?? "").toLowerCase();
    if (isHtmlAssetTag(tagName)) {
      remotes.push(...collectRemoteValuesFromPattern(tag, HTML_ASSET_ATTR_PATTERN));
      for (const srcsetMatch of tag.matchAll(HTML_SRCSET_ATTR_PATTERN)) {
        const srcsetValue = srcsetMatch[1] ?? srcsetMatch[2] ?? srcsetMatch[3] ?? "";
        remotes.push(...collectRemoteSrcsetAssets(srcsetValue));
      }
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

function cssImportReferenceFromMatch(match: RegExpMatchArray): string {
  return (match[2] ?? match[3] ?? match[4] ?? "").trim();
}

function resolveLocalCssImportReference(
  reference: string,
  baseDirectory: string,
): string | undefined {
  if (!reference || shouldBlockAssetUrl(reference)) {
    return undefined;
  }
  const scheme = getReferenceScheme(reference);
  if (scheme === "data") {
    return undefined;
  }
  if (scheme === "file") {
    return fileURLToPath(reference);
  }
  if (scheme) {
    return undefined;
  }
  return resolve(baseDirectory, splitAssetReference(reference).path);
}

async function collectRemoteCssAssetsDeep(input: {
  baseDirectory: string;
  css: string;
  rootDirectories: string[];
  visitedCssPaths: Set<string>;
}): Promise<string[]> {
  const remotes = new Set<string>(collectRemoteCssAssets(input.css));
  for (const match of input.css.matchAll(CSS_IMPORT_PATTERN)) {
    const importPath = resolveLocalCssImportReference(
      cssImportReferenceFromMatch(match),
      input.baseDirectory,
    );
    if (!importPath || input.visitedCssPaths.has(importPath)) {
      continue;
    }
    const resolvedImportPath = resolve(importPath);
    const rootDirectory = findContainingRootDirectory(resolvedImportPath, input.rootDirectories);
    if (!rootDirectory) {
      throw new CliError(`CSS import path must stay inside its source directory: ${importPath}`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    const realImportPath = await realFilePath(resolvedImportPath);
    if (!realImportPath) {
      throw new CliError(`CSS import path does not exist: ${importPath}`, {
        code: "FILE_NOT_FOUND",
        exitCode: 1,
      });
    }
    const realRootDirectory = findContainingRootDirectory(realImportPath, input.rootDirectories);
    if (!realRootDirectory) {
      throw new CliError(`CSS import path must stay inside its source directory: ${importPath}`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    input.visitedCssPaths.add(resolvedImportPath);
    const importedCss = await readTextFileRequired(resolvedImportPath);
    for (const remote of await collectRemoteCssAssetsDeep({
      baseDirectory: dirname(resolvedImportPath),
      css: importedCss,
      rootDirectories: [realRootDirectory],
      visitedCssPaths: input.visitedCssPaths,
    })) {
      remotes.add(remote);
    }
  }
  return Array.from(remotes);
}

function collectInlineCssBlocksFromHtml(html: string): string[] {
  const blocks: string[] = [];
  for (const tagMatch of html.matchAll(HTML_TAG_PATTERN)) {
    const tag = tagMatch[0] ?? "";
    for (const styleMatch of tag.matchAll(HTML_STYLE_ATTR_PATTERN)) {
      blocks.push(styleMatch[1] ?? styleMatch[2] ?? styleMatch[3] ?? "");
    }
  }
  for (const tagMatch of html.matchAll(HTML_STYLE_TAG_PATTERN)) {
    blocks.push(tagMatch[1] ?? "");
  }
  return blocks;
}

function findContainingRootDirectory(path: string, rootDirectories: string[]): string | undefined {
  const resolvedPath = resolve(path);
  return rootDirectories
    .map((rootDirectory) => resolve(rootDirectory))
    .find((rootDirectory) => relativePathStaysInside(rootDirectory, resolvedPath));
}

export async function rejectRemoteMarkdownPdfAssetsWhenDisabled(input: {
  html: string;
  cssPaths: string[];
  htmlBaseDirectory: string;
  allowRemoteAssets: boolean;
  htmlCssAdditionalRootDirectories?: string[];
}): Promise<void> {
  if (input.allowRemoteAssets) {
    return;
  }

  const remotes = new Set<string>(collectRemoteHtmlAssets(input.html));
  const visitedCssPaths = new Set<string>();
  const htmlCssRootDirectories = [
    input.htmlBaseDirectory,
    ...(input.htmlCssAdditionalRootDirectories ?? []),
  ];
  for (const css of collectInlineCssBlocksFromHtml(input.html)) {
    for (const remote of await collectRemoteCssAssetsDeep({
      baseDirectory: input.htmlBaseDirectory,
      css,
      rootDirectories: htmlCssRootDirectories,
      visitedCssPaths,
    })) {
      remotes.add(remote);
    }
  }
  for (const cssPath of input.cssPaths) {
    const css = await readTextFileRequired(cssPath);
    const resolvedCssPath = resolve(cssPath);
    visitedCssPaths.add(resolvedCssPath);
    for (const remote of await collectRemoteCssAssetsDeep({
      baseDirectory: dirname(resolvedCssPath),
      css,
      rootDirectories: [dirname(resolvedCssPath)],
      visitedCssPaths,
    })) {
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
