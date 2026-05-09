import type { DuckDBConnection } from "@duckdb/node-api";
import { select } from "@inquirer/prompts";

import { printLine } from "../../../actions/shared";
import {
  collectDataQuerySourceIntrospection,
  type DataQueryInputFormat,
  type DataQuerySourceIntrospection,
} from "../../../duckdb/query";
import { formatSourceShapeFlags } from "../../../data-workflows/source-shape-flow";
import { collectXlsxSheetSnapshot } from "../../../duckdb/xlsx-sources";
import type { CliRuntime } from "../../../types";
import type { InteractiveContinuationLabels, InteractiveSourceShapeState } from "../types";
import { QUERY_CONTINUATION_LABELS } from "../types";
import { collectCodexSourceShapeReview } from "./codex-shape";
import { promptOptionalExcelRange, promptRequiredExcelRange } from "./excel-prompts";
import { renderIntrospectionSummary } from "./introspection-rendering";
import { describeSuspiciousExcelIntrospection } from "./suspicion";

const DATA_QUERY_INTERACTIVE_SAMPLE_ROWS = 5;

export { renderIntrospectionSummary } from "./introspection-rendering";

export async function collectInteractiveIntrospection(options: {
  connection: DuckDBConnection;
  format: DataQueryInputFormat;
  initialNoHeader?: boolean;
  inputPath: string;
  labels?: InteractiveContinuationLabels;
  runtime: CliRuntime;
  selectedSource?: string;
}): Promise<{
  introspection: DataQuerySourceIntrospection;
  sourceShape: InteractiveSourceShapeState;
}> {
  const labels = options.labels ?? QUERY_CONTINUATION_LABELS;
  let sourceShape: InteractiveSourceShapeState = options.initialNoHeader
    ? { selectedNoHeader: true }
    : {};
  let cachedSheetSnapshot: Awaited<ReturnType<typeof collectXlsxSheetSnapshot>> | undefined;

  const getSheetSnapshot = async (): Promise<
    Awaited<ReturnType<typeof collectXlsxSheetSnapshot>> | undefined
  > => {
    const selectedSource = options.selectedSource?.trim();
    if (!selectedSource) {
      return undefined;
    }
    cachedSheetSnapshot ??= await collectXlsxSheetSnapshot(options.inputPath, selectedSource);
    return cachedSheetSnapshot;
  };

  if (options.format === "excel") {
    printLine(options.runtime.stderr, "");
    printLine(
      options.runtime.stderr,
      `This step changes how the source is interpreted as a table. You are not writing ${labels.notWritingLabel}.`,
    );
    const selectedRange = await promptOptionalExcelRange();
    sourceShape = selectedRange ? { selectedRange } : {};
  }

  while (true) {
    const introspection = await collectDataQuerySourceIntrospection(
      options.connection,
      options.inputPath,
      options.format,
      {
        bodyStartRow: sourceShape.selectedBodyStartRow,
        headerRow: sourceShape.selectedHeaderRow,
        noHeader: sourceShape.selectedNoHeader,
        range: sourceShape.selectedRange,
        source: options.selectedSource,
      },
      DATA_QUERY_INTERACTIVE_SAMPLE_ROWS,
    );

    renderIntrospectionSummary(options.runtime, {
      format: options.format,
      inputPath: options.inputPath,
      introspection,
    });

    if (options.format !== "excel") {
      return { introspection, sourceShape };
    }

    const sheetSnapshot = introspection.columns.length === 1 ? await getSheetSnapshot() : undefined;
    const warningReasons = describeSuspiciousExcelIntrospection(introspection, {
      mergedRangeCount: sheetSnapshot?.mergedRanges.length,
      usedRange: sheetSnapshot?.usedRange,
    });
    if (!warningReasons) {
      return { introspection, sourceShape };
    }

    printLine(options.runtime.stderr, "");
    printLine(
      options.runtime.stderr,
      "Sheet shape warning: current Excel sheet shape looks suspicious.",
    );
    printLine(
      options.runtime.stderr,
      `This step changes how the source is interpreted as a table. You are not writing ${labels.notWritingLabel}.`,
    );
    for (const reason of warningReasons) {
      printLine(options.runtime.stderr, `- ${reason}`);
    }

    const nextStep = await select<"continue" | "range" | "suggest">({
      message: "Choose how to continue",
      choices: [
        {
          name: "continue as-is",
          value: "continue",
          description: `Keep the current source shape and move on to ${labels.continuationLabel}`,
        },
        {
          name: "enter range manually",
          value: "range",
          description: `Adjust the source shape manually before ${labels.continuationLabel}`,
        },
        {
          name: "ask Codex to suggest shaping",
          value: "suggest",
          description: "Ask Codex to suggest an explicit range and/or header row before continuing",
        },
      ],
    });

    if (nextStep === "continue") {
      return { introspection, sourceShape };
    }

    if (nextStep === "range") {
      sourceShape = {
        selectedRange: await promptRequiredExcelRange(),
      };
      printLine(
        options.runtime.stderr,
        `Accepted source shape: ${formatSourceShapeFlags({
          range: sourceShape.selectedRange,
        })}`,
      );
      printLine(
        options.runtime.stderr,
        `Re-inspecting shaped source before ${labels.continuationLabel}.`,
      );
      continue;
    }

    const suggestionReview = await collectCodexSourceShapeReview({
      continuationLabel: labels.continuationLabel,
      getSheetSnapshot,
      inputPath: options.inputPath,
      introspection,
      runtime: options.runtime,
      selectedSource: options.selectedSource,
      sourceShape,
    });
    if (suggestionReview.kind === "return-current") {
      return { introspection, sourceShape };
    }
    if (suggestionReview.kind === "retry-current") {
      continue;
    }
    sourceShape = suggestionReview.sourceShape;
  }
}
