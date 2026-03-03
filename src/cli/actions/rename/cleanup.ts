import { stat } from "node:fs/promises";

import { CliError } from "../../errors";
import { resolveFromCwd } from "../../fs-utils";
import type { CliRuntime } from "../../types";
import { actionDeferred } from "../deferred";
import { assertNonEmpty } from "../shared";

export type RenameCleanupStyle = "preserve" | "slug" | "uid";
export type RenameCleanupTimestampAction = "keep" | "remove";

const RENAME_CLEANUP_HINT_VALUES = ["date", "timestamp", "serial"] as const;
type RenameCleanupHint = (typeof RENAME_CLEANUP_HINT_VALUES)[number];

export interface RenameCleanupOptions {
  path: string;
  hints: string[];
  style?: RenameCleanupStyle;
  timestampAction?: RenameCleanupTimestampAction;
  dryRun?: boolean;
  previewSkips?: "summary" | "detailed";
  recursive?: boolean;
  maxDepth?: number;
  matchRegex?: string;
  skipRegex?: string;
  ext?: string[];
  skipExt?: string[];
}

type CleanupPathKind = "file" | "directory";

function normalizeCleanupHints(hints: string[]): RenameCleanupHint[] {
  if (hints.length === 0) {
    throw new CliError("At least one --hint is required.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const normalized: RenameCleanupHint[] = [];
  const seen = new Set<RenameCleanupHint>();
  for (const hint of hints) {
    const next = hint.trim().toLowerCase();
    if (!(RENAME_CLEANUP_HINT_VALUES as readonly string[]).includes(next)) {
      throw new CliError(
        `Invalid --hint value: ${hint}. Expected one of: ${RENAME_CLEANUP_HINT_VALUES.join(", ")}.`,
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }

    const typed = next as RenameCleanupHint;
    if (!seen.has(typed)) {
      normalized.push(typed);
      seen.add(typed);
    }
  }

  return normalized;
}

function normalizeCleanupPreviewSkipsMode(
  mode: RenameCleanupOptions["previewSkips"],
): "summary" | "detailed" | undefined {
  if (mode === undefined || mode === "summary" || mode === "detailed") {
    return mode;
  }
  throw new CliError(`Invalid --preview-skips value: ${mode}. Expected one of: summary, detailed`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

function assertDirectoryOnlyOptionAllowed(
  pathKind: CleanupPathKind,
  enabled: boolean,
  flag: string,
): void {
  if (pathKind === "file" && enabled) {
    throw new CliError(`${flag} is only supported when <path> is a directory.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
}

function validateCleanupModeOptions(
  pathKind: CleanupPathKind,
  options: RenameCleanupOptions & { hints: RenameCleanupHint[] },
): void {
  if (
    options.timestampAction !== undefined &&
    !options.hints.includes("timestamp")
  ) {
    throw new CliError("--timestamp-action requires --hint timestamp.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (
    options.maxDepth !== undefined &&
    (!Number.isInteger(options.maxDepth) || options.maxDepth < 0)
  ) {
    throw new CliError("--max-depth must be a non-negative integer.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  normalizeCleanupPreviewSkipsMode(options.previewSkips);
  assertDirectoryOnlyOptionAllowed(pathKind, options.recursive ?? false, "--recursive");
  assertDirectoryOnlyOptionAllowed(pathKind, options.maxDepth !== undefined, "--max-depth");
  assertDirectoryOnlyOptionAllowed(pathKind, options.matchRegex !== undefined, "--match-regex");
  assertDirectoryOnlyOptionAllowed(pathKind, options.skipRegex !== undefined, "--skip-regex");
  assertDirectoryOnlyOptionAllowed(pathKind, (options.ext?.length ?? 0) > 0, "--ext");
  assertDirectoryOnlyOptionAllowed(pathKind, (options.skipExt?.length ?? 0) > 0, "--skip-ext");
  assertDirectoryOnlyOptionAllowed(pathKind, options.previewSkips !== undefined, "--preview-skips");

  if (pathKind === "directory" && options.maxDepth !== undefined && !(options.recursive ?? false)) {
    throw new CliError("--max-depth requires --recursive.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
}

async function resolveCleanupPathKind(
  runtime: CliRuntime,
  inputPath: string,
): Promise<CleanupPathKind> {
  const resolvedPath = resolveFromCwd(runtime, inputPath);

  let pathStats;
  try {
    pathStats = await stat(resolvedPath);
  } catch {
    throw new CliError(`Cleanup path not found: ${resolvedPath}`, {
      code: "FILE_NOT_FOUND",
      exitCode: 2,
    });
  }

  if (pathStats.isFile()) {
    return "file";
  }
  if (pathStats.isDirectory()) {
    return "directory";
  }

  throw new CliError(`Cleanup path must be a file or directory: ${resolvedPath}`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

export async function actionRenameCleanup(
  runtime: CliRuntime,
  options: RenameCleanupOptions,
): Promise<void> {
  const inputPath = assertNonEmpty(options.path, "Cleanup path");
  const hints = normalizeCleanupHints(options.hints);
  const style = options.style ?? "preserve";
  const pathKind = await resolveCleanupPathKind(runtime, inputPath);
  validateCleanupModeOptions(pathKind, { ...options, hints, style });

  await actionDeferred(runtime, "rename cleanup");
}
