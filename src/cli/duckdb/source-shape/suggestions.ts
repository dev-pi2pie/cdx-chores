import { startCodexReadOnlyThread } from "../../../adapters/codex/shared";
import { normalizeExcelBodyStartRow, normalizeExcelHeaderRow, normalizeExcelRange } from "../query";
import type {
  DataSourceShapeSuggestionContext,
  DataSourceShapeSuggestionResult,
  DataSourceShapeSuggestionRunner,
} from "./types";

const DATA_SOURCE_SHAPE_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    body_start_row: {
      type: ["integer", "null"],
    },
    header_row: {
      type: ["integer", "null"],
    },
    range: {
      type: ["string", "null"],
    },
    reasoning_summary: {
      type: "string",
    },
  },
  required: ["body_start_row", "header_row", "range", "reasoning_summary"],
  additionalProperties: false,
} as const;

const DATA_SOURCE_SHAPE_TIMEOUT_MS = 30_000;
const DATA_SOURCE_SHAPE_MAX_CELL_VALUE_CHARS = 80;

function truncateForPrompt(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  if (maxChars <= 3) {
    return value.slice(0, maxChars);
  }
  return `${value.slice(0, maxChars - 3)}...`;
}

function buildSourceShapeSuggestionPrompt(options: {
  currentBodyStartRow?: number;
  currentHeaderRow?: number;
  currentRange?: string;
  context: DataSourceShapeSuggestionContext;
}): string {
  const schemaLines =
    options.context.currentIntrospection.columns.length > 0
      ? options.context.currentIntrospection.columns.map(
          (column, index) => `${index + 1}. ${column.name}: ${column.type}`,
        )
      : ["(no columns available)"];
  const sampleLines =
    options.context.currentIntrospection.sampleRows.length > 0
      ? options.context.currentIntrospection.sampleRows.map(
          (row, index) => `${index + 1}. ${JSON.stringify(row)}`,
        )
      : ["(no sample rows available)"];

  const rowLines =
    options.context.sheetSnapshot.rows.length > 0
      ? options.context.sheetSnapshot.rows.map((row) => {
          const cellPreview = row.cells
            .map((cell) => `${cell.ref}=${JSON.stringify(truncateForPrompt(cell.value, DATA_SOURCE_SHAPE_MAX_CELL_VALUE_CHARS))}`)
            .join(", ");
          return `- row ${row.rowNumber}: ${row.firstRef}..${row.lastRef} (${row.cellCount} non-empty cells) ${cellPreview}`;
        })
      : ["- (no non-empty worksheet rows found)"];

  return [
    "Suggest explicit Excel source-shape fields for the intended logical table.",
    "Return JSON only following the provided schema.",
    "",
    "Rules:",
    "- Always return `range`, `header_row`, `body_start_row`, and `reasoning_summary`.",
    "- `range` must use A1:Z99-style rectangular notation when present.",
    "- `header_row` must use the absolute worksheet row number when present.",
    "- `body_start_row` must use the absolute worksheet row number when present.",
    "- Choose the narrowest reasonable rectangle that contains the real header row and data rows when changing `range`.",
    "- Exclude decorative titles, banner rows, and spacer regions when possible.",
    "- Do not invent sheet names or semantic headers.",
    "- Base the suggestion on the worksheet cell evidence and the current shaped-source result.",
    "- Use `null` for `range` when the current range should stay unchanged.",
    "- Use `null` for `header_row` when the current header row should stay unchanged.",
    "- Use `null` for `body_start_row` when no explicit body-start change is needed.",
    "- If the current range is already plausible but only the body boundary needs correction, return `body_start_row` and set the unchanged fields to null.",
    "- If the current range is already plausible but the header row is wrong, return `header_row` and set `range` to null.",
    "- If multiple shaping fields need correction, return every field that should change.",
    "- Do not return empty strings or zero placeholders.",
    "",
    `Selected sheet: ${options.context.sheetSnapshot.sheetName}`,
    `Current range: ${options.currentRange ?? "(whole sheet)"}`,
    `Current header row: ${
      options.currentHeaderRow !== undefined ? String(options.currentHeaderRow) : "(auto or first row)"
    }`,
    `Current body start row: ${
      options.currentBodyStartRow !== undefined ? String(options.currentBodyStartRow) : "(not set)"
    }`,
    `Worksheet used range: ${options.context.sheetSnapshot.usedRange ?? "(unknown)"}`,
    `Merged ranges: ${
      options.context.sheetSnapshot.mergedRanges.length > 0
        ? options.context.sheetSnapshot.mergedRanges.join(", ")
        : "(none detected)"
    }${options.context.sheetSnapshot.mergedRangesTruncated ? ", ..." : ""}`,
    "",
    "Current shaped-source schema:",
    ...schemaLines,
    "",
    "Current shaped-source sample rows:",
    ...sampleLines,
    "",
    "Worksheet non-empty row summaries:",
    ...rowLines,
    ...(options.context.sheetSnapshot.rowsTruncated
      ? ["- ... additional non-empty rows omitted"]
      : []),
  ].join("\n");
}

