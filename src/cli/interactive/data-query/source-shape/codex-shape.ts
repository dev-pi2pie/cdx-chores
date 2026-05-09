import { select } from "@inquirer/prompts";

import { printLine } from "../../../actions/shared";
import {
  formatSourceShapeFlags,
  renderSuggestedSourceShape,
} from "../../../data-workflows/source-shape-flow";
import type { DataQuerySourceIntrospection } from "../../../duckdb/query";
import { suggestDataSourceShapeWithCodex } from "../../../duckdb/source-shape";
import { collectXlsxSheetSnapshot } from "../../../duckdb/xlsx-sources";
import type { CliRuntime } from "../../../types";
import { createInteractiveAnalyzerStatus } from "../../analyzer-status";
import type { InteractiveSourceShapeState } from "../types";
import { promptRequiredSourceShapeState } from "./excel-prompts";

type SheetSnapshot = Awaited<ReturnType<typeof collectXlsxSheetSnapshot>>;

export type CodexSourceShapeReviewResult =
  | { kind: "accepted"; sourceShape: InteractiveSourceShapeState }
  | { kind: "retry-current" }
  | { kind: "return-current" };

export async function collectCodexSourceShapeReview(options: {
  continuationLabel: string;
  getSheetSnapshot: () => Promise<SheetSnapshot | undefined>;
  inputPath: string;
  introspection: DataQuerySourceIntrospection;
  runtime: CliRuntime;
  selectedSource: string | undefined;
  sourceShape: InteractiveSourceShapeState;
}): Promise<CodexSourceShapeReviewResult> {
  const selectedSource = options.selectedSource?.trim();
  if (!selectedSource) {
    return { kind: "return-current" };
  }

  const status = createInteractiveAnalyzerStatus(
    options.runtime.stdout,
    options.runtime.colorEnabled,
  );
  let suggestionResult;
  try {
    status.start("Inspecting worksheet structure");
    const sheetSnapshot =
      (await options.getSheetSnapshot()) ??
      (await collectXlsxSheetSnapshot(options.inputPath, selectedSource));
    status.wait("Waiting for Codex source-shape suggestions");
    suggestionResult = await suggestDataSourceShapeWithCodex({
      context: {
        currentIntrospection: options.introspection,
        sheetSnapshot,
      },
      currentHeaderRow: options.sourceShape.selectedHeaderRow,
      currentBodyStartRow: options.sourceShape.selectedBodyStartRow,
      currentRange: options.sourceShape.selectedRange,
      workingDirectory: options.runtime.cwd,
    });
  } finally {
    status.stop();
  }

  if (
    suggestionResult.errorMessage ||
    !suggestionResult.shape ||
    !suggestionResult.reasoningSummary
  ) {
    printLine(
      options.runtime.stderr,
      `Codex source-shape suggestion failed: ${suggestionResult.errorMessage ?? "Codex did not return a valid source shape."}`,
    );
    printLine(options.runtime.stderr, "Keeping current source shape.");
    return { kind: "retry-current" };
  }

  renderSuggestedSourceShape(options.runtime, {
    bodyStartRow: suggestionResult.shape.bodyStartRow,
    headerRow: suggestionResult.shape.headerRow,
    range: suggestionResult.shape.range,
    reasoningSummary: suggestionResult.reasoningSummary,
    stream: "stderr",
  });

  const reviewAction = await select<"accept" | "edit" | "keep">({
    message: "Source shape review",
    choices: [
      {
        name: "Accept suggested shape",
        value: "accept",
        description: `Use the suggested shape and re-inspect before ${options.continuationLabel}`,
      },
      {
        name: "Edit manually",
        value: "edit",
        description: "Adjust the suggested range and/or header row before acceptance",
      },
      {
        name: "Keep current shape",
        value: "keep",
        description: "Ignore the suggestion and continue with the current whole-sheet shape",
      },
    ],
  });

  if (reviewAction === "keep") {
    return { kind: "return-current" };
  }

  const sourceShape =
    reviewAction === "edit"
      ? await promptRequiredSourceShapeState({
          bodyStartRow: suggestionResult.shape.bodyStartRow,
          headerRow: suggestionResult.shape.headerRow,
          range: suggestionResult.shape.range,
        })
      : {
          ...(suggestionResult.shape.bodyStartRow !== undefined
            ? { selectedBodyStartRow: suggestionResult.shape.bodyStartRow }
            : {}),
          ...(suggestionResult.shape.headerRow !== undefined
            ? { selectedHeaderRow: suggestionResult.shape.headerRow }
            : {}),
          ...(suggestionResult.shape.range ? { selectedRange: suggestionResult.shape.range } : {}),
        };

  printLine(
    options.runtime.stderr,
    `Accepted source shape: ${formatSourceShapeFlags({
      bodyStartRow: sourceShape.selectedBodyStartRow,
      headerRow: sourceShape.selectedHeaderRow,
      range: sourceShape.selectedRange,
    })}`,
  );
  printLine(
    options.runtime.stderr,
    `Re-inspecting shaped source before ${options.continuationLabel}.`,
  );
  return { kind: "accepted", sourceShape };
}
