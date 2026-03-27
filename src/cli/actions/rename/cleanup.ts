import { readdir } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

import { writeRenamePlanCsv } from "../../rename-plan-csv";
import { applyPlannedRenames } from "../../rename/apply";
import type { CliRuntime, PlannedRename } from "../../types";
import { CliError } from "../../errors";
import { assertNonEmpty, displayPath, printLine } from "../shared";
import {
  printRenameBatchApplyFooter,
  printRenameBatchDryRunFooter,
  printRenameBatchPreview,
  printRenameFileApplyFooter,
  printRenameFileDryRunFooter,
  printRenameFilePreview,
} from "./reporting";
import { CLEANUP_HINT_VALUES } from "./cleanup-matchers";
import type {
  RenameCleanupConflictStrategy,
  RenameCleanupHint,
  RenameCleanupOptions,
  RenameCleanupResult,
  RenameCleanupStyle,
  RenameCleanupTimestampAction,
} from "./cleanup-contract";
import {
  buildCleanupBasenameCandidates,
  buildCleanupBatchPlanCsvRows,
  buildCleanupSinglePlanCsvRows,
  buildDirectoryCleanupPlans,
  collectDirectoryCleanupCandidates,
  resolveCleanupConflictBasename,
} from "./cleanup-planner";
import { type RenameCleanupPathKind, resolveRenameCleanupTarget } from "./cleanup-target";

export type {
  RenameCleanupConflictStrategy,
  RenameCleanupHint,
  RenameCleanupOptions,
  RenameCleanupResult,
  RenameCleanupStyle,
  RenameCleanupTimestampAction,
} from "./cleanup-contract";

