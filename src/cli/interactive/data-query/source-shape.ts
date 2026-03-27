import type { DuckDBConnection } from "@duckdb/node-api";
import { input, select } from "@inquirer/prompts";

import { displayPath, printLine } from "../../actions/shared";
import { getCliColors } from "../../colors";
import {
  normalizeExcelBodyStartRow,
  collectDataQuerySourceIntrospection,
  normalizeExcelHeaderRow,
  normalizeExcelRange,
  type DataQueryInputFormat,
  type DataQuerySourceIntrospection,
} from "../../duckdb/query";
import {
  formatSourceShapeFlags,
  renderSuggestedSourceShape,
} from "../../data-workflows/source-shape-flow";
import { suggestDataSourceShapeWithCodex } from "../../duckdb/source-shape";
import { collectXlsxSheetSnapshot } from "../../duckdb/xlsx-sources";
import type { CliRuntime } from "../../types";
import { createInteractiveAnalyzerStatus } from "../analyzer-status";
import type { InteractiveContinuationLabels, InteractiveSourceShapeState } from "./types";
import { QUERY_CONTINUATION_LABELS } from "./types";

const DATA_QUERY_INTERACTIVE_SAMPLE_ROWS = 5;

function describeSuspiciousExcelIntrospection(
  introspection: DataQuerySourceIntrospection,
  options: {
    mergedRangeCount?: number;
    usedRange?: string;
  } = {},
): string[] | undefined {
  const reasons: string[] = [];
  const generatedColumns = introspection.columns
    .map((column) => column.name)
    .filter((name) => /^column_\d+$/i.test(name));

  if (introspection.columns.length === 1 && introspection.sampleRows.length === 0) {
    reasons.push("Whole-sheet inspection found one visible column and no usable sample rows.");
  }

  if (generatedColumns.length >= 2 && introspection.sampleRows.length > 0) {
    const generatedCellValues = introspection.sampleRows.flatMap((row) =>
      generatedColumns.map((column) => row[column] ?? ""),
    );
    const blankGeneratedCells = generatedCellValues.filter(
      (value) => value.trim().length === 0,
    ).length;
    if (
      generatedColumns.length >= Math.ceil(introspection.columns.length / 2) &&
      blankGeneratedCells / generatedCellValues.length >= 0.7
    ) {
      reasons.push(
        "Whole-sheet inspection produced many generated placeholder columns with mostly blank sample cells.",
      );
    }
  }

  if (
    introspection.columns.length === 1 &&
    introspection.sampleRows.length > 0 &&
    (options.mergedRangeCount ?? 0) > 0
  ) {
    const onlyColumnName = introspection.columns[0]?.name ?? "";
    const match =
      typeof options.usedRange === "string" &&
      /^[A-Z]+[1-9][0-9]*:[A-Z]+[1-9][0-9]*$/i.test(options.usedRange)
        ? /^([A-Z]+)[1-9][0-9]*:([A-Z]+)[1-9][0-9]*$/i.exec(options.usedRange)
        : undefined;
    const startColumn = (match?.[1] ?? "").toUpperCase();
    const endColumn = (match?.[2] ?? "").toUpperCase();
    const hasWideUsedRange = Boolean(startColumn && endColumn && startColumn !== endColumn);
    const hasTitleLikeSingleColumnHeader =
      onlyColumnName.length >= 16 && /[_\s]/.test(onlyColumnName);
    if (hasWideUsedRange || hasTitleLikeSingleColumnHeader) {
      reasons.push(
        "Whole-sheet inspection collapsed a merged or multi-column worksheet into one visible column.",
      );
    }
  }

  return reasons.length > 0 ? reasons : undefined;
}

