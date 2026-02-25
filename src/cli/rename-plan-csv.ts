import { randomUUID } from "node:crypto";
import { basename, isAbsolute, relative, resolve } from "node:path";

import { csvRowsToObjects, parseCsv, stringifyCsv } from "../utils/csv";
import { formatUtcFileDateTime } from "../utils/datetime";
import { CliError } from "./errors";
import { applyPlannedRenames, readTextFileRequired, writeTextFileSafe } from "./fs-utils";
import type { CliRuntime, PlannedRename, SkippedRenameItem } from "./types";

export const RENAME_PLAN_CSV_HEADERS = [
  "old_name",
  "new_name",
  "cleaned_stem",
  "ai_new_name",
  "ai_provider",
  "ai_model",
  "changed_at",
  "old_path",
  "new_path",
  "plan_id",
  "planned_at",
  "applied_at",
  "status",
  "reason",
] as const;

export type RenamePlanCsvStatus = "planned" | "skipped" | "applied" | "failed";

export interface RenamePlanCsvRow {
  old_name: string;
  new_name: string;
  cleaned_stem: string;
  ai_new_name: string;
  ai_provider: string;
  ai_model: string;
  changed_at: string;
  old_path: string;
  new_path: string;
  plan_id: string;
  planned_at: string;
  applied_at: string;
  status: RenamePlanCsvStatus;
  reason: string;
}

function toRelativePathFromCwd(cwd: string, absolutePath: string): string {
  const next = relative(cwd, absolutePath);
  if (!next || next.startsWith("..")) {
    throw new CliError(`Rename plan path escaped current working directory: ${absolutePath}`, {
      code: "INVALID_RENAME_PLAN",
      exitCode: 2,
    });
  }
  return next;
}

function assertPathWithinCwd(cwd: string, pathValue: string, label: string): string {
  const trimmed = pathValue.trim();
  if (!trimmed) {
    throw new CliError(`Rename plan CSV missing required field: ${label}`, {
      code: "INVALID_RENAME_PLAN",
      exitCode: 2,
    });
  }

  if (isAbsolute(trimmed)) {
    throw new CliError(`Rename plan ${label} must be cwd-relative: ${trimmed}`, {
      code: "INVALID_RENAME_PLAN",
      exitCode: 2,
    });
  }

  const resolved = resolve(cwd, trimmed);
  const back = relative(cwd, resolved);
  if (!back || back.startsWith("..")) {
    throw new CliError(`Rename plan ${label} escaped current working directory: ${trimmed}`, {
      code: "INVALID_RENAME_PLAN",
      exitCode: 2,
    });
  }
  return resolved;
}

function stringifyRenamePlanCsv(rows: RenamePlanCsvRow[]): string {
  if (rows.length === 0) {
    return `${RENAME_PLAN_CSV_HEADERS.join(",")}\n`;
  }
  return stringifyCsv(rows as unknown as Array<Record<string, unknown>>);
}

export function createRenamePlanCsvRows(options: {
  runtime: CliRuntime;
  plans: PlannedRename[];
  cleanedStemBySourcePath?: Map<string, string>;
  aiNameBySourcePath?: Map<string, string>;
  reasonBySourcePath?: Map<string, string>;
  skippedItems?: SkippedRenameItem[];
  aiProvider?: string;
  aiModel?: string;
}): { rows: RenamePlanCsvRow[]; planId: string; plannedAt: string } {
  const plannedAt = options.runtime.now().toISOString();
  const planId = `${formatUtcFileDateTime(options.runtime.now())}-${randomUUID().slice(0, 8)}`;

  const rows = options.plans.map((plan) => {
    const aiNewName = options.aiNameBySourcePath?.get(plan.fromPath) ?? "";
    const changed = plan.changed;
    return {
      old_name: basename(plan.fromPath),
      new_name: basename(plan.toPath),
      cleaned_stem: options.cleanedStemBySourcePath?.get(plan.fromPath) ?? "",
      ai_new_name: aiNewName,
      ai_provider: aiNewName ? (options.aiProvider ?? "codex") : "",
      ai_model: aiNewName ? (options.aiModel ?? "auto") : "",
      changed_at: "",
      old_path: toRelativePathFromCwd(options.runtime.cwd, plan.fromPath),
      new_path: toRelativePathFromCwd(options.runtime.cwd, plan.toPath),
      plan_id: planId,
      planned_at: plannedAt,
      applied_at: "",
      status: changed ? "planned" : "skipped",
      reason: options.reasonBySourcePath?.get(plan.fromPath) ?? (changed ? "" : "unchanged"),
    } satisfies RenamePlanCsvRow;
  });

  const skippedRows = (options.skippedItems ?? []).map((item) => {
    const oldName = basename(item.path);
    return {
      old_name: oldName,
      new_name: oldName,
      cleaned_stem: "",
      ai_new_name: "",
      ai_provider: "",
      ai_model: "",
      changed_at: "",
      old_path: toRelativePathFromCwd(options.runtime.cwd, item.path),
      new_path: toRelativePathFromCwd(options.runtime.cwd, item.path),
      plan_id: planId,
      planned_at: plannedAt,
      applied_at: "",
      status: "skipped" as const,
      reason: item.reason,
    } satisfies RenamePlanCsvRow;
  });

  return { rows: [...rows, ...skippedRows], planId, plannedAt };
}

