import {
  composeCompactRenameBatchPreviewData,
  composeDetailedSkippedPreviewData,
  composeRenameBatchPreviewData,
  formatPlannedRenamePreviewLine,
} from "../../rename-preview";
import type { CliRuntime, PlannedRename } from "../../types";
import { displayPath, printLine } from "../shared";

type RenameSkippedItem = {
  path: string;
  reason: string;
};

export function printRenameBatchPreview(
  runtime: CliRuntime,
  options: {
    plans: PlannedRename[];
    skipped: RenameSkippedItem[];
    previewSkips: "summary" | "detailed";
    dryRun: boolean;
  },
): { truncated: boolean } {
  if (options.dryRun) {
    const previewData = composeCompactRenameBatchPreviewData(runtime, {
      plans: options.plans,
      skipped: options.skipped,
    });

    if (previewData.truncation) {
      printLine(
        runtime.stdout,
        `Renames: showing first ${previewData.truncation.headCount} and last ${previewData.truncation.tailCount} of ${previewData.truncation.totalCount} rows; ${previewData.truncation.omittedCount} omitted from the middle.`,
      );
    } else if (previewData.renameLines.length > 0) {
      printLine(runtime.stdout, "Renames:");
    }

    for (const line of previewData.renameLines) {
      printLine(runtime.stdout, line);
    }

    if (previewData.skippedSummaryLines.length > 0) {
      if (previewData.renameLines.length > 0 || previewData.truncation) {
        printLine(runtime.stdout);
      }
      printLine(runtime.stdout, "Skipped summary:");
      for (const line of previewData.skippedSummaryLines) {
        printLine(runtime.stdout, line);
      }

      if (options.previewSkips === "detailed") {
        const skippedPreview = composeDetailedSkippedPreviewData(runtime, {
          skipped: options.skipped,
        });
        printLine(runtime.stdout);
        if (skippedPreview.truncation) {
          printLine(
            runtime.stdout,
            `Skipped: showing first ${skippedPreview.truncation.headCount} and last ${skippedPreview.truncation.tailCount} of ${skippedPreview.truncation.totalCount} rows; ${skippedPreview.truncation.omittedCount} omitted from the middle.`,
          );
        } else {
          printLine(runtime.stdout, "Skipped details:");
        }
        for (const line of skippedPreview.skippedLines) {
          printLine(runtime.stdout, line);
        }
      }
    }

    return { truncated: Boolean(previewData.truncation) };
  }

  const previewData = composeRenameBatchPreviewData(runtime, {
    plans: options.plans,
    skipped: options.skipped,
  });
  for (const line of previewData.fullLines) {
    printLine(runtime.stdout, line);
  }

  return { truncated: false };
}

export function printRenameBatchDryRunFooter(
  runtime: CliRuntime,
  options: {
    planCsvPath: string;
    truncated: boolean;
  },
): void {
  printLine(runtime.stdout);
  if (options.truncated) {
    printLine(runtime.stdout, "Full review: use the generated plan CSV for the complete rename list.");
  }
  printLine(runtime.stdout, `Plan CSV: ${displayPath(runtime, options.planCsvPath)}`);
  printLine(runtime.stdout, "Dry run only. No files were renamed.");
}

export function printRenameBatchApplyFooter(runtime: CliRuntime, changedCount: number): void {
  printLine(runtime.stdout);
  printLine(runtime.stdout, `Renamed ${changedCount} file(s).`);
}

export function printRenameFilePreview(runtime: CliRuntime, plan: PlannedRename): void {
  printLine(runtime.stdout);
  printLine(runtime.stdout, formatPlannedRenamePreviewLine(plan));
}

export function printRenameFileDryRunFooter(runtime: CliRuntime, planCsvPath: string): void {
  printLine(runtime.stdout);
  printLine(runtime.stdout, `Plan CSV: ${displayPath(runtime, planCsvPath)}`);
  printLine(runtime.stdout, "Dry run only. No files were renamed.");
}

export function printRenameFileApplyFooter(runtime: CliRuntime, changed: boolean): void {
  printLine(runtime.stdout);
  if (changed) {
    printLine(runtime.stdout, "Renamed 1 file(s).");
  } else {
    printLine(runtime.stdout, "No rename needed.");
  }
}

export async function printRenameApplyResult(
  runtime: CliRuntime,
  options: {
    csvPath: string;
    totalRows: number;
    appliedCount: number;
    skippedCount: number;
    autoClean: boolean;
    removeCsv: (path: string) => Promise<void>;
  },
): Promise<void> {
  printLine(runtime.stdout, `Plan CSV: ${displayPath(runtime, options.csvPath)}`);
  printLine(runtime.stdout, `Rows in plan: ${options.totalRows}`);
  printLine(runtime.stdout, `Rows applied: ${options.appliedCount}`);
  printLine(runtime.stdout, `Rows skipped: ${options.skippedCount}`);
  if (options.autoClean) {
    await options.removeCsv(options.csvPath);
    printLine(runtime.stdout, "Plan CSV auto-cleaned.");
  }
}
