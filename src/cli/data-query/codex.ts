import { getCliColors } from "../colors";
import type { CliRuntime } from "../types";
import { printLine } from "../actions/shared";
import { startCodexReadOnlyThread } from "../../adapters/codex/shared";
import type { DataQueryInputFormat, DataQuerySourceIntrospection } from "../duckdb/query";

const DATA_QUERY_CODEX_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    sql: {
      type: "string",
    },
    reasoning_summary: {
      type: "string",
    },
  },
  required: ["sql", "reasoning_summary"],
  additionalProperties: false,
} as const;

const DATA_QUERY_CODEX_TIMEOUT_MS = 30_000;
const DATA_QUERY_CODEX_MAX_SAMPLE_VALUE_CHARS = 120;

export interface DataQueryCodexDraft {
  reasoningSummary: string;
  sql: string;
}

export interface DataQueryCodexDraftResult {
  draft?: DataQueryCodexDraft;
  errorMessage?: string;
}

export type DataQueryCodexRunner = (options: {
  prompt: string;
  workingDirectory: string;
  timeoutMs?: number;
}) => Promise<string>;

function truncateForPrompt(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  if (maxChars <= 3) {
    return value.slice(0, maxChars);
  }
  return `${value.slice(0, maxChars - 3)}...`;
}

function normalizePromptSampleRows(rows: readonly Record<string, string>[]): string[] {
  if (rows.length === 0) {
    return ["(no sample rows available)"];
  }

  return rows.map((row, index) => {
    const safeRow = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, truncateForPrompt(value, DATA_QUERY_CODEX_MAX_SAMPLE_VALUE_CHARS)]),
    );
    return `${index + 1}. ${JSON.stringify(safeRow)}`;
  });
}

export function buildDataQueryCodexPrompt(options: {
  format: DataQueryInputFormat;
  intent: string;
  introspection: DataQuerySourceIntrospection;
}): string {
  const schemaLines =
    options.introspection.columns.length > 0
      ? options.introspection.columns.map((column, index) => `${index + 1}. ${column.name}: ${column.type}`)
      : ["(no columns available)"];
  const sampleLines = normalizePromptSampleRows(options.introspection.sampleRows);

  return [
    "Draft one DuckDB SQL query for the logical table `file`.",
    "Return JSON only following the provided schema.",
    "",
    "Rules:",
    "- Use only the table name `file`.",
    "- Draft SQL only; do not execute it.",
    "- Keep the SQL readable and explicit.",
    "- Prefer named columns instead of `select *` when the intent does not require every column.",
    "- If the intent is slightly ambiguous, make the narrowest reasonable assumption and explain it briefly in reasoning_summary.",
    "",
    `User intent: ${options.intent}`,
    `Detected format: ${options.format}`,
    `Selected source: ${options.introspection.selectedSource ?? "(implicit single source)"}`,
    "",
    `Schema (${options.introspection.columns.length} columns):`,
    ...schemaLines,
    "",
    `Sample rows (showing ${options.introspection.sampleRows.length}${options.introspection.truncated ? "+" : ""}):`,
    ...sampleLines,
  ].join("\n");
}

function parseDataQueryCodexDraft(finalResponse: string): DataQueryCodexDraft {
  const parsed = JSON.parse(finalResponse) as {
    reasoning_summary?: unknown;
    sql?: unknown;
  };

  const sql = typeof parsed.sql === "string" ? parsed.sql.trim() : "";
  if (!sql) {
    throw new Error("Codex drafting response did not include SQL.");
  }

  const reasoningSummary =
    typeof parsed.reasoning_summary === "string" ? parsed.reasoning_summary.trim() : "";
  if (!reasoningSummary) {
    throw new Error("Codex drafting response did not include reasoning_summary.");
  }

  return {
    reasoningSummary,
    sql,
  };
}

async function runDataQueryCodexPrompt(options: {
  prompt: string;
  workingDirectory: string;
  timeoutMs?: number;
}): Promise<string> {
  const thread = startCodexReadOnlyThread(options.workingDirectory);
  const turn = await thread.run([{ type: "text", text: options.prompt }], {
    outputSchema: DATA_QUERY_CODEX_OUTPUT_SCHEMA,
    signal: AbortSignal.timeout(options.timeoutMs ?? DATA_QUERY_CODEX_TIMEOUT_MS),
  });
  return turn.finalResponse;
}

export async function draftDataQueryWithCodex(options: {
  format: DataQueryInputFormat;
  intent: string;
  introspection: DataQuerySourceIntrospection;
  runner?: DataQueryCodexRunner;
  timeoutMs?: number;
  workingDirectory: string;
}): Promise<DataQueryCodexDraftResult> {
  try {
    const runner = options.runner ?? runDataQueryCodexPrompt;
    const finalResponse = await runner({
      prompt: buildDataQueryCodexPrompt({
        format: options.format,
        intent: options.intent,
        introspection: options.introspection,
      }),
      workingDirectory: options.workingDirectory,
      timeoutMs: options.timeoutMs,
    });
    return {
      draft: parseDataQueryCodexDraft(finalResponse),
    };
  } catch (error) {
    return {
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

export function renderDataQueryCodexDraft(options: {
  draft: DataQueryCodexDraft;
  format: DataQueryInputFormat;
  intent: string;
  introspection: DataQuerySourceIntrospection;
  runtime: CliRuntime;
}): void {
  const pc = getCliColors(options.runtime);
  const lines = [
    `${pc.bold(pc.cyan("Intent"))}: ${pc.white(options.intent)}`,
    `${pc.bold(pc.cyan("Format"))}: ${pc.white(options.format)}`,
    ...(options.introspection.selectedSource
      ? [`${pc.bold(pc.cyan("Source"))}: ${pc.white(options.introspection.selectedSource)}`]
      : []),
    `${pc.bold(pc.cyan("Schema"))}:`,
    ...(options.introspection.columns.length > 0
      ? options.introspection.columns.map(
          (column) =>
            `- ${pc.bold(column.name)}: ${pc.dim(column.type)}`,
        )
      : [`- ${pc.dim("(no columns available)")}`]),
    `${pc.bold(pc.cyan("Sample Rows"))}:`,
    ...(options.introspection.sampleRows.length > 0
      ? options.introspection.sampleRows.map(
          (row, index) => `- ${pc.dim(`${index + 1}.`)} ${pc.white(JSON.stringify(row))}`,
        )
      : [`- ${pc.dim("(no sample rows available)")}`]),
    `${pc.bold(pc.cyan("Codex Summary"))}: ${pc.white(options.draft.reasoningSummary)}`,
    "",
    `${pc.bold(pc.green("SQL"))}:`,
    pc.yellow(options.draft.sql),
  ];

  for (const line of lines) {
    printLine(options.runtime.stdout, line);
  }
}
