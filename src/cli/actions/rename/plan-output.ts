import { basename, extname } from "node:path";

import { slugifyName } from "../../../utils/slug";
import { createRenamePlanCsvRows, writeRenamePlanCsv } from "../../rename-plan-csv";
import {
  rewriteTimestampPlaceholder,
  templateContainsLegacyTimestamp,
  type TimestampTimezone,
} from "../../rename-template";
import type { CliRuntime, PlannedRename } from "../../types";

type RenameSkippedItem = {
  path: string;
  reason: string;
};

export function resolveEffectivePattern(
  pattern: string | undefined,
  timestampTimezone: TimestampTimezone | undefined,
): string | undefined {
  if (timestampTimezone === undefined) {
    return pattern;
  }
  if (pattern !== undefined && !templateContainsLegacyTimestamp(pattern)) {
    return pattern;
  }
  const target = pattern ?? "{prefix}-{timestamp}-{stem}";
  return rewriteTimestampPlaceholder(target, timestampTimezone);
}

export function deriveTimestampTzMetadata(pattern: string | undefined): string {
  const p = pattern ?? "{prefix}-{timestamp}-{stem}";
  const hasLocal = /\{\s*timestamp_local(?:_(?:iso|12h))?\s*\}/.test(p);
  const hasUtc = /\{\s*(?:timestamp|timestamp_utc(?:_(?:iso|12h))?)\s*\}/.test(p);
  if (hasLocal && hasUtc) return "";
  if (hasLocal) return "local";
  if (hasUtc) return "utc";
  return "";
}

export async function writeBatchRenameDryRunPlanCsv(
  runtime: CliRuntime,
  options: {
    plans: PlannedRename[];
    skippedItems: RenameSkippedItem[];
    codexTitlesByPath?: Map<string, string>;
    reasonBySourcePath: Map<string, string>;
    effectivePattern: string | undefined;
  },
): Promise<string> {
  const cleanedStemBySourcePath = new Map<string, string>();
  for (const plan of options.plans) {
    const ext = extname(plan.fromPath);
    const stem = basename(plan.fromPath, ext);
    const sourceTitle = options.codexTitlesByPath?.get(plan.fromPath) ?? stem;
    cleanedStemBySourcePath.set(plan.fromPath, slugifyName(sourceTitle).slice(0, 48));
  }

  const { rows } = createRenamePlanCsvRows({
    runtime,
    plans: options.plans,
    cleanedStemBySourcePath,
    aiNameBySourcePath: options.codexTitlesByPath,
    reasonBySourcePath: options.reasonBySourcePath,
    skippedItems: options.skippedItems,
    aiProvider: "codex",
    aiModel: "auto",
    timestampTz: deriveTimestampTzMetadata(options.effectivePattern),
  });

  return writeRenamePlanCsv(runtime, rows);
}

export async function writeSingleRenameDryRunPlanCsv(
  runtime: CliRuntime,
  options: {
    plan: PlannedRename;
    codexTitlesByPath: Map<string, string>;
    reasonBySourcePath: Map<string, string>;
    effectivePattern: string | undefined;
  },
): Promise<string> {
  const ext = extname(options.plan.fromPath);
  const stem = basename(options.plan.fromPath, ext);
  const sourceTitle = options.codexTitlesByPath.get(options.plan.fromPath) ?? stem;
  const cleanedStemBySourcePath = new Map<string, string>([
    [options.plan.fromPath, slugifyName(sourceTitle).slice(0, 48)],
  ]);
  const { rows } = createRenamePlanCsvRows({
    runtime,
    plans: [options.plan],
    cleanedStemBySourcePath,
    aiNameBySourcePath: options.codexTitlesByPath.size > 0 ? options.codexTitlesByPath : undefined,
    reasonBySourcePath: options.reasonBySourcePath,
    aiProvider: "codex",
    aiModel: "auto",
    timestampTz: deriveTimestampTzMetadata(options.effectivePattern),
  });

  return writeRenamePlanCsv(runtime, rows);
}