export async function writeRenamePlanCsv(runtime: CliRuntime, rows: RenamePlanCsvRow[]): Promise<string> {
  const filename = `rename-${formatUtcFileDateTime(runtime.now())}-${randomUUID().slice(0, 8)}.csv`;
  const csvPath = resolve(runtime.cwd, filename);
  await writeTextFileSafe(csvPath, stringifyRenamePlanCsv(rows), { overwrite: false });
  return csvPath;
}

export async function readRenamePlanCsv(
  runtime: CliRuntime,
  csvPathInput: string,
): Promise<{ csvPath: string; rows: RenamePlanCsvRow[] }> {
  const csvPath = resolve(runtime.cwd, csvPathInput);
  const text = await readTextFileRequired(csvPath);
  const records = csvRowsToObjects(parseCsv(text));

  const rows = records.map((record) => {
    const statusValue = (record.status || "planned").trim();
    if (!["planned", "skipped", "applied", "failed"].includes(statusValue)) {
      throw new CliError(`Invalid rename plan status '${statusValue}' in CSV`, {
        code: "INVALID_RENAME_PLAN",
        exitCode: 2,
      });
    }

    return {
      old_name: (record.old_name ?? "").trim(),
      new_name: (record.new_name ?? "").trim(),
      cleaned_stem: (record.cleaned_stem ?? "").trim(),
      ai_new_name: (record.ai_new_name ?? "").trim(),
      ai_provider: (record.ai_provider ?? "").trim(),
      ai_model: (record.ai_model ?? "").trim(),
      changed_at: (record.changed_at ?? "").trim(),
      old_path: (record.old_path ?? "").trim(),
      new_path: (record.new_path ?? "").trim(),
      plan_id: (record.plan_id ?? "").trim(),
      planned_at: (record.planned_at ?? "").trim(),
      applied_at: (record.applied_at ?? "").trim(),
      status: statusValue as RenamePlanCsvStatus,
      reason: (record.reason ?? "").trim(),
    } satisfies RenamePlanCsvRow;
  });

  return { csvPath, rows };
}

export async function applyRenamePlanCsv(
  runtime: CliRuntime,
  csvPathInput: string,
): Promise<{
  csvPath: string;
  totalRows: number;
  appliedCount: number;
  skippedCount: number;
}> {
  const { csvPath, rows } = await readRenamePlanCsv(runtime, csvPathInput);

  const executableRows = rows.filter((row) => row.status === "planned");
  const plans: PlannedRename[] = executableRows.map((row) => {
    const fromPath = assertPathWithinCwd(runtime.cwd, row.old_path, "old_path");
    const toPath = assertPathWithinCwd(runtime.cwd, row.new_path, "new_path");
    return {
      fromPath,
      toPath,
      changed: fromPath !== toPath,
    };
  });

  await applyPlannedRenames(plans);

  const appliedAt = runtime.now().toISOString();
  const updatedRows = rows.map((row) => {
    if (row.status !== "planned") {
      return row;
    }
    return {
      ...row,
      status: "applied" as const,
      applied_at: appliedAt,
      changed_at: appliedAt,
      reason: row.reason,
    };
  });
  await writeTextFileSafe(csvPath, stringifyRenamePlanCsv(updatedRows), { overwrite: true });

  return {
    csvPath,
    totalRows: rows.length,
    appliedCount: executableRows.length,
    skippedCount: rows.filter((row) => row.status !== "planned").length,
  };
}