const RENAME_CLEANUP_HINT_VALUES = CLEANUP_HINT_VALUES;
const RENAME_CLEANUP_CONFLICT_STRATEGY_VALUES = ["skip", "number", "uid-suffix"] as const;

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
): "summary" | "detailed" {
  if (mode === undefined || mode === "summary") {
    return "summary";
  }
  if (mode === "detailed") {
    return "detailed";
  }
  throw new CliError(`Invalid --preview-skips value: ${mode}. Expected one of: summary, detailed`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

function normalizeCleanupConflictStrategy(
  strategy: RenameCleanupOptions["conflictStrategy"],
): RenameCleanupConflictStrategy {
  if (strategy === undefined) {
    return "skip";
  }

  if ((RENAME_CLEANUP_CONFLICT_STRATEGY_VALUES as readonly string[]).includes(strategy)) {
    return strategy;
  }

  throw new CliError(
    `Invalid --conflict-strategy value: ${strategy}. Expected one of: ${RENAME_CLEANUP_CONFLICT_STRATEGY_VALUES.join(", ")}.`,
    {
      code: "INVALID_INPUT",
      exitCode: 2,
    },
  );
}

function assertDirectoryOnlyOptionAllowed(
  pathKind: RenameCleanupPathKind,
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
  pathKind: RenameCleanupPathKind,
  options: RenameCleanupOptions & { hints: RenameCleanupHint[] },
): void {
  if (options.timestampAction !== undefined && !options.hints.includes("timestamp")) {
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

async function runSingleTemporalCleanup(
  runtime: CliRuntime,
  sourcePath: string,
  options: {
    hints: RenameCleanupHint[];
    style: RenameCleanupStyle;
    timestampAction: RenameCleanupTimestampAction;
    conflictStrategy: RenameCleanupConflictStrategy;
    dryRun: boolean;
  },
): Promise<RenameCleanupResult> {
  const sourceName = basename(sourcePath);
  const ext = extname(sourceName);
  const stem = basename(sourceName, ext);
  const directoryPath = dirname(sourcePath);
  const result = await buildCleanupBasenameCandidates(
    sourcePath,
    stem,
    options.hints,
    options.style,
    options.timestampAction,
  );
  let finalReason = result.reason;
  let targetPath = sourcePath;

  if (!finalReason) {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    const occupiedNames = new Set(
      entries.map((entry) => entry.name).filter((entryName) => entryName !== sourceName),
    );
    const preferredBaseName = result.baseNames[0] ?? stem;
    const resolvedBaseName = await resolveCleanupConflictBasename(
      {
        sourcePath,
        preferredBaseName,
        conflictStrategy: options.conflictStrategy,
      },
      (baseName) => !occupiedNames.has(`${baseName}${ext}`),
    );

    if (resolvedBaseName) {
      targetPath = join(directoryPath, `${resolvedBaseName}${ext}`);
    }

    if (targetPath === sourcePath && preferredBaseName !== stem) {
      finalReason = "target conflict";
    }
  }

  const plan: PlannedRename = {
    fromPath: sourcePath,
    toPath: finalReason ? sourcePath : targetPath,
    changed: !finalReason && targetPath !== sourcePath,
  };

  printLine(runtime.stdout, `Directory: ${displayPath(runtime, directoryPath)}`);
  printLine(runtime.stdout, `File: ${displayPath(runtime, sourcePath)}`);
  printRenameFilePreview(runtime, plan);
  if (finalReason) {
    printLine(runtime.stdout, `Reason: ${finalReason}`);
  }

  if (options.dryRun) {
    const rows = buildCleanupSinglePlanCsvRows(runtime, plan, finalReason);
    const planCsvPath = await writeRenamePlanCsv(runtime, rows);
    printRenameFileDryRunFooter(runtime, planCsvPath);
    return {
      kind: "file",
      changed: plan.changed,
      filePath: sourcePath,
      directoryPath,
      planCsvPath,
    };
  }

  await applyPlannedRenames([plan]);
  printRenameFileApplyFooter(runtime, plan.changed);
  return {
    kind: "file",
    changed: plan.changed,
    filePath: sourcePath,
    directoryPath,
  };
}

async function runDirectoryTemporalCleanup(
  runtime: CliRuntime,
  directoryPath: string,
  options: RenameCleanupOptions & {
    hints: RenameCleanupHint[];
    style: RenameCleanupStyle;
    timestampAction: RenameCleanupTimestampAction;
    conflictStrategy: RenameCleanupConflictStrategy;
  },
): Promise<RenameCleanupResult> {
  const previewSkips = normalizeCleanupPreviewSkipsMode(options.previewSkips);
  const collected = await collectDirectoryCleanupCandidates(directoryPath, options);
  const planned = await buildDirectoryCleanupPlans(
    collected.candidates,
    collected.occupiedFilePaths,
    {
      hints: options.hints,
      style: options.style,
      timestampAction: options.timestampAction,
      conflictStrategy: options.conflictStrategy,
    },
  );
  const totalCount = collected.candidates.length;
  const changedCount = planned.plans.length;
  const skipped = [...collected.skipped, ...planned.skipped];

  printLine(runtime.stdout, `Directory: ${displayPath(runtime, directoryPath)}`);
  printLine(runtime.stdout, `Files found: ${totalCount}`);
  printLine(runtime.stdout, `Files to rename: ${changedCount}`);
  if (skipped.length > 0) {
    printLine(runtime.stdout, `Entries skipped: ${skipped.length}`);
  }
  printLine(runtime.stdout);

  const { truncated } = printRenameBatchPreview(runtime, {
    plans: planned.plans,
    skipped,
    previewSkips,
    dryRun: options.dryRun ?? false,
  });

  if (options.dryRun ?? false) {
    const rows = buildCleanupBatchPlanCsvRows(runtime, planned.plans, skipped);
    const planCsvPath = await writeRenamePlanCsv(runtime, rows);
    printRenameBatchDryRunFooter(runtime, { planCsvPath, truncated });
    return {
      kind: "directory",
      changedCount,
      totalCount,
      directoryPath,
      planCsvPath,
    };
  }

  await applyPlannedRenames(planned.plans);
  printRenameBatchApplyFooter(runtime, changedCount);
  return {
    kind: "directory",
    changedCount,
    totalCount,
    directoryPath,
  };
}

export async function actionRenameCleanup(
  runtime: CliRuntime,
  options: RenameCleanupOptions,
): Promise<RenameCleanupResult> {
  const inputPath = assertNonEmpty(options.path, "Cleanup path");
  const hints = normalizeCleanupHints(options.hints);
  const style = options.style ?? "preserve";
  const target = await resolveRenameCleanupTarget(runtime, inputPath);
  validateCleanupModeOptions(target.kind, { ...options, hints, style });
  const timestampAction = options.timestampAction ?? "keep";
  const conflictStrategy = normalizeCleanupConflictStrategy(options.conflictStrategy);

  if (target.kind === "file") {
    return await runSingleTemporalCleanup(runtime, target.path, {
      hints,
      style,
      timestampAction,
      conflictStrategy,
      dryRun: options.dryRun ?? false,
    });
  }

  return await runDirectoryTemporalCleanup(runtime, target.path, {
    ...options,
    hints,
    style,
    timestampAction,
    conflictStrategy,
  });
}
