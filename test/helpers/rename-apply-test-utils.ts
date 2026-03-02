import { basename } from "node:path";

export const RENAME_PLAN_HEADERS = [
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
  "timestamp_tz",
] as const;

export function createRenamePlanCsvText(
  headers: readonly string[],
  rows: Array<Record<string, string>>,
): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => row[header] ?? "").join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function createRenamePlanRow(
  oldPath: string,
  newPath: string,
  overrides: Partial<Record<(typeof RENAME_PLAN_HEADERS)[number], string>> = {},
): Record<string, string> {
  return {
    old_name: basename(oldPath),
    new_name: basename(newPath),
    cleaned_stem: "",
    ai_new_name: "",
    ai_provider: "",
    ai_model: "",
    changed_at: "",
    old_path: oldPath,
    new_path: newPath,
    plan_id: "plan-1",
    planned_at: "2026-02-25T00:00:00.000Z",
    applied_at: "",
    status: "planned",
    reason: "",
    timestamp_tz: "",
    ...overrides,
  };
}
