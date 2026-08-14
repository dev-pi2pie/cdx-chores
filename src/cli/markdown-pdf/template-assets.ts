import { realpath, stat } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parse, serialize, type DefaultTreeAdapterTypes } from "parse5";

import { CliError } from "../errors";
import { readTextFileRequired } from "../file-io";

const URL_SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):/i;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[a-z]:[\\/]/i;
const WINDOWS_ROOT_RELATIVE_PATH_PATTERN = /^\\/u;
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
  "use",
  "feimage",
]);
const HTML_TEMPLATE_LOCAL_ASSET_ATTRS = new Set(["src", "href", "poster", "data", "xlink:href"]);
const HTML_ASSET_ATTR_PATTERN =
  /\b(src|href|poster|data|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const HTML_SRCSET_ATTR_PATTERN = /\bsrcset\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const HTML_STYLE_TAG_PATTERN = /<\s*style\b[^>]*>([\s\S]*?)<\s*\/\s*style\s*>/gi;
const HTML_STYLE_ATTR_PATTERN = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const PANDOC_TEMPLATE_VARIABLE_PATTERN = /\$[^$]+\$/u;
const CSS_URL_FUNCTION_PATTERN = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]+))\s*\)/gi;
const CSS_IMPORT_PATTERN = /@import\s+(url\(\s*)?(?:"([^"]*)"|'([^']*)'|([^)"'\s;]+))(\s*\))?/gi;
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
  const scheme = reference.match(URL_SCHEME_PATTERN)?.[1]?.toLowerCase();
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

function relativePathStaysInside(basePath: string, targetPath: string): boolean {
  const relativePath = relative(basePath, targetPath);
  return (
    relativePath.length === 0 ||
    (!relativePath.startsWith("..") && !WINDOWS_ABSOLUTE_PATH_PATTERN.test(relativePath))
  );
}

