import { readdir, rm } from "node:fs/promises";
import { readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const RENAME_PLAN_CSV_PATTERN = /^rename-\d{8}-\d{6}-[a-f0-9]{8}\.csv$/;
const REPO_ROOT = resolve(import.meta.dir, "../..");

function matchRenamePlanCsvName(name: string): boolean {
  return RENAME_PLAN_CSV_PATTERN.test(name);
}

export async function captureRenamePlanCsvSnapshot(): Promise<Set<string>> {
  const entries = await readdir(REPO_ROOT, { withFileTypes: true });
  return new Set(
    entries
      .filter((entry) => entry.isFile() && matchRenamePlanCsvName(entry.name))
      .map((entry) => join(REPO_ROOT, entry.name)),
  );
}

export async function cleanupRenamePlanCsvSinceSnapshot(snapshot: Set<string>): Promise<void> {
  const current = await captureRenamePlanCsvSnapshot();
  for (const path of current) {
    if (!snapshot.has(path)) {
      await rm(path, { force: true });
    }
  }
}

export function captureRenamePlanCsvSnapshotSync(): Set<string> {
  const entries = readdirSync(REPO_ROOT, { withFileTypes: true });
  return new Set(
    entries
      .filter((entry) => entry.isFile() && matchRenamePlanCsvName(entry.name))
      .map((entry) => join(REPO_ROOT, entry.name)),
  );
}

export function cleanupRenamePlanCsvSinceSnapshotSync(snapshot: Set<string>): void {
  const current = captureRenamePlanCsvSnapshotSync();
  for (const path of current) {
    if (!snapshot.has(path)) {
      rmSync(path, { force: true });
    }
  }
}
