import { rm } from "node:fs/promises";

import { applyRenamePlanCsv } from "../../rename-plan-csv";
import type { CliRuntime } from "../../types";
import { assertNonEmpty } from "../shared";
import { printRenameApplyResult } from "./reporting";

export interface RenameApplyOptions {
  csv: string;
  autoClean?: boolean;
}

export async function actionRenameApply(
  runtime: CliRuntime,
  options: RenameApplyOptions,
): Promise<{ csvPath: string; appliedCount: number; totalRows: number; skippedCount: number }> {
  const csv = assertNonEmpty(options.csv, "Rename plan CSV path");
  const result = await applyRenamePlanCsv(runtime, csv);

  await printRenameApplyResult(runtime, {
    csvPath: result.csvPath,
    totalRows: result.totalRows,
    appliedCount: result.appliedCount,
    skippedCount: result.skippedCount,
    autoClean: options.autoClean ?? false,
    removeCsv: async (path) => {
      await rm(path, { force: true });
    },
  });

  return result;
}
