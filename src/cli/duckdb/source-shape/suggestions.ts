import { startCodexReadOnlyThread } from "../../../adapters/codex/shared";
import { normalizeExcelHeaderRow, normalizeExcelRange } from "../query";
import type {
  DataSourceShapeSuggestionContext,
  DataSourceShapeSuggestionResult,
  DataSourceShapeSuggestionRunner,
} from "./types";

const DATA_SOURCE_SHAPE_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
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
  required: ["header_row", "range", "reasoning_summary"],
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
    "- Always return `range`, `header_row`, and `reasoning_summary`.",
    "- `range` must use A1:Z99-style rectangular notation when present.",
    "- `header_row` must use the absolute worksheet row number when present.",
    "- Choose the narrowest reasonable rectangle that contains the real header row and data rows when changing `range`.",
    "- Exclude decorative titles, banner rows, and spacer regions when possible.",
    "- Do not invent sheet names or semantic headers.",
    "- Base the suggestion on the worksheet cell evidence and the current shaped-source result.",
    "- Use `null` for `range` when the current range should stay unchanged.",
    "- Use `null` for `header_row` when the current header row should stay unchanged.",
    "- If the current range is already plausible but the header row is wrong, return `header_row` and set `range` to null.",
    "- If the current range and header row both need correction, return both.",
    "- Do not return empty strings or zero placeholders.",
    "",
    `Selected sheet: ${options.context.sheetSnapshot.sheetName}`,
    `Current range: ${options.currentRange ?? "(whole sheet)"}`,
    `Current header row: ${
      options.currentHeaderRow !== undefined ? String(options.currentHeaderRow) : "(auto or first row)"
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
  headerRow?: number;
  range?: string;
  reasoningSummary: string;
} {
  const parsed = JSON.parse(finalResponse) as {
    header_row?: unknown;
    range?: unknown;
    reasoning_summary?: unknown;
  };

  const range = typeof parsed.range === "string" && parsed.range.trim().length > 0
    ? normalizeExcelRange(parsed.range)
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
  if (!range && headerRow === undefined) {
    throw new Error("Codex source-shape response must include range, header_row, or both.");
  }

  return {
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
