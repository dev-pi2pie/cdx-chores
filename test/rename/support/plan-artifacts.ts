import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const RENAME_PLAN_CSV_PATTERN = /^rename-plan-\d{8}T\d{6}Z-[a-f0-9]{8}\.csv$/;

// The caller must supply its allocated fixture workspace, never a shared root.
export function captureRenamePlanCsvSnapshotSync(workspace: string): Set<string> {
  return new Set(
    readdirSync(workspace, { withFileTypes: true })
      .filter((entry) => entry.isFile() && RENAME_PLAN_CSV_PATTERN.test(entry.name))
      .map((entry) => join(workspace, entry.name)),
  );
}

export function cleanupRenamePlanCsvSinceSnapshotSync(
  workspace: string,
  snapshot: Set<string>,
): void {
  for (const path of captureRenamePlanCsvSnapshotSync(workspace)) {
    if (!snapshot.has(path)) rmSync(path, { force: true });
  }
}
