import { readdir } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

import { slugifyName } from "../../../utils/slug";
import { createRenamePlanCsvRows, writeRenamePlanCsv } from "../../rename-plan-csv";
import { applyPlannedRenames } from "../../fs-utils";
import type { CliRuntime, PlannedRename, SkippedRenameItem } from "../../types";
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
import { createRenameBatchFileFilter } from "./filters";
import { buildCleanupUidBasenames } from "./cleanup-uid";
import {
  CLEANUP_HINT_VALUES,
  buildTemporalCleanupStem,
  type CleanupHint,
  type CleanupTextStyle,
} from "./cleanup-matchers";
import { type RenameCleanupPathKind, resolveRenameCleanupTarget } from "./cleanup-target";

export type RenameCleanupStyle = "preserve" | "slug";
export type RenameCleanupTimestampAction = "keep" | "remove";
export type RenameCleanupConflictStrategy = "skip" | "number" | "uid-suffix";

const RENAME_CLEANUP_HINT_VALUES = CLEANUP_HINT_VALUES;
type RenameCleanupHint = CleanupHint;
const RENAME_CLEANUP_CONFLICT_STRATEGY_VALUES = ["skip", "number", "uid-suffix"] as const;
const RENAME_PLAN_CSV_ARTIFACT_PATTERN = /^rename-plan-\d{8}T\d{6}Z-[a-f0-9]{8}\.csv$/;

export interface RenameCleanupOptions {
  path: string;
  hints: string[];
  style?: RenameCleanupStyle;
  timestampAction?: RenameCleanupTimestampAction;
  conflictStrategy?: RenameCleanupConflictStrategy;
  dryRun?: boolean;
  previewSkips?: "summary" | "detailed";
  recursive?: boolean;
  maxDepth?: number;
  matchRegex?: string;
  skipRegex?: string;
  ext?: string[];
  skipExt?: string[];
}

export type RenameCleanupResult =
  | {
      kind: "file";
      changed: boolean;
      filePath: string;
      directoryPath: string;
      planCsvPath?: string;
    }
  | {
      kind: "directory";
      changedCount: number;
      totalCount: number;
      directoryPath: string;
      planCsvPath?: string;
    };