function splitAssetReference(value: string): { path: string; suffix: string } {
  const suffixStart = value.search(/[?#]/u);
  if (suffixStart < 0) {
    return { path: value, suffix: "" };
  }
  return { path: value.slice(0, suffixStart), suffix: value.slice(suffixStart) };
}

function isRelativeHtmlAssetReference(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length > 0 &&
    !trimmed.startsWith("#") &&
    !trimmed.startsWith("/") &&
    !WINDOWS_ROOT_RELATIVE_PATH_PATTERN.test(trimmed) &&
    !trimmed.startsWith("//") &&
    !URL_SCHEME_PATTERN.test(trimmed) &&
    !WINDOWS_ABSOLUTE_PATH_PATTERN.test(trimmed)
  );
}

function isLocalAbsoluteHtmlAssetReference(value: string): boolean {
  const trimmed = value.trim();
  const scheme = trimmed.match(URL_SCHEME_PATTERN)?.[1]?.toLowerCase();
  return (
    scheme === "file" ||
    (trimmed.startsWith("/") && !trimmed.startsWith("//")) ||
    WINDOWS_ROOT_RELATIVE_PATH_PATTERN.test(trimmed) ||
    WINDOWS_ABSOLUTE_PATH_PATTERN.test(trimmed)
  );
}

async function realFilePath(path: string): Promise<string | undefined> {
  try {
    const stats = await stat(path);
    if (!stats.isFile()) {
      return undefined;
    }
    return await realpath(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function resolveTemplateLocalHtmlAssetReference(
  value: string,
  templateDirectory: string,
): Promise<string> {
  if (PANDOC_TEMPLATE_VARIABLE_PATTERN.test(value)) {
    throw new CliError(`Template asset path must not contain Pandoc template variables: ${value}`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  const scheme = value.trim().match(URL_SCHEME_PATTERN)?.[1]?.toLowerCase();
  if (scheme === "file") {
    const { path } = splitAssetReference(value);
    const resolvedPath = fileURLToPath(path);
    const resolvedTemplateDirectory = resolve(templateDirectory);
    if (!relativePathStaysInside(resolvedTemplateDirectory, resolvedPath)) {
      throw new CliError(
        `Template asset path must stay inside the custom template directory: ${value}`,
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }
    const realResolvedPath = await realFilePath(resolvedPath);
    if (!realResolvedPath) {
      throw new CliError(`Template asset path does not exist: ${value}`, {
        code: "FILE_NOT_FOUND",
        exitCode: 1,
      });
    }
    if (!relativePathStaysInside(resolvedTemplateDirectory, realResolvedPath)) {
      throw new CliError(
        `Template asset path must stay inside the custom template directory: ${value}`,
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }
    return value;
  }
  if (!isRelativeHtmlAssetReference(value)) {
    if (isLocalAbsoluteHtmlAssetReference(value)) {
      throw new CliError(`Template asset path must be relative to the custom template: ${value}`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    return value;
  }
  const { path, suffix } = splitAssetReference(value);
  const resolvedPath = resolve(templateDirectory, path);
  const resolvedTemplateDirectory = resolve(templateDirectory);
  if (!relativePathStaysInside(resolvedTemplateDirectory, resolvedPath)) {
    throw new CliError(
      `Template asset path must stay inside the custom template directory: ${value}`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
  const realResolvedPath = await realFilePath(resolvedPath);
  if (!realResolvedPath) {
    throw new CliError(`Template asset path does not exist: ${value}`, {
      code: "FILE_NOT_FOUND",
      exitCode: 2,
    });
  }
  const realTemplateDirectory = await realpath(resolvedTemplateDirectory);
  if (!relativePathStaysInside(realTemplateDirectory, realResolvedPath)) {
    throw new CliError(
      `Template asset path must stay inside the custom template directory: ${value}`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
  return `${pathToFileURL(realResolvedPath).href}${suffix}`;
}

async function replaceAsync(
  value: string,
  pattern: RegExp,
  replacer: (match: RegExpMatchArray) => Promise<string>,
): Promise<string> {
  let rewritten = "";
  let lastIndex = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    rewritten += value.slice(lastIndex, index);
    rewritten += await replacer(match);
    lastIndex = index + match[0].length;
  }
  rewritten += value.slice(lastIndex);
  return rewritten;
}

async function rewriteTemplateLocalCssAssets(
  css: string,
  templateDirectory: string,
): Promise<string> {
  const withUrlFunctions = await replaceAsync(css, CSS_URL_FUNCTION_PATTERN, async (match) => {
    const assetReference = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    const rewritten = await resolveTemplateLocalHtmlAssetReference(
      assetReference,
      templateDirectory,
    );
    return `url("${rewritten}")`;
  });
  return await replaceAsync(withUrlFunctions, CSS_IMPORT_PATTERN, async (match) => {
    const assetReference = (match[2] ?? match[3] ?? match[4] ?? "").trim();
    const rewritten = await resolveTemplateLocalHtmlAssetReference(
      assetReference,
      templateDirectory,
    );
    return match[1] ? `@import url("${rewritten}")` : `@import "${rewritten}"`;
  });
}

async function rewriteTemplateLocalSrcset(
  value: string,
  templateDirectory: string,
): Promise<string> {
  const candidates = splitSrcsetCandidates(value);
  const rewrittenCandidates = await Promise.all(
    candidates.map(async (candidate) => {
      const trimmed = candidate.trim();
      if (!trimmed) {
        return candidate;
      }
      const descriptorStart = trimmed.search(/\s/u);
      const assetReference = descriptorStart < 0 ? trimmed : trimmed.slice(0, descriptorStart);
      const descriptor = descriptorStart < 0 ? "" : trimmed.slice(descriptorStart).trim();
      const rewritten = await resolveTemplateLocalHtmlAssetReference(
        assetReference,
        templateDirectory,
      );
      return descriptor ? `${rewritten} ${descriptor}` : rewritten;
    }),
  );
  return rewrittenCandidates.join(", ");
}

function splitSrcsetCandidates(value: string): string[] {
  const candidates: string[] = [];
  let index = 0;
  while (index < value.length) {
    while (index < value.length && /\s/u.test(value[index] ?? "")) {
      index += 1;
    }
    const start = index;
    while (index < value.length) {
      const char = value[index] ?? "";
      if (/\s/u.test(char)) {
        break;
      }
      if (char === "," && isSrcsetSeparatorComma(value, start, index)) {
        break;
      }
      index += 1;
    }
    while (index < value.length && value[index] !== ",") {
      index += 1;
    }
    const candidate = value.slice(start, index).trim();
    if (candidate) {
      candidates.push(candidate);
    }
    if (value[index] === ",") {
      index += 1;
    }
  }
  return candidates;
}

function isSrcsetSeparatorComma(
  value: string,
  candidateStart: number,
  commaIndex: number,
): boolean {
  let nextIndex = commaIndex + 1;
  while (nextIndex < value.length && /\s/u.test(value[nextIndex] ?? "")) {
    nextIndex += 1;
  }
  return (
    nextIndex >= value.length ||
    nextIndex > commaIndex + 1 ||
    srcsetCandidatePrefixLooksComplete(value.slice(candidateStart, commaIndex))
  );
}

function srcsetCandidatePrefixLooksComplete(value: string): boolean {
  return /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#][^\s,]*)?$/iu.test(value.trim());
}

export async function rewriteMarkdownPdfTemplateLocalAssets(
  html: string,
  templateDirectory: string,
): Promise<string> {
  const document = parse(html);
  const visit = async (
    node: DefaultTreeAdapterTypes.Node,
    parentTagName?: string,
  ): Promise<void> => {
    if (parentTagName === "style" && "value" in node && typeof node.value === "string") {
      node.value = await rewriteTemplateLocalCssAssets(node.value, templateDirectory);
    }
    const tagName =
      "tagName" in node && typeof node.tagName === "string" ? node.tagName.toLowerCase() : "";
    if ("attrs" in node && Array.isArray(node.attrs)) {
      for (const attr of node.attrs) {
        const attrName = attr.name.toLowerCase();
        if (attrName === "style") {
          attr.value = await rewriteTemplateLocalCssAssets(attr.value, templateDirectory);
          continue;
        }
        if (!HTML_ASSET_TAGS.has(tagName)) {
          continue;
        }
        if (attrName === "srcset") {
          attr.value = await rewriteTemplateLocalSrcset(attr.value, templateDirectory);
          continue;
        }
        if (!HTML_TEMPLATE_LOCAL_ASSET_ATTRS.has(attrName)) {
          continue;
        }
        attr.value = await resolveTemplateLocalHtmlAssetReference(attr.value, templateDirectory);
      }
    }
    if ("childNodes" in node && Array.isArray(node.childNodes)) {
      for (const child of node.childNodes) {
        await visit(child, tagName);
      }
    }
  };
  await visit(document);
  return serialize(document);
}