function validateExcelRangeInput(value: string, options: { required: boolean }): true | string {
  const trimmed = value.trim();
  if (!trimmed) {
    return options.required ? "Enter an Excel range like A1:Z99." : true;
  }

  try {
    normalizeExcelRange(trimmed);
    return true;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function promptOptionalExcelRange(defaultValue = ""): Promise<string | undefined> {
  const value = await input({
    message: "Excel range (optional, e.g. A1:Z99)",
    default: defaultValue,
    validate: (nextValue) => validateExcelRangeInput(nextValue, { required: false }),
  });

  const trimmed = value.trim();
  return trimmed.length > 0 ? normalizeExcelRange(trimmed) : undefined;
}

async function promptRequiredExcelRange(defaultValue = ""): Promise<string> {
  const value = await input({
    message: "Excel range (required, e.g. A1:Z99)",
    default: defaultValue,
    validate: (nextValue) => validateExcelRangeInput(nextValue, { required: true }),
  });

  return normalizeExcelRange(value.trim());
}

function validateExcelHeaderRowInput(value: string, options: { required: boolean }): true | string {
  const trimmed = value.trim();
  if (!trimmed) {
    return options.required ? "Enter a positive worksheet row number." : true;
  }

  const parsed = Number(trimmed);
  try {
    normalizeExcelHeaderRow(parsed);
    return true;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function promptOptionalExcelHeaderRow(defaultValue = ""): Promise<number | undefined> {
  const value = await input({
    message: "Excel header row (optional, absolute worksheet row)",
    default: defaultValue,
    validate: (nextValue) => validateExcelHeaderRowInput(nextValue, { required: false }),
  });

  const trimmed = value.trim();
  return trimmed.length > 0 ? normalizeExcelHeaderRow(Number(trimmed)) : undefined;
}

function validateExcelBodyStartRowInput(
  value: string,
  options: { required: boolean },
): true | string {
  const trimmed = value.trim();
  if (!trimmed) {
    return options.required ? "Enter a positive worksheet row number." : true;
  }

  const parsed = Number(trimmed);
  try {
    normalizeExcelBodyStartRow(parsed);
    return true;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function promptOptionalExcelBodyStartRow(defaultValue = ""): Promise<number | undefined> {
  const value = await input({
    message: "Excel body start row (optional, absolute worksheet row)",
    default: defaultValue,
    validate: (nextValue) => validateExcelBodyStartRowInput(nextValue, { required: false }),
  });

  const trimmed = value.trim();
  return trimmed.length > 0 ? normalizeExcelBodyStartRow(Number(trimmed)) : undefined;
}

async function promptRequiredSourceShapeState(
  defaultShape: {
    bodyStartRow?: number;
    headerRow?: number;
    range?: string;
  } = {},
): Promise<InteractiveSourceShapeState> {
  while (true) {
    const selectedRange = await promptOptionalExcelRange(defaultShape.range ?? "");
    const selectedBodyStartRow = await promptOptionalExcelBodyStartRow(
      defaultShape.bodyStartRow !== undefined ? String(defaultShape.bodyStartRow) : "",
    );
    const selectedHeaderRow = await promptOptionalExcelHeaderRow(
      defaultShape.headerRow !== undefined ? String(defaultShape.headerRow) : "",
    );
    if (selectedRange || selectedHeaderRow !== undefined || selectedBodyStartRow !== undefined) {
      return {
        ...(selectedBodyStartRow !== undefined ? { selectedBodyStartRow } : {}),
        ...(selectedHeaderRow !== undefined ? { selectedHeaderRow } : {}),
        ...(selectedRange ? { selectedRange } : {}),
      };
    }
  }
}

export function renderIntrospectionSummary(
  runtime: CliRuntime,
  options: {
    format: DataQueryInputFormat;
    inputPath: string;
    introspection: DataQuerySourceIntrospection;
  },
): void {
  const pc = getCliColors(runtime);
  const lines = [
    `${pc.bold(pc.cyan("Input"))}: ${pc.white(displayPath(runtime, options.inputPath))}`,
    `${pc.bold(pc.cyan("Format"))}: ${pc.white(options.format)}`,
    ...(options.introspection.selectedSource
      ? [`${pc.bold(pc.cyan("Source"))}: ${pc.white(options.introspection.selectedSource)}`]
      : []),
    ...(options.introspection.selectedRange
      ? [`${pc.bold(pc.cyan("Range"))}: ${pc.white(options.introspection.selectedRange)}`]
      : []),
    ...(options.introspection.selectedBodyStartRow !== undefined
      ? [
          `${pc.bold(pc.cyan("Body start row"))}: ${pc.white(String(options.introspection.selectedBodyStartRow))}`,
        ]
      : []),
    ...(options.introspection.selectedHeaderRow !== undefined
      ? [
          `${pc.bold(pc.cyan("Header row"))}: ${pc.white(String(options.introspection.selectedHeaderRow))}`,
        ]
      : []),
    `${pc.bold(pc.cyan("Schema"))}:`,
    ...(options.introspection.columns.length > 0
      ? options.introspection.columns.map(
          (column) => `- ${pc.bold(column.name)}: ${pc.dim(column.type)}`,
        )
      : [`- ${pc.dim("(no columns available)")}`]),
    `${pc.bold(pc.cyan("Sample Rows"))}:`,
    ...(options.introspection.sampleRows.length > 0
      ? options.introspection.sampleRows.map(
          (row, index) => `- ${pc.dim(`${index + 1}.`)} ${pc.white(JSON.stringify(row))}`,
        )
      : [`- ${pc.dim("(no sample rows available)")}`]),
  ];

  for (const line of lines) {
    printLine(runtime.stderr, line);
  }
}

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

    const selectedSource = options.selectedSource?.trim();
    if (!selectedSource) {
      return { introspection, sourceShape };
    }

    const status = createInteractiveAnalyzerStatus(
      options.runtime.stdout,
      options.runtime.colorEnabled,
    );
    let suggestionResult;
    try {
      status.start("Inspecting worksheet structure");
      const sheetSnapshot =
        (await getSheetSnapshot()) ??
        (await collectXlsxSheetSnapshot(options.inputPath, selectedSource));
      status.wait("Waiting for Codex source-shape suggestions");
      suggestionResult = await suggestDataSourceShapeWithCodex({
        context: {
          currentIntrospection: introspection,
          sheetSnapshot,
        },
        currentHeaderRow: sourceShape.selectedHeaderRow,
        currentBodyStartRow: sourceShape.selectedBodyStartRow,
        currentRange: sourceShape.selectedRange,
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
      continue;
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
          description: `Use the suggested shape and re-inspect before ${labels.continuationLabel}`,
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
      return { introspection, sourceShape };
    }

    sourceShape =
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
            ...(suggestionResult.shape.range
              ? { selectedRange: suggestionResult.shape.range }
              : {}),
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
      `Re-inspecting shaped source before ${labels.continuationLabel}.`,
    );
  }
}