interface CleanupCandidate {
  sourcePath: string;
  directoryPath: string;
  currentName: string;
  stem: string;
  ext: string;
}

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

  if (
    (RENAME_CLEANUP_CONFLICT_STRATEGY_VALUES as readonly string[]).includes(strategy)
  ) {
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

function buildCleanupNumberConflictBasename(preferredBaseName: string, index: number): string {
  return index <= 0 ? preferredBaseName : `${preferredBaseName}-${index}`;
}

async function buildCleanupUidConflictBasenames(
  sourcePath: string,
  preferredBaseName: string,
): Promise<string[]> {
  const uidBasenames = await buildCleanupUidBasenames(sourcePath);
  return uidBasenames.map((uidBasename) => `${preferredBaseName}-${uidBasename}`);
}

async function resolveCleanupConflictBasename(
  options: {
    sourcePath: string;
    preferredBaseName: string;
    conflictStrategy: RenameCleanupConflictStrategy;
  },
  isAvailable: (baseName: string) => boolean,
): Promise<string | undefined> {
  if (isAvailable(options.preferredBaseName)) {
    return options.preferredBaseName;
  }

  if (options.conflictStrategy === "skip") {
    return undefined;
  }

  if (options.conflictStrategy === "number") {
    for (let index = 1; index <= 10000; index += 1) {
      const nextBaseName = buildCleanupNumberConflictBasename(options.preferredBaseName, index);
      if (isAvailable(nextBaseName)) {
        return nextBaseName;
      }
    }
    return undefined;
  }

  const uidConflictBasenames = await buildCleanupUidConflictBasenames(
    options.sourcePath,
    options.preferredBaseName,
  );
  for (const nextBaseName of uidConflictBasenames) {
    if (isAvailable(nextBaseName)) {
      return nextBaseName;
    }
  }

  return undefined;
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

async function buildCleanupBasenameCandidates(
  sourcePath: string,
  stem: string,
  hints: RenameCleanupHint[],
  style: RenameCleanupStyle,
  timestampAction: RenameCleanupTimestampAction,
): Promise<{ baseNames: string[]; reason?: string }> {
  const result = buildTemporalCleanupStem(stem, hints, style, timestampAction);
  if (result.reason) {
    return { baseNames: [stem], reason: result.reason };
  }

  return { baseNames: [result.nextStem] };
}

function buildCleanupSinglePlanCsvRows(
  runtime: CliRuntime,
  plan: PlannedRename,
  reason: string | undefined,
): ReturnType<typeof createRenamePlanCsvRows>["rows"] {
  const cleanedStemBySourcePath = new Map<string, string>([
    [plan.fromPath, slugifyName(basename(plan.toPath, extname(plan.toPath)))],
  ]);
  const reasonBySourcePath = reason
    ? new Map<string, string>([[plan.fromPath, reason]])
    : new Map<string, string>();
  return createRenamePlanCsvRows({
    runtime,
    plans: [plan],
    cleanedStemBySourcePath,
    reasonBySourcePath,
  }).rows;
}

function buildCleanupBatchPlanCsvRows(
  runtime: CliRuntime,
  plans: PlannedRename[],
  skippedItems: SkippedRenameItem[],
): ReturnType<typeof createRenamePlanCsvRows>["rows"] {
  const cleanedStemBySourcePath = new Map<string, string>();
  for (const plan of plans) {
    cleanedStemBySourcePath.set(
      plan.fromPath,
      slugifyName(basename(plan.toPath, extname(plan.toPath))),
    );
  }

  return createRenamePlanCsvRows({
    runtime,
    plans,
    skippedItems,
    cleanedStemBySourcePath,
  }).rows;
}

function isRenamePlanCsvArtifactName(entryName: string): boolean {
  return RENAME_PLAN_CSV_ARTIFACT_PATTERN.test(entryName);
}

async function collectDirectoryCleanupCandidates(
  directoryPath: string,
  options: RenameCleanupOptions,
): Promise<{
  candidates: CleanupCandidate[];
  skipped: SkippedRenameItem[];
  occupiedFilePaths: Set<string>;
}> {
  const skipped: SkippedRenameItem[] = [];
  const candidates: CleanupCandidate[] = [];
  const occupiedFilePaths = new Set<string>();
  const recursive = options.recursive ?? false;
  const maxDepth = recursive ? (options.maxDepth ?? Number.POSITIVE_INFINITY) : 0;
  const fileFilter = createRenameBatchFileFilter({
    matchRegex: options.matchRegex,
    skipRegex: options.skipRegex,
    ext: options.ext,
    skipExt: options.skipExt,
  });

  const visitDirectory = async (currentDirectoryPath: string, depth: number): Promise<void> => {
    const entries = await readdir(currentDirectoryPath, { withFileTypes: true });
    const sortedEntries = [...entries].sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of sortedEntries) {
      const entryPath = join(currentDirectoryPath, entry.name);

      if (entry.isSymbolicLink()) {
        skipped.push({ path: entryPath, reason: "symlink" });
        continue;
      }

      if (entry.isDirectory()) {
        if (recursive && depth < maxDepth) {
          await visitDirectory(entryPath, depth + 1);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      occupiedFilePaths.add(entryPath);
      if (isRenamePlanCsvArtifactName(entry.name)) {
        continue;
      }
      if (!fileFilter(entry.name)) {
        continue;
      }

      const ext = extname(entry.name);
      candidates.push({
        sourcePath: entryPath,
        directoryPath: currentDirectoryPath,
        currentName: entry.name,
        stem: basename(entry.name, ext),
        ext,
      });
    }
  };

  await visitDirectory(directoryPath, 0);
  return { candidates, skipped, occupiedFilePaths };
}

async function buildDirectoryCleanupPlans(
  candidates: CleanupCandidate[],
  occupiedFilePaths: Set<string>,
  options: {
    hints: RenameCleanupHint[];
    style: RenameCleanupStyle;
    timestampAction: RenameCleanupTimestampAction;
    conflictStrategy: RenameCleanupConflictStrategy;
  },
): Promise<{ plans: PlannedRename[]; skipped: SkippedRenameItem[] }> {
  const plans: PlannedRename[] = [];
  const skipped: SkippedRenameItem[] = [];
  const sourcePaths = new Set(candidates.map((candidate) => candidate.sourcePath));
  const tentativeBySourcePath = new Map<string, { targetPath: string; reason?: string }>();
  const unchangedTargetPaths = new Set<string>();
  const targetCounts = new Map<string, number>();

  for (const candidate of candidates) {
    const result = await buildCleanupBasenameCandidates(
      candidate.sourcePath,
      candidate.stem,
      options.hints,
      options.style,
      options.timestampAction,
    );
    if (result.reason) {
      tentativeBySourcePath.set(candidate.sourcePath, {
        targetPath: candidate.sourcePath,
        reason: result.reason,
      });
      unchangedTargetPaths.add(candidate.sourcePath);
      continue;
    }

    const preferredBaseName = result.baseNames[0] ?? candidate.stem;
    const resolvedBaseName = await resolveCleanupConflictBasename(
      {
        sourcePath: candidate.sourcePath,
        preferredBaseName,
        conflictStrategy: options.conflictStrategy,
      },
      (baseName) => {
        const candidatePath = join(candidate.directoryPath, `${baseName}${candidate.ext}`);
        const hasPlannedConflict = (targetCounts.get(candidatePath) ?? 0) > 0;
        const hasUnchangedConflict = unchangedTargetPaths.has(candidatePath);
        const hasExistingConflict =
          occupiedFilePaths.has(candidatePath) && !sourcePaths.has(candidatePath);
        return !hasPlannedConflict && !hasUnchangedConflict && !hasExistingConflict;
      },
    );
    const resolvedTargetPath = resolvedBaseName
      ? join(candidate.directoryPath, `${resolvedBaseName}${candidate.ext}`)
      : "";

    if (!resolvedTargetPath) {
      tentativeBySourcePath.set(candidate.sourcePath, {
        targetPath: candidate.sourcePath,
        reason: "target conflict",
      });
      unchangedTargetPaths.add(candidate.sourcePath);
      continue;
    }

    tentativeBySourcePath.set(candidate.sourcePath, { targetPath: resolvedTargetPath });
    targetCounts.set(resolvedTargetPath, (targetCounts.get(resolvedTargetPath) ?? 0) + 1);
    if (resolvedTargetPath === candidate.sourcePath) {
      unchangedTargetPaths.add(resolvedTargetPath);
    }
  }

  for (const candidate of candidates) {
    const tentative = tentativeBySourcePath.get(candidate.sourcePath)!;
    const targetPath = tentative.targetPath;

    if (tentative.reason) {
      skipped.push({ path: candidate.sourcePath, reason: tentative.reason });
      continue;
    }

    if (targetPath === candidate.sourcePath) {
      skipped.push({ path: candidate.sourcePath, reason: "unchanged" });
      continue;
    }

    if (targetCounts.get(targetPath)! > 1) {
      skipped.push({ path: candidate.sourcePath, reason: "target conflict" });
      continue;
    }

    if (unchangedTargetPaths.has(targetPath)) {
      skipped.push({ path: candidate.sourcePath, reason: "target conflict" });
      continue;
    }

    if (occupiedFilePaths.has(targetPath) && !sourcePaths.has(targetPath)) {
      skipped.push({ path: candidate.sourcePath, reason: "target conflict" });
      continue;
    }

    plans.push({
      fromPath: candidate.sourcePath,
      toPath: targetPath,
      changed: true,
    });
  }

  return { plans, skipped };
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
