import { basename, relative, win32 } from "node:path";

import type { CliRuntime } from "../types";

export interface MarkdownPdfCodexPublicPathDisplay {
  display: string;
  basename: string;
  redacted: boolean;
}

function isWindowsAbsolutePath(path: string): boolean {
  return /^[a-z]:[\\/]/iu.test(path) || path.startsWith("\\\\") || /^\\[^\\]/u.test(path);
}

function relativePathFromCwd(runtime: CliRuntime, path: string): string | undefined {
  const cwdIsWindowsAbsolute = isWindowsAbsolutePath(runtime.cwd);
  const pathIsWindowsAbsolute = isWindowsAbsolutePath(path);
  if (cwdIsWindowsAbsolute || pathIsWindowsAbsolute) {
    if (!cwdIsWindowsAbsolute || !pathIsWindowsAbsolute) {
      return undefined;
    }
    const cwdRelative = win32.relative(runtime.cwd, path);
    if (
      cwdRelative.startsWith("..") ||
      cwdRelative.startsWith("\\") ||
      isWindowsAbsolutePath(cwdRelative)
    ) {
      return undefined;
    }
    return cwdRelative.length > 0 ? cwdRelative : ".";
  }
  const cwdRelative = relative(runtime.cwd, path);
  if (
    cwdRelative.startsWith("..") ||
    cwdRelative.startsWith("/") ||
    cwdRelative.startsWith("\\") ||
    isWindowsAbsolutePath(cwdRelative)
  ) {
    return undefined;
  }
  return cwdRelative.length > 0 ? cwdRelative : ".";
}

export function publicPathFromCwd(input: {
  path: string | undefined;
  placeholder: string;
  runtime: CliRuntime;
}): string {
  return input.path
    ? (relativePathFromCwd(input.runtime, input.path) ?? input.placeholder)
    : input.placeholder;
}

export function publicPathBasename(path: string): string {
  return path.includes("\\") || isWindowsAbsolutePath(path) ? win32.basename(path) : basename(path);
}

export function publicPathDisplay(
  runtime: CliRuntime,
  path: string | undefined,
): MarkdownPdfCodexPublicPathDisplay | undefined {
  if (!path) {
    return undefined;
  }
  const display = relativePathFromCwd(runtime, path);
  return {
    display: display ?? publicPathBasename(path),
    basename: publicPathBasename(path),
    redacted: !display,
  };
}

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