function parseSourceShapeSuggestionResponse(finalResponse: string): {
  bodyStartRow?: number;
  headerRow?: number;
  range?: string;
  reasoningSummary: string;
} {
  const parsed = JSON.parse(finalResponse) as {
    body_start_row?: unknown;
    header_row?: unknown;
    range?: unknown;
    reasoning_summary?: unknown;
  };

  const range = typeof parsed.range === "string" && parsed.range.trim().length > 0
    ? normalizeExcelRange(parsed.range)
    : undefined;
  const bodyStartRow = parsed.body_start_row !== undefined && parsed.body_start_row !== null
    ? normalizeExcelBodyStartRow(
        typeof parsed.body_start_row === "number"
          ? parsed.body_start_row
          : Number(parsed.body_start_row),
      )
    : undefined;
  const headerRow = parsed.header_row !== undefined && parsed.header_row !== null
    ? normalizeExcelHeaderRow(
        typeof parsed.header_row === "number"
          ? parsed.header_row
          : Number(parsed.header_row),
      )
    : undefined;
  const reasoningSummary =
    typeof parsed.reasoning_summary === "string" ? parsed.reasoning_summary.trim() : "";

  if (!reasoningSummary) {
    throw new Error("Codex source-shape response did not include reasoning_summary.");
  }
  if (!range && bodyStartRow === undefined && headerRow === undefined) {
    throw new Error("Codex source-shape response must include range, header_row, body_start_row, or a valid combination of them.");
  }

  return {
    ...(bodyStartRow !== undefined ? { bodyStartRow } : {}),
    ...(headerRow !== undefined ? { headerRow } : {}),
    ...(range ? { range } : {}),
    reasoningSummary,
  };
}

async function runSourceShapePrompt(options: {
  prompt: string;
  timeoutMs?: number;
  workingDirectory: string;
}): Promise<string> {
  const thread = startCodexReadOnlyThread(options.workingDirectory);
  const turn = await thread.run([{ type: "text", text: options.prompt }], {
    outputSchema: DATA_SOURCE_SHAPE_OUTPUT_SCHEMA,
    signal: AbortSignal.timeout(options.timeoutMs ?? DATA_SOURCE_SHAPE_TIMEOUT_MS),
  });
  return turn.finalResponse;
}

export async function suggestDataSourceShapeWithCodex(options: {
  context: DataSourceShapeSuggestionContext;
  currentBodyStartRow?: number;
  currentHeaderRow?: number;
  currentRange?: string;
  runner?: DataSourceShapeSuggestionRunner;
  timeoutMs?: number;
  workingDirectory: string;
}): Promise<DataSourceShapeSuggestionResult> {
  try {
    const runner = options.runner ?? runSourceShapePrompt;
    const finalResponse = await runner({
      prompt: buildSourceShapeSuggestionPrompt({
        context: options.context,
        currentBodyStartRow: options.currentBodyStartRow,
        currentHeaderRow: options.currentHeaderRow,
        currentRange: options.currentRange,
      }),
      timeoutMs: options.timeoutMs,
      workingDirectory: options.workingDirectory,
    });
    const parsed = parseSourceShapeSuggestionResponse(finalResponse);
    return {
      reasoningSummary: parsed.reasoningSummary,
      shape: {
        ...(parsed.bodyStartRow !== undefined ? { bodyStartRow: parsed.bodyStartRow } : {}),
        ...(parsed.headerRow !== undefined ? { headerRow: parsed.headerRow } : {}),
        ...(parsed.range ? { range: parsed.range } : {}),
      },
    };
  } catch (error) {
    return {
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}
