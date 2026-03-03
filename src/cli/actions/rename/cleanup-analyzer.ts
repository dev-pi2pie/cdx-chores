import { basename, extname, relative } from "node:path";

import type { CliRuntime } from "../../types";
import type { RenameCleanupPathKind } from "./cleanup-target";
import { resolveRenameCleanupTarget } from "./cleanup-target";
import { collectDirectoryCleanupCandidates } from "./cleanup-planner";
import type { RenameCleanupOptions } from "./cleanup-contract";

const DEFAULT_CLEANUP_ANALYZER_SAMPLE_LIMIT = 40;
const DEFAULT_CLEANUP_ANALYZER_GROUP_LIMIT = 12;
const DEFAULT_CLEANUP_ANALYZER_EXAMPLES_PER_GROUP = 3;
const CLEANUP_ANALYZER_MACOS_TIMESTAMP_PATTERN =
  /\b\d{4}-\d{2}-\d{2} at \d{1,2}\.\d{2}\.\d{2} (?:AM|PM)\b/gi;
const CLEANUP_ANALYZER_DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/gi;
const CLEANUP_ANALYZER_UID_PATTERN = /\buid-[0-9a-hjkmnpqrstvwxyz]{10,16}\b/gi;

export interface RenameCleanupAnalyzerGroup {
  pattern: string;
  count: number;
  examples: string[];
}

export interface RenameCleanupAnalyzerEvidence {
  targetKind: RenameCleanupPathKind;
  targetPath: string;
  totalCandidateCount: number;
  sampledCount: number;
  sampleNames: string[];
  groupedPatterns: RenameCleanupAnalyzerGroup[];
}

export interface RenameCleanupAnalyzerEvidenceOptions
  extends Pick<
    RenameCleanupOptions,
    "path" | "recursive" | "maxDepth" | "matchRegex" | "skipRegex" | "ext" | "skipExt"
  > {
  sampleLimit?: number;
  groupLimit?: number;
  examplesPerGroup?: number;
}

function clampPositiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  const normalized = Math.trunc(value);
  return normalized > 0 ? normalized : fallback;
}

function normalizeCleanupAnalyzerPattern(fileName: string): string {
  const extension = extname(fileName).toLowerCase();
  const stem = basename(fileName, extension);

  const normalizedStem = stem
    .toLowerCase()
    .replace(CLEANUP_ANALYZER_MACOS_TIMESTAMP_PATTERN, "{timestamp}")
    .replace(CLEANUP_ANALYZER_DATE_PATTERN, "{date}")
    .replace(CLEANUP_ANALYZER_UID_PATTERN, "{uid}")
    .replace(/(?:[\s._-]*)\(\d+\)$/g, "-{serial}")
    .replace(/(?:[\s_-]+)0\d+$/g, "-{serial}")
    .replace(/\d+/g, "#")
    .replace(/[\s._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${normalizedStem || "file"}${extension}`;
}

function buildGroupedPatterns(
  names: string[],
  options: { groupLimit: number; examplesPerGroup: number },
): RenameCleanupAnalyzerGroup[] {
  const grouped = new Map<string, RenameCleanupAnalyzerGroup>();

  for (const name of names) {
    const pattern = normalizeCleanupAnalyzerPattern(basename(name));
    const existing = grouped.get(pattern);
    if (!existing) {
      grouped.set(pattern, {
        pattern,
        count: 1,
        examples: [name],
      });
      continue;
    }

    existing.count += 1;
    if (existing.examples.length < options.examplesPerGroup) {
      existing.examples.push(name);
    }
  }

  return [...grouped.values()]
    .sort((left, right) => right.count - left.count || left.pattern.localeCompare(right.pattern))
    .slice(0, options.groupLimit);
}

function toRelativeDisplayName(rootPath: string, filePath: string): string {
  const next = relative(rootPath, filePath);
  return next && next.length > 0 ? next : basename(filePath);
}

export async function collectRenameCleanupAnalyzerEvidence(
  runtime: CliRuntime,
  options: RenameCleanupAnalyzerEvidenceOptions,
): Promise<RenameCleanupAnalyzerEvidence> {
  const target = await resolveRenameCleanupTarget(runtime, options.path);
  const sampleLimit = clampPositiveInteger(options.sampleLimit, DEFAULT_CLEANUP_ANALYZER_SAMPLE_LIMIT);
  const groupLimit = clampPositiveInteger(options.groupLimit, DEFAULT_CLEANUP_ANALYZER_GROUP_LIMIT);
  const examplesPerGroup = clampPositiveInteger(
    options.examplesPerGroup,
    DEFAULT_CLEANUP_ANALYZER_EXAMPLES_PER_GROUP,
  );

  if (target.kind === "file") {
    const fileName = basename(target.path);
    return {
      targetKind: "file",
      targetPath: target.path,
      totalCandidateCount: 1,
      sampledCount: 1,
      sampleNames: [fileName],
      groupedPatterns: buildGroupedPatterns([fileName], { groupLimit, examplesPerGroup }),
    };
  }

  const collected = await collectDirectoryCleanupCandidates(target.path, {
    recursive: options.recursive,
    maxDepth: options.maxDepth,
    matchRegex: options.matchRegex,
    skipRegex: options.skipRegex,
    ext: options.ext,
    skipExt: options.skipExt,
  });
  const names = collected.candidates.map((candidate) =>
    toRelativeDisplayName(target.path, candidate.sourcePath),
  );
  const sampledNames = names.slice(0, sampleLimit);

  return {
    targetKind: "directory",
    targetPath: target.path,
    totalCandidateCount: names.length,
    sampledCount: sampledNames.length,
    sampleNames: sampledNames,
    groupedPatterns: buildGroupedPatterns(sampledNames, { groupLimit, examplesPerGroup }),
  };
}
