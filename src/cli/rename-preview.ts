import { basename } from "node:path";

import { appendAll } from "../utils";
import { formatPathForDisplay } from "./fs-utils";
import type { CliRuntime, PlannedRename, SkippedRenameItem } from "./types";

export interface RenamePreviewTruncation {
  totalCount: number;
  headCount: number;
  tailCount: number;
  omittedCount: number;
}

export interface RenamePreviewRenameRow {
  kind: "rename";
  plan: PlannedRename;
  line: string;
}

export interface RenamePreviewSkippedSummaryRow {
  kind: "skipped-summary";
  reason: string;
  count: number;
  line: string;
}

export interface RenamePreviewSkippedDetailRow {
  kind: "skipped-detail";
  item: SkippedRenameItem;
  line: string;
}

export interface RenameBatchPreviewData {
  renameRows: RenamePreviewRenameRow[];
  skippedSummaryRows: RenamePreviewSkippedSummaryRow[];
  skippedDetailRows: RenamePreviewSkippedDetailRow[];
  fullLines: string[];
  truncation?: RenamePreviewTruncation;
}

export interface HeadTailSlice<T> {
  head: T[];
  tail: T[];
  omittedCount: number;
  totalCount: number;
  truncated: boolean;
}

export function formatPlannedRenamePreviewLine(plan: PlannedRename): string {
  const fromName = basename(plan.fromPath);
  const toName = basename(plan.toPath);
  return plan.changed ? `- ${fromName} -> ${toName}` : `- ${fromName} (unchanged)`;
}

export function formatSkippedRenamePreviewLine(runtime: CliRuntime, item: SkippedRenameItem): string {
  return `- ${formatPathForDisplay(runtime, item.path)} (skipped: ${item.reason})`;
}

export function summarizeSkippedRenameItems(
  items: readonly SkippedRenameItem[],
): RenamePreviewSkippedSummaryRow[] {
  const countsByReason = new Map<string, number>();
  for (const item of items) {
    countsByReason.set(item.reason, (countsByReason.get(item.reason) ?? 0) + 1);
  }

  return [...countsByReason.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .map(([reason, count]) => ({
      kind: "skipped-summary" as const,
      reason,
      count,
      line: `- ${count} ${reason}`,
    }));
}

export function buildHeadTailSlice<T>(
  items: readonly T[],
  options: {
    headCount: number;
    tailCount: number;
  },
): HeadTailSlice<T> {
  const totalCount = items.length;
  const headCount = Math.max(0, options.headCount);
  const tailCount = Math.max(0, options.tailCount);
  const visibleCount = headCount + tailCount;

  if (totalCount <= visibleCount) {
    return {
      head: [...items],
      tail: [],
      omittedCount: 0,
      totalCount,
      truncated: false,
    };
  }

  const head = items.slice(0, headCount);
  const tail = tailCount > 0 ? items.slice(-tailCount) : [];
  return {
    head,
    tail,
    omittedCount: Math.max(0, totalCount - head.length - tail.length),
    totalCount,
    truncated: true,
  };
}

export function composeRenameBatchPreviewData(
  runtime: CliRuntime,
  options: {
    plans: readonly PlannedRename[];
    skipped: readonly SkippedRenameItem[];
  },
): RenameBatchPreviewData {
  const renameRows = options.plans.map((plan) => ({
    kind: "rename" as const,
    plan,
    line: formatPlannedRenamePreviewLine(plan),
  }));
  const skippedSummaryRows = summarizeSkippedRenameItems(options.skipped);
  const skippedDetailRows = options.skipped.map((item) => ({
    kind: "skipped-detail" as const,
    item,
    line: formatSkippedRenamePreviewLine(runtime, item),
  }));

  const fullLines: string[] = [];
  appendAll(
    fullLines,
    renameRows.map((row) => row.line),
  );
  appendAll(
    fullLines,
    skippedDetailRows.map((row) => row.line),
  );

  return {
    renameRows,
    skippedSummaryRows,
    skippedDetailRows,
    fullLines,
  };
}
