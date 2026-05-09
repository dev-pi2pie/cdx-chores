import { confirm, select } from "@inquirer/prompts";

import { displayPath, printLine } from "../../../actions/shared";
import { resolveFromCwd } from "../../../path-utils";
import type { CliRuntime } from "../../../types";
import type { InteractiveExtractReviewOutcome } from "./types";

export function renderSkippedInteractiveExtractWrite(runtime: CliRuntime): void {
  printLine(runtime.stderr, "Skipped extraction write.");
}

function renderInteractiveExtractReviewSummary(
  runtime: CliRuntime,
  options: {
    headerMappingCount: number;
    inputPath: string;
    selectedBodyStartRow?: number;
    selectedHeaderRow?: number;
    selectedNoHeader?: boolean;
    selectedRange?: string;
    selectedSource?: string;
  },
): void {
  printLine(runtime.stderr, "Extraction review");
  printLine(runtime.stderr, "");
  printLine(
    runtime.stderr,
    `- input: ${displayPath(runtime, resolveFromCwd(runtime, options.inputPath))}`,
  );
  if (options.selectedSource) {
    printLine(runtime.stderr, `- source: ${options.selectedSource}`);
  }
  if (options.selectedRange) {
    printLine(runtime.stderr, `- range: ${options.selectedRange}`);
  }
  if (options.selectedNoHeader) {
    printLine(runtime.stderr, "- header mode: treat CSV/TSV input as headerless");
  }
  if (options.selectedBodyStartRow !== undefined) {
    printLine(runtime.stderr, `- body start row: ${options.selectedBodyStartRow}`);
  }
  if (options.selectedHeaderRow !== undefined) {
    printLine(runtime.stderr, `- header row: ${options.selectedHeaderRow}`);
  }
  printLine(
    runtime.stderr,
    `- headers: ${
      options.headerMappingCount > 0
        ? `${options.headerMappingCount} reviewed semantic mapping${options.headerMappingCount === 1 ? "" : "s"}`
        : "keep current column names"
    }`,
  );
  printLine(runtime.stderr, "- output setup: choose format and destination next");
}

export async function confirmInteractiveExtractReview(
  runtime: CliRuntime,
  options: {
    headerMappingCount: number;
    inputPath: string;
    selectedBodyStartRow?: number;
    selectedHeaderRow?: number;
    selectedNoHeader?: boolean;
    selectedRange?: string;
    selectedSource?: string;
  },
): Promise<InteractiveExtractReviewOutcome> {
  renderInteractiveExtractReviewSummary(runtime, options);
  const confirmed = await confirm({ message: "Continue to output setup?", default: true });
  if (confirmed) {
    return "continue";
  }

  return await select<"revise" | "cancel">({
    message: "Extraction review next step",
    choices: [
      {
        name: "Revise extraction setup",
        value: "revise",
        description: "Revisit source interpretation and semantic header review",
      },
      {
        name: "Cancel",
        value: "cancel",
        description: "Stop before choosing an output destination",
      },
    ],
  });
}
