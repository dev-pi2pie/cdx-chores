import { extname } from "node:path";

import { CliError } from "../../errors";

export interface RenameBatchFilterOptions {
  profile?: string;
  recursive?: boolean;
  maxDepth?: number;
  matchRegex?: string;
  skipRegex?: string;
  ext?: string[];
  skipExt?: string[];
}

const DEFAULT_RENAME_BATCH_EXCLUDED_BASENAMES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

const RENAME_BATCH_PROFILE_EXTENSIONS = {
  images: [
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".bmp",
    ".tif",
    ".tiff",
    ".avif",
    ".heic",
    ".heif",
    ".svg",
  ],
  media: [
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".bmp",
    ".tif",
    ".tiff",
    ".avif",
    ".heic",
    ".heif",
    ".svg",
    ".mp4",
    ".mov",
    ".m4v",
    ".mkv",
    ".avi",
    ".webm",
    ".mp3",
    ".wav",
    ".m4a",
    ".aac",
    ".flac",
    ".ogg",
    ".opus",
  ],
  docs: [
    ".txt",
    ".md",
    ".markdown",
    ".pdf",
    ".doc",
    ".docx",
    ".rtf",
    ".odt",
    ".csv",
    ".tsv",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".xml",
    ".html",
    ".htm",
  ],
} as const;

type RenameBatchProfileName = keyof typeof RENAME_BATCH_PROFILE_EXTENSIONS;

function isDefaultRenameBatchExcludedEntryName(entryName: string): boolean {
  if (entryName.startsWith(".")) {
    return true;
  }

  if (entryName.startsWith("._")) {
    return true;
  }

  return DEFAULT_RENAME_BATCH_EXCLUDED_BASENAMES.has(entryName);
}

function compileOptionalRegex(
  value: string | undefined,
  label: "--match-regex" | "--skip-regex",
): RegExp | undefined {
  const pattern = value?.trim();
  if (!pattern) {
    return undefined;
  }

  try {
    return new RegExp(pattern);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Invalid ${label}: ${message}`, { code: "INVALID_INPUT", exitCode: 2 });
  }
}

function normalizeExtensions(values: string[] | undefined): Set<string> | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  const normalized = values
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0)
    .map((value) => (value.startsWith(".") ? value : `.${value}`));

  if (normalized.length === 0) {
    return undefined;
  }

  return new Set(normalized);
}

function normalizeRenameBatchProfile(profile: string | undefined): Set<string> | undefined {
  const raw = profile?.trim().toLowerCase();
  if (!raw || raw === "all") {
    return undefined;
  }

  const values = RENAME_BATCH_PROFILE_EXTENSIONS[raw as RenameBatchProfileName];
  if (!values) {
    throw new CliError(
      `Invalid --profile value: ${profile}. Expected one of: all, images, media, docs`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  return new Set(values);
}

export function normalizeRenameBatchMaxDepth(
  options: Pick<RenameBatchFilterOptions, "maxDepth" | "recursive">,
): number | undefined {
  const value = options.maxDepth;
  if (value === undefined) {
    return undefined;
  }

  if (!(options.recursive ?? false)) {
    throw new CliError("--max-depth requires --recursive.", { code: "INVALID_INPUT", exitCode: 2 });
  }

  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new CliError("--max-depth must be a non-negative integer.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  return value;
}

export function createRenameBatchFileFilter(
  options: Pick<
    RenameBatchFilterOptions,
    "profile" | "matchRegex" | "skipRegex" | "ext" | "skipExt"
  >,
): (entryName: string) => boolean {
  const matchRegex = compileOptionalRegex(options.matchRegex, "--match-regex");
  const skipRegex = compileOptionalRegex(options.skipRegex, "--skip-regex");
  const profileExts = normalizeRenameBatchProfile(options.profile);
  const includeExts = normalizeExtensions(options.ext);
  const excludeExts = normalizeExtensions(options.skipExt);
  const effectiveIncludeExts =
    profileExts || includeExts
      ? new Set<string>([...(profileExts ?? []), ...(includeExts ?? [])])
      : undefined;

  return (entryName: string) => {
    if (isDefaultRenameBatchExcludedEntryName(entryName)) {
      return false;
    }

    if (matchRegex && !matchRegex.test(entryName)) {
      return false;
    }

    if (skipRegex && skipRegex.test(entryName)) {
      return false;
    }

    const ext = extname(entryName).toLowerCase();
    if (effectiveIncludeExts && !effectiveIncludeExts.has(ext)) {
      return false;
    }

    if (excludeExts?.has(ext)) {
      return false;
    }

    return true;
  };
}
