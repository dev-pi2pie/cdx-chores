import { lstat, readdir } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

import { slugifyName } from "../../../utils/slug";
import { createRenamePlanCsvRows, writeRenamePlanCsv } from "../../rename-plan-csv";
import { applyPlannedRenames, resolveFromCwd } from "../../fs-utils";
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

export type RenameCleanupStyle = "preserve" | "slug" | "uid";
export type RenameCleanupTimestampAction = "keep" | "remove";

const RENAME_CLEANUP_HINT_VALUES = ["date", "timestamp", "serial", "uid"] as const;
type RenameCleanupHint = (typeof RENAME_CLEANUP_HINT_VALUES)[number];
const MACOS_TIMESTAMP_PATTERN =
  /\b(\d{4})-(\d{2})-(\d{2}) at (\d{1,2})\.(\d{2})\.(\d{2}) (AM|PM)\b/i;

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
type CleanupPathTarget = { kind: CleanupPathKind; path: string };

interface CleanupTimestampMatch {
  prefix: string;
  suffix: string;
  normalizedTimestamp: string;
}

interface CleanupDateMatch {
  prefix: string;
  suffix: string;
  normalizedDate: string;
}

interface CleanupSerialMatch {
  prefix: string;
  normalizedSerial: string;
}

interface CleanupUidMatch {
  prefix: string;
  suffix: string;
}

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
  if (options.timestampAction !== undefined && !options.hints.includes("timestamp")) {
    throw new CliError("--timestamp-action requires --hint timestamp.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.maxDepth !== undefined && (!Number.isInteger(options.maxDepth) || options.maxDepth < 0)) {
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

async function resolveCleanupTarget(
  runtime: CliRuntime,
  inputPath: string,
): Promise<CleanupPathTarget> {
  const resolvedPath = resolveFromCwd(runtime, inputPath);

  let pathStats;
  try {
    pathStats = await lstat(resolvedPath);
  } catch {
    throw new CliError(`Cleanup path not found: ${resolvedPath}`, {
      code: "FILE_NOT_FOUND",
      exitCode: 2,
    });
  }

  if (pathStats.isSymbolicLink()) {
    throw new CliError(`Symlink inputs are not supported for rename cleanup: ${resolvedPath}`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (pathStats.isFile()) {
    return { kind: "file", path: resolvedPath };
  }
  if (pathStats.isDirectory()) {
    return { kind: "directory", path: resolvedPath };
  }

  throw new CliError(`Cleanup path must be a file or directory: ${resolvedPath}`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

function normalizePreserveStem(value: string): string {
  const normalized = value
    .replace(/\s+/g, " ")
    .replace(/^[\s._-]+|[\s._-]+$/g, "")
    .trim();
  return normalized || "file";
}

function trimCleanupFragmentEdges(value: string): string {
  return value.replace(/^[\s._-]+|[\s._-]+$/g, "").trim();
}

function formatCleanupTimestamp(
  year: string,
  month: string,
  day: string,
  hourText: string,
  minute: string,
  second: string,
  meridiem: string,
): string {
  const hour12 = Number(hourText);
  const normalizedMeridiem = meridiem.toUpperCase();
  const hour24 = normalizedMeridiem === "PM" ? (hour12 % 12) + 12 : hour12 % 12;
  return `${year}${month}${day}-${String(hour24).padStart(2, "0")}${minute}${second}`;
}

function matchCleanupTimestamp(stem: string): CleanupTimestampMatch | undefined {
  const match = MACOS_TIMESTAMP_PATTERN.exec(stem);
  if (!match || match.index === undefined) {
    return undefined;
  }
  const [, year, month, day, hour, minute, second, meridiem] = match;
  if (!year || !month || !day || !hour || !minute || !second || !meridiem) {
    return undefined;
  }

  return {
    prefix: stem.slice(0, match.index).trim(),
    suffix: stem.slice(match.index + match[0].length).trim(),
    normalizedTimestamp: formatCleanupTimestamp(
      year,
      month,
      day,
      hour,
      minute,
      second,
      meridiem,
    ),
  };
}

function matchCleanupDate(stem: string): CleanupDateMatch | undefined {
  if (MACOS_TIMESTAMP_PATTERN.test(stem)) {
    return undefined;
  }

  const match = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(stem);
  if (!match || match.index === undefined) {
    return undefined;
  }
  const [, year, month, day] = match;
  if (!year || !month || !day) {
    return undefined;
  }

  return {
    prefix: stem.slice(0, match.index).trim(),
    suffix: stem.slice(match.index + match[0].length).trim(),
    normalizedDate: `${year}${month}${day}`,
  };
}

function matchCleanupSerial(stem: string): CleanupSerialMatch | undefined {
  const parenthesizedMatch = /^(.*?)(?:[\s._-]*)\((\d{1,})\)$/.exec(stem);
  if (parenthesizedMatch) {
    const [, rawPrefix, serial] = parenthesizedMatch;
    const prefix = trimCleanupFragmentEdges(rawPrefix ?? "");
    if (serial && prefix) {
      return { prefix, normalizedSerial: serial };
    }
  }

  const separatedMatch = /^(.*?)(?:[\s_-]+)(0\d+)$/.exec(stem);
  if (!separatedMatch) {
    return undefined;
  }

  const [, rawPrefix, serial] = separatedMatch;
  const prefix = trimCleanupFragmentEdges(rawPrefix ?? "");
  if (!prefix || !serial) {
    return undefined;
  }

  if (/^(img|dsc)$/i.test(prefix)) {
    return undefined;
  }

  return { prefix, normalizedSerial: serial };
}

function matchCleanupUid(stem: string): CleanupUidMatch | undefined {
  const match = /(^|[\s._-]+)(uid-[0-9a-hjkmnpqrstvwxyz]{10,16})(?=$|[\s._-]+)(.*)$/i.exec(stem);
  if (!match || match.index === undefined) {
    return undefined;
  }

  return {
    prefix: trimCleanupFragmentEdges(stem.slice(0, match.index)),
    suffix: trimCleanupFragmentEdges(match[3] ?? ""),
  };
}

function buildTimestampCleanupStem(
  stem: string,
  style: RenameCleanupStyle,
  timestampAction: RenameCleanupTimestampAction,
): { nextStem: string; reason?: string; matchedTimestamp?: string } {
  const match = matchCleanupTimestamp(stem);
  if (!match) {
    return { nextStem: stem, reason: "no timestamp match" };
  }

  const parts = [match.prefix];
  if (timestampAction === "keep") {
    parts.push(match.normalizedTimestamp);
  }
  parts.push(match.suffix);
  const rebuilt = parts.filter((part) => part.length > 0).join(" ");
  const nextStem =
    style === "slug" ? slugifyName(rebuilt) : normalizePreserveStem(rebuilt);

  return { nextStem, matchedTimestamp: match.normalizedTimestamp };
}

function buildDateCleanupStem(
  stem: string,
  style: RenameCleanupStyle,
): { nextStem: string; reason?: string; matchedDate?: string } {
  const match = matchCleanupDate(stem);
  if (!match) {
    return { nextStem: stem, reason: "no date match" };
  }

  const rebuilt = [match.prefix, match.normalizedDate, match.suffix]
    .filter((part) => part.length > 0)
    .join(" ");
  const nextStem =
    style === "slug" ? slugifyName(rebuilt) : normalizePreserveStem(rebuilt);

  return { nextStem, matchedDate: match.normalizedDate };
}

function buildSerialCleanupStem(
  stem: string,
  style: RenameCleanupStyle,
): { nextStem: string; reason?: string; matchedSerial?: string } {
  const match = matchCleanupSerial(stem);
  if (!match) {
    return { nextStem: stem, reason: "no serial match" };
  }

  const rebuilt = [match.prefix, match.normalizedSerial]
    .filter((part) => part.length > 0)
    .join(" ");
  const nextStem =
    style === "slug" ? slugifyName(rebuilt) : normalizePreserveStem(rebuilt);

  return { nextStem, matchedSerial: match.normalizedSerial };
}

function buildUidCleanupStem(
  stem: string,
  style: Exclude<RenameCleanupStyle, "uid">,
): { nextStem: string; reason?: string } {
  const match = matchCleanupUid(stem);
  if (!match) {
    return { nextStem: stem, reason: "no uid match" };
  }

  const rebuilt = [match.prefix, match.suffix].filter((part) => part.length > 0).join(" ");
  const nextStem =
    style === "slug" ? slugifyName(rebuilt) : normalizePreserveStem(rebuilt);

  return { nextStem };
}

function buildTemporalCleanupStem(
  stem: string,
  hints: RenameCleanupHint[],
  style: RenameCleanupStyle,
  timestampAction: RenameCleanupTimestampAction,
): { nextStem: string; reason?: string } {
  const textStyle: Exclude<RenameCleanupStyle, "uid"> = style === "uid" ? "preserve" : style;
  if (hints.includes("timestamp")) {
    const timestampResult = buildTimestampCleanupStem(stem, textStyle, timestampAction);
    if (!timestampResult.reason) {
      return { nextStem: timestampResult.nextStem };
    }
  }

  if (hints.includes("date")) {
    const dateResult = buildDateCleanupStem(stem, textStyle);
    if (!dateResult.reason) {
      return { nextStem: dateResult.nextStem };
    }
  }

  if (hints.includes("serial")) {
    const serialResult = buildSerialCleanupStem(stem, textStyle);
    if (!serialResult.reason) {
      return { nextStem: serialResult.nextStem };
    }
  }

  if (hints.includes("uid")) {
    const uidResult = buildUidCleanupStem(stem, textStyle);
    if (!uidResult.reason) {
      return { nextStem: uidResult.nextStem };
    }
  }

  if (hints.includes("timestamp") && hints.includes("date")) {
    return { nextStem: stem, reason: "no date or timestamp match" };
  }
  if (hints.includes("timestamp")) {
    return { nextStem: stem, reason: "no timestamp match" };
  }
  if (hints.includes("date")) {
    return { nextStem: stem, reason: "no date match" };
  }
  if (hints.includes("serial")) {
    return { nextStem: stem, reason: "no serial match" };
  }
  if (hints.includes("uid")) {
    return { nextStem: stem, reason: "no uid match" };
  }
  return { nextStem: stem, reason: "no supported hint match" };
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

  if (style === "uid") {
    return {
      baseNames: await buildCleanupUidBasenames(sourcePath),
    };
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

async function collectDirectoryCleanupCandidates(
  directoryPath: string,
  options: RenameCleanupOptions,
): Promise<{ candidates: CleanupCandidate[]; skipped: SkippedRenameItem[]; occupiedFilePaths: Set<string> }> {
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
  },
): Promise<{ plans: PlannedRename[]; skipped: SkippedRenameItem[] }> {
  const plans: PlannedRename[] = [];
  const skipped: SkippedRenameItem[] = [];
  const sourcePaths = new Set(candidates.map((candidate) => candidate.sourcePath));
  const tentativeBySourcePath = new Map<
    string,
    { targetPath: string; reason?: string }
  >();
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

    let resolvedTargetPath = "";
    for (const baseName of result.baseNames) {
      const candidatePath = join(candidate.directoryPath, `${baseName}${candidate.ext}`);
      const hasPlannedConflict = (targetCounts.get(candidatePath) ?? 0) > 0;
      const hasUnchangedConflict = unchangedTargetPaths.has(candidatePath);
      const hasExistingConflict =
        occupiedFilePaths.has(candidatePath) && !sourcePaths.has(candidatePath);
      if (!hasPlannedConflict && !hasUnchangedConflict && !hasExistingConflict) {
        resolvedTargetPath = candidatePath;
        break;
      }
    }

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
    dryRun: boolean;
  },
): Promise<void> {
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

    for (const baseName of result.baseNames) {
      const candidatePath = join(directoryPath, `${baseName}${ext}`);
      if (!occupiedNames.has(basename(candidatePath))) {
        targetPath = candidatePath;
        break;
      }
    }

    if (targetPath === sourcePath && !result.baseNames.includes(stem)) {
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
    return;
  }

  await applyPlannedRenames([plan]);
  printRenameFileApplyFooter(runtime, plan.changed);
}

async function runDirectoryTemporalCleanup(
  runtime: CliRuntime,
  directoryPath: string,
  options: RenameCleanupOptions & {
    hints: RenameCleanupHint[];
    style: RenameCleanupStyle;
    timestampAction: RenameCleanupTimestampAction;
  },
): Promise<void> {
  const previewSkips = normalizeCleanupPreviewSkipsMode(options.previewSkips);
  const collected = await collectDirectoryCleanupCandidates(directoryPath, options);
  const planned = await buildDirectoryCleanupPlans(collected.candidates, collected.occupiedFilePaths, {
    hints: options.hints,
    style: options.style,
    timestampAction: options.timestampAction,
  });
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
    return;
  }

  await applyPlannedRenames(planned.plans);
  printRenameBatchApplyFooter(runtime, changedCount);
}

export async function actionRenameCleanup(
  runtime: CliRuntime,
  options: RenameCleanupOptions,
): Promise<void> {
  const inputPath = assertNonEmpty(options.path, "Cleanup path");
  const hints = normalizeCleanupHints(options.hints);
  const style = options.style ?? "preserve";
  const target = await resolveCleanupTarget(runtime, inputPath);
  validateCleanupModeOptions(target.kind, { ...options, hints, style });
  const timestampAction = options.timestampAction ?? "keep";

  if (target.kind === "file") {
    await runSingleTemporalCleanup(runtime, target.path, {
      hints,
      style,
      timestampAction,
      dryRun: options.dryRun ?? false,
    });
    return;
  }

  await runDirectoryTemporalCleanup(runtime, target.path, {
    ...options,
    hints,
    style,
    timestampAction,
  });
}
