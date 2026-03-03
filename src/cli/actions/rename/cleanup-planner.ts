import { readdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";

import { createRenamePlanCsvRows } from "../../rename-plan-csv";
import type { CliRuntime, PlannedRename, SkippedRenameItem } from "../../types";
import { createRenameBatchFileFilter } from "./filters";
import { buildTemporalCleanupStem } from "./cleanup-matchers";
import { buildCleanupUidBasenames } from "./cleanup-uid";
import type {
  RenameCleanupConflictStrategy,
  RenameCleanupHint,
  RenameCleanupOptions,
  RenameCleanupStyle,
  RenameCleanupTimestampAction,
} from "./cleanup-contract";

interface CleanupCandidate {
  sourcePath: string;
  directoryPath: string;
  currentName: string;
  stem: string;
  ext: string;
}

const RENAME_PLAN_CSV_ARTIFACT_PATTERN = /^rename-plan-\d{8}T\d{6}Z-[a-f0-9]{8}\.csv$/;

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

export async function resolveCleanupConflictBasename(
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

export async function buildCleanupBasenameCandidates(
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

export function buildCleanupSinglePlanCsvRows(
  runtime: CliRuntime,
  plan: PlannedRename,
  reason: string | undefined,
): ReturnType<typeof createRenamePlanCsvRows>["rows"] {
  const cleanedStemBySourcePath = new Map<string, string>([
    [plan.fromPath, basename(plan.toPath, extname(plan.toPath))],
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

export function buildCleanupBatchPlanCsvRows(
  runtime: CliRuntime,
  plans: PlannedRename[],
  skippedItems: SkippedRenameItem[],
): ReturnType<typeof createRenamePlanCsvRows>["rows"] {
  const cleanedStemBySourcePath = new Map<string, string>();
  for (const plan of plans) {
    cleanedStemBySourcePath.set(plan.fromPath, basename(plan.toPath, extname(plan.toPath)));
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

export async function collectDirectoryCleanupCandidates(
  directoryPath: string,
  options: Pick<
    RenameCleanupOptions,
    "recursive" | "maxDepth" | "matchRegex" | "skipRegex" | "ext" | "skipExt"
  >,
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

export async function buildDirectoryCleanupPlans(
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
