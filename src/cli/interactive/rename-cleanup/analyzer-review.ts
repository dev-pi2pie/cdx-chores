import {
  RENAME_CLEANUP_ANALYZER_EVIDENCE_LIMITS,
  type RenameCleanupAnalyzerEvidence,
} from "../../actions";
import { printLine } from "../../actions/shared";
import type { CliRuntime } from "../../types";
import type { RenameCleanupHint } from "../../actions";

const CLEANUP_GROUPED_REVIEW_LIMITS = {
  // Keep grouped preview bounded in interactive terminals.
  maxGroupsToPrint: RENAME_CLEANUP_ANALYZER_EVIDENCE_LIMITS.groupLimit,
  maxExamplesLineChars: 220,
} as const;

function isAnalyzerFamilyInPattern(pattern: string, family: RenameCleanupHint): boolean {
  if (family === "timestamp") {
    return pattern.includes("{timestamp}");
  }
  if (family === "date") {
    return pattern.includes("{date}");
  }
  if (family === "serial") {
    return pattern.includes("{serial}");
  }
  return pattern.includes("{uid}");
}

export function narrowCleanupAnalyzerEvidence(
  evidence: RenameCleanupAnalyzerEvidence,
  selectedFamilies: RenameCleanupHint[],
  allFamilies: RenameCleanupHint[],
): RenameCleanupAnalyzerEvidence {
  if (selectedFamilies.length === allFamilies.length) {
    return evidence;
  }

  const narrowedGroups = evidence.groupedPatterns.filter((group) =>
    selectedFamilies.some((family) => isAnalyzerFamilyInPattern(group.pattern, family)),
  );
  const sampleNames: string[] = [];
  const sampleNameSet = new Set<string>();
  for (const group of narrowedGroups) {
    for (const example of group.examples) {
      if (sampleNameSet.has(example)) {
        continue;
      }
      sampleNameSet.add(example);
      sampleNames.push(example);
    }
  }

  return {
    ...evidence,
    sampledCount: sampleNames.length,
    sampleNames,
    groupedPatterns: narrowedGroups,
  };
}

export function printCleanupAnalyzerGroupedReview(
  runtime: CliRuntime,
  evidence: RenameCleanupAnalyzerEvidence,
): void {
  const truncate = (value: string, maxChars: number): { value: string; truncated: boolean } => {
    if (value.length <= maxChars) {
      return { value, truncated: false };
    }
    if (maxChars <= 3) {
      return { value: value.slice(0, maxChars), truncated: true };
    }
    return { value: `${value.slice(0, maxChars - 3)}...`, truncated: true };
  };

  printLine(runtime.stdout, "Grouped analyzer review:");
  if (evidence.groupedPatterns.length === 0) {
    printLine(runtime.stdout, "- no grouped pattern evidence");
    printLine(runtime.stdout);
    return;
  }

  const groupedPatterns = evidence.groupedPatterns.slice(
    0,
    CLEANUP_GROUPED_REVIEW_LIMITS.maxGroupsToPrint,
  );
  const hiddenGroupCount = Math.max(0, evidence.groupedPatterns.length - groupedPatterns.length);
  let truncatedExamplesGroupCount = 0;
  for (const group of groupedPatterns) {
    const truncatedExamples = truncate(
      group.examples.join(" | "),
      CLEANUP_GROUPED_REVIEW_LIMITS.maxExamplesLineChars,
    );
    if (truncatedExamples.truncated) {
      truncatedExamplesGroupCount += 1;
    }
    printLine(runtime.stdout, `- ${group.pattern} (${group.count})`);
    printLine(runtime.stdout, `  examples: ${truncatedExamples.value}`);
  }
  if (hiddenGroupCount > 0) {
    printLine(runtime.stdout, `- ... ${hiddenGroupCount} additional grouped pattern(s) not shown`);
  }
  if (truncatedExamplesGroupCount > 0) {
    printLine(
      runtime.stdout,
      `- ... examples truncated for ${truncatedExamplesGroupCount} grouped pattern(s)`,
    );
  }
  printLine(runtime.stdout);
}
