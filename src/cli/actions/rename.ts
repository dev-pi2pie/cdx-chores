import { basename } from "node:path";

import { applyPlannedRenames, planBatchRename } from "../fs-utils";
import type { CliRuntime, PlannedRename } from "../types";
import { assertNonEmpty, displayPath, printLine } from "./shared";

function formatRenamePreviewLine(plan: PlannedRename): string {
  const fromName = basename(plan.fromPath);
  const toName = basename(plan.toPath);
  return plan.changed ? `- ${fromName} -> ${toName}` : `- ${fromName} (unchanged)`;
}

export interface RenameBatchOptions {
  directory: string;
  prefix?: string;
  dryRun?: boolean;
}

export async function actionRenameBatch(
  runtime: CliRuntime,
  options: RenameBatchOptions,
): Promise<{ changedCount: number; totalCount: number; directoryPath: string }> {
  const directory = assertNonEmpty(options.directory, "Directory path");
  const { directoryPath, plans } = await planBatchRename(runtime, directory, {
    prefix: options.prefix,
    now: runtime.now(),
  });

  const totalCount = plans.length;
  const changedCount = plans.filter((plan) => plan.changed).length;

  printLine(runtime.stdout, `Directory: ${displayPath(runtime, directoryPath)}`);
  printLine(runtime.stdout, `Files found: ${totalCount}`);
  printLine(runtime.stdout, `Files to rename: ${changedCount}`);
  printLine(runtime.stdout);

  for (const plan of plans) {
    printLine(runtime.stdout, formatRenamePreviewLine(plan));
  }

  if (options.dryRun ?? false) {
    printLine(runtime.stdout);
    printLine(runtime.stdout, "Dry run only. No files were renamed.");
    return { changedCount, totalCount, directoryPath };
  }

  await applyPlannedRenames(plans);
  printLine(runtime.stdout);
  printLine(runtime.stdout, `Renamed ${changedCount} file(s).`);

  return { changedCount, totalCount, directoryPath };
}

