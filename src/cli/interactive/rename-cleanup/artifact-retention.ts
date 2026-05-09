import { rm } from "node:fs/promises";

import { confirm } from "@inquirer/prompts";

import { displayPath, printLine } from "../../actions/shared";
import type { CliRuntime } from "../../types";

async function reviewCleanupArtifacts(
  runtime: CliRuntime,
  options: {
    planCsvPath: string;
    analysisReportPath?: string;
    planPromptMessage: string;
    planPromptDefault: boolean;
  },
): Promise<void> {
  const keepPlanCsv = await confirm({
    message: options.planPromptMessage,
    default: options.planPromptDefault,
  });
  const keepAnalysisReportCsv = options.analysisReportPath
    ? await confirm({
        message: "Keep cleanup analysis report CSV?",
        default: true,
      })
    : true;

  if (!keepPlanCsv) {
    await rm(options.planCsvPath, { force: true });
    printLine(
      runtime.stdout,
      `Cleanup plan CSV removed: ${displayPath(runtime, options.planCsvPath)}`,
    );
  }
  if (options.analysisReportPath && !keepAnalysisReportCsv) {
    await rm(options.analysisReportPath, { force: true });
    printLine(
      runtime.stdout,
      `Cleanup analysis report removed: ${displayPath(runtime, options.analysisReportPath)}`,
    );
  }
}

export async function reviewCleanupDryRunArtifacts(
  runtime: CliRuntime,
  options: {
    planCsvPath: string;
    analysisReportPath?: string;
  },
): Promise<void> {
  await reviewCleanupArtifacts(runtime, {
    ...options,
    planPromptMessage: "Keep dry-run plan CSV for later `rename apply`?",
    planPromptDefault: true,
  });
}

export async function reviewCleanupAppliedArtifacts(
  runtime: CliRuntime,
  options: {
    planCsvPath: string;
    analysisReportPath?: string;
  },
): Promise<void> {
  await reviewCleanupArtifacts(runtime, {
    ...options,
    planPromptMessage: "Keep applied plan CSV?",
    planPromptDefault: false,
  });
}
