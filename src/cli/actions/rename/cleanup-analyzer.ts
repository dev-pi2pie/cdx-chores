import { readdir } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";

import type { CliRuntime } from "../../types";
import type { RenameCleanupPathKind } from "./cleanup-target";
import { resolveRenameCleanupTarget } from "./cleanup-target";
import type { RenameCleanupOptions } from "./cleanup-contract";
import { createRenameBatchFileFilter } from "./filters";

// Analyzer evidence limits are intentionally conservative:
// - sampleLimit bounds prompt payload and grouping cost
// - groupLimit keeps grouped review and suggestion context readable
// - examplesPerGroup balances pattern representativeness and output size
export const RENAME_CLEANUP_ANALYZER_EVIDENCE_LIMITS = {
  sampleLimit: 40,
  groupLimit: 12,
  examplesPerGroup: 3,
} as const;
const CLEANUP_ANALYZER_MACOS_TIMESTAMP_PATTERN =
  /\b\d{4}-\d{2}-\d{2} at \d{1,2}\.\d{2}\.\d{2} (?:AM|PM)\b/gi;
const CLEANUP_ANALYZER_DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/gi;
const CLEANUP_ANALYZER_UID_PATTERN = /\buid-[0-9a-hjkmnpqrstvwxyz]{10,16}\b/gi;
const RENAME_PLAN_CSV_ARTIFACT_PATTERN = /^rename-plan-\d{8}T\d{6}Z-[a-f0-9]{8}\.csv$/;

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
  onProgress?: (phase: "sampling" | "grouping") => void;
}

function clampPositiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  const normalized = Math.trunc(value);
  return normalized > 0 ? normalized : fallback;
}

function normalizeCleanupAnalyzerPattern(fileName: string): string {
  const originalExtension = extname(fileName);
  const extension = originalExtension.toLowerCase();
  const stem = basename(fileName, originalExtension);

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

function isRenamePlanCsvArtifactName(entryName: string): boolean {
  return RENAME_PLAN_CSV_ARTIFACT_PATTERN.test(entryName);
}

async function collectDirectoryCleanupAnalyzerSampling(
  directoryPath: string,
  options: Pick<
    RenameCleanupOptions,
    "recursive" | "maxDepth" | "matchRegex" | "skipRegex" | "ext" | "skipExt"
  > & {
    sampleLimit: number;
  },
): Promise<{ totalCandidateCount: number; sampleNames: string[] }> {
  const sampleNames: string[] = [];
  let totalCandidateCount = 0;
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

      if (isRenamePlanCsvArtifactName(entry.name)) {
        continue;
      }
      if (!fileFilter(entry.name)) {
        continue;
      }

      totalCandidateCount += 1;
      if (sampleNames.length < options.sampleLimit) {
        sampleNames.push(toRelativeDisplayName(directoryPath, entryPath));
      }
    }
  };

  await visitDirectory(directoryPath, 0);
  return { totalCandidateCount, sampleNames };
}

export async function collectRenameCleanupAnalyzerEvidence(
  runtime: CliRuntime,
  options: RenameCleanupAnalyzerEvidenceOptions,
): Promise<RenameCleanupAnalyzerEvidence> {
  const target = await resolveRenameCleanupTarget(runtime, options.path);
  const sampleLimit = clampPositiveInteger(
    options.sampleLimit,
    RENAME_CLEANUP_ANALYZER_EVIDENCE_LIMITS.sampleLimit,
  );
  const groupLimit = clampPositiveInteger(
    options.groupLimit,
    RENAME_CLEANUP_ANALYZER_EVIDENCE_LIMITS.groupLimit,
  );
  const examplesPerGroup = clampPositiveInteger(
    options.examplesPerGroup,
    RENAME_CLEANUP_ANALYZER_EVIDENCE_LIMITS.examplesPerGroup,
  );
  options.onProgress?.("sampling");

  if (target.kind === "file") {
    const fileName = basename(target.path);
    options.onProgress?.("grouping");
    return {
      targetKind: "file",
      targetPath: target.path,
      totalCandidateCount: 1,
      sampledCount: 1,
      sampleNames: [fileName],
      groupedPatterns: buildGroupedPatterns([fileName], { groupLimit, examplesPerGroup }),
    };
  }

  const sampled = await collectDirectoryCleanupAnalyzerSampling(target.path, {
    recursive: options.recursive,
    maxDepth: options.maxDepth,
    matchRegex: options.matchRegex,
    skipRegex: options.skipRegex,
    ext: options.ext,
    skipExt: options.skipExt,
    sampleLimit,
  });
  options.onProgress?.("grouping");

  return {
    targetKind: "directory",
    targetPath: target.path,
    totalCandidateCount: sampled.totalCandidateCount,
    sampledCount: sampled.sampleNames.length,
    sampleNames: sampled.sampleNames,
    groupedPatterns: buildGroupedPatterns(sampled.sampleNames, { groupLimit, examplesPerGroup }),
  };
}
