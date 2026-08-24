import { realpath, stat } from "node:fs/promises";
import { relative } from "node:path";

export const CSS_URL_FUNCTION_PATTERN = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]+))\s*\)/gi;
export const CSS_IMPORT_PATTERN =
  /@import\s+(url\(\s*)?(?:"([^"]*)"|'([^']*)'|([^)"'\s;]+))(\s*\))?/gi;

const URL_SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):/i;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[a-z]:[\\/]/i;
const WINDOWS_ROOT_RELATIVE_PATH_PATTERN = /^\\/u;
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

export function getReferenceScheme(value: string): string | undefined {
  return value.match(URL_SCHEME_PATTERN)?.[1]?.toLowerCase();
}

export function isWindowsAbsolutePath(value: string): boolean {
  return WINDOWS_ABSOLUTE_PATH_PATTERN.test(value);
}

export function relativePathStaysInside(basePath: string, targetPath: string): boolean {
  const relativePath = relative(basePath, targetPath);
  return (
    relativePath.length === 0 ||
    (!relativePath.startsWith("..") && !WINDOWS_ABSOLUTE_PATH_PATTERN.test(relativePath))
  );
}

export function splitAssetReference(value: string): { path: string; suffix: string } {
  const suffixStart = value.search(/[?#]/u);
  if (suffixStart < 0) {
    return { path: value, suffix: "" };
  }
  return { path: value.slice(0, suffixStart), suffix: value.slice(suffixStart) };
}

export async function realFilePath(path: string): Promise<string | undefined> {
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

export function isRelativeHtmlAssetReference(value: string): boolean {
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

export function isLocalAbsoluteHtmlAssetReference(value: string): boolean {
  const trimmed = value.trim();
  const scheme = getReferenceScheme(trimmed);
  return (
    scheme === "file" ||
    (trimmed.startsWith("/") && !trimmed.startsWith("//")) ||
    WINDOWS_ROOT_RELATIVE_PATH_PATTERN.test(trimmed) ||
    WINDOWS_ABSOLUTE_PATH_PATTERN.test(trimmed)
  );
}

export function isHtmlAssetTag(tagName: string): boolean {
  return HTML_ASSET_TAGS.has(tagName);
}

export function splitSrcsetCandidates(value: string): string[] {
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
