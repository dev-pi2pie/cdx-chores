import { randomUUID } from "node:crypto";
import { relative, resolve } from "node:path";

import { stringifyCsv } from "../../../utils/csv";
import { formatUtcFileDateTimeISO } from "../../../utils/datetime";
import { writeTextFileSafe } from "../../file-io";
import type { CliRuntime } from "../../types";
import type { RenameCleanupAnalyzerEvidence } from "./cleanup-analyzer";
import type { RenameCleanupCodexSuggestion } from "./cleanup-codex";

export const RENAME_CLEANUP_ANALYSIS_CSV_HEADERS = [
  "report_id",
  "generated_at",
  "scope_kind",
  "scope_path",
  "total_candidate_count",
  "sampled_count",
  "group_index",
  "grouped_pattern",
  "group_count",
  "representative_examples",
  "recommended_hints",
  "recommended_style",
  "recommended_timestamp_action",
  "confidence",
  "reasoning_summary",
] as const;

export interface RenameCleanupAnalysisCsvRow {
  report_id: string;
  generated_at: string;
  scope_kind: RenameCleanupAnalyzerEvidence["targetKind"];
  scope_path: string;
  total_candidate_count: string;
  sampled_count: string;
  group_index: string;
  grouped_pattern: string;
  group_count: string;
  representative_examples: string;
  recommended_hints: string;
  recommended_style: string;
  recommended_timestamp_action: string;
  confidence: string;
  reasoning_summary: string;
}

function toReportScopePath(cwd: string, absolutePath: string): string {
  const next = relative(cwd, absolutePath);
  if (!next || next.startsWith("..")) {
    return absolutePath;
  }
  return next;
}

export function createRenameCleanupAnalysisCsvRows(
  runtime: CliRuntime,
  options: {
    evidence: RenameCleanupAnalyzerEvidence;
    suggestion: RenameCleanupCodexSuggestion;
  },
): { rows: RenameCleanupAnalysisCsvRow[]; reportId: string; generatedAt: string } {
  const generatedAt = runtime.now().toISOString();
  const reportId = `${formatUtcFileDateTimeISO(runtime.now())}-${randomUUID().slice(0, 8)}`;
  const rows = options.evidence.groupedPatterns.map((group, index) => ({
    report_id: reportId,
    generated_at: generatedAt,
    scope_kind: options.evidence.targetKind,
    scope_path: toReportScopePath(runtime.cwd, options.evidence.targetPath),
    total_candidate_count: String(options.evidence.totalCandidateCount),
    sampled_count: String(options.evidence.sampledCount),
    group_index: String(index + 1),
    grouped_pattern: group.pattern,
    group_count: String(group.count),
    representative_examples: group.examples.join(" | "),
    recommended_hints: options.suggestion.recommendedHints.join(","),
    recommended_style: options.suggestion.recommendedStyle,
    recommended_timestamp_action: options.suggestion.recommendedTimestampAction ?? "",
    confidence: String(options.suggestion.confidence),
    reasoning_summary: options.suggestion.reasoningSummary,
  }));

  return { rows, reportId, generatedAt };
}

function stringifyRenameCleanupAnalysisCsv(rows: RenameCleanupAnalysisCsvRow[]): string {
  if (rows.length === 0) {
    return `${RENAME_CLEANUP_ANALYSIS_CSV_HEADERS.join(",")}\n`;
  }
  return stringifyCsv(rows as unknown as Array<Record<string, unknown>>);
}

export async function writeRenameCleanupAnalysisCsv(
  runtime: CliRuntime,
  options: {
    evidence: RenameCleanupAnalyzerEvidence;
    suggestion: RenameCleanupCodexSuggestion;
  },
): Promise<string> {
  const { rows } = createRenameCleanupAnalysisCsvRows(runtime, options);
  const filename = `rename-cleanup-analysis-${formatUtcFileDateTimeISO(runtime.now())}-${randomUUID().slice(0, 8)}.csv`;
  const csvPath = resolve(runtime.cwd, filename);
  await writeTextFileSafe(csvPath, stringifyRenameCleanupAnalysisCsv(rows), { overwrite: false });
  return csvPath;
}
