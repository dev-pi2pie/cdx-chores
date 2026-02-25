import { readdir } from "node:fs/promises";
import { extname, resolve } from "node:path";

export type PathSuggestionKind = "file" | "directory";
export type PathSuggestionTargetKind = "any" | PathSuggestionKind;

export interface PathSuggestion {
  kind: PathSuggestionKind;
  label: string;
  name: string;
  replacement: string;
  absolutePath: string;
}

export interface ResolvePathSuggestionsOptions {
  cwd: string;
  input: string;
  maxSuggestions?: number;
  minChars?: number;
  includeHidden?: boolean;
  targetKind?: PathSuggestionTargetKind;
  fileExtensions?: string[];
  enforceTrigger?: boolean;
}

interface SuggestionDirEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

interface ParsedPathSuggestionInput {
  rawInput: string;
  directoryInput: string;
  fragment: string;
  baseDirectoryPath: string;
}

function findLastSeparatorIndex(value: string): number {
  return Math.max(value.lastIndexOf("/"), value.lastIndexOf("\\"));
}

function parsePathSuggestionInput(cwd: string, input: string): ParsedPathSuggestionInput {
  const lastSeparatorIndex = findLastSeparatorIndex(input);
  const directoryInput = lastSeparatorIndex >= 0 ? input.slice(0, lastSeparatorIndex + 1) : "";
  const fragment = lastSeparatorIndex >= 0 ? input.slice(lastSeparatorIndex + 1) : input;
  const baseDirectoryPath = resolve(cwd, directoryInput || ".");
  return {
    rawInput: input,
    directoryInput,
    fragment,
    baseDirectoryPath,
  };
}

function normalizeExtensions(extensions: string[] | undefined): Set<string> | undefined {
  if (!extensions || extensions.length === 0) {
    return undefined;
  }

  return new Set(
    extensions
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0)
      .map((value) => (value.startsWith(".") ? value : `.${value}`)),
  );
}

function compareSuggestionEntries(a: SuggestionDirEntry, b: SuggestionDirEntry): number {
  if (a.isDirectory !== b.isDirectory) {
    return a.isDirectory ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

async function readSuggestionEntries(directoryPath: string): Promise<SuggestionDirEntry[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const normalized: SuggestionDirEntry[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      normalized.push({ name: entry.name, isDirectory: true, isFile: false });
      continue;
    }

    if (entry.isFile()) {
      normalized.push({ name: entry.name, isDirectory: false, isFile: true });
    }
  }

  return normalized;
}

export function shouldSuggestForPathInput(
  input: string,
  options: { minChars?: number } = {},
): boolean {
  const minChars = options.minChars ?? 1;

  if (input.length >= minChars) {
    return true;
  }

  return input === "./" || input === "../" || input === "/";
}

export async function resolvePathSuggestions(
  options: ResolvePathSuggestionsOptions,
): Promise<PathSuggestion[]> {
  const maxSuggestions = Math.max(0, options.maxSuggestions ?? 12);
  if (maxSuggestions === 0) {
    return [];
  }

  const minChars = Math.max(0, options.minChars ?? 1);
  const enforceTrigger = options.enforceTrigger ?? true;
  if (enforceTrigger && !shouldSuggestForPathInput(options.input, { minChars })) {
    return [];
  }

  const parsed = parsePathSuggestionInput(options.cwd, options.input);
  const extensionFilter = normalizeExtensions(options.fileExtensions);
  const targetKind = options.targetKind ?? "any";
  const includeHidden = options.includeHidden ?? false;

  let entries: SuggestionDirEntry[];
  try {
    entries = await readSuggestionEntries(parsed.baseDirectoryPath);
  } catch {
    return [];
  }

  const filtered = entries
    .filter((entry) => (includeHidden ? true : !entry.name.startsWith(".")))
    .filter((entry) => entry.name.startsWith(parsed.fragment))
    .filter((entry) => {
      if (targetKind === "directory") {
        return entry.isDirectory;
      }
      if (targetKind === "file") {
        return entry.isFile;
      }
      return true;
    })
    .filter((entry) => {
      if (!extensionFilter || !entry.isFile) {
        return true;
      }

      return extensionFilter.has(extname(entry.name).toLowerCase());
    })
    .sort(compareSuggestionEntries)
    .slice(0, maxSuggestions);

  return filtered.map((entry) => {
    const suffix = entry.isDirectory ? "/" : "";
    const label = `${entry.name}${suffix}`;
    const replacement = `${parsed.directoryInput}${entry.name}${suffix}`;
    const absolutePath = resolve(parsed.baseDirectoryPath, entry.name);

    return {
      kind: entry.isDirectory ? "directory" : "file",
      name: entry.name,
      label,
      replacement,
      absolutePath,
    };
  });
}

