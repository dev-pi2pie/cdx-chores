import { getCliColors } from "../colors";
import type { CliRuntime } from "../types";
import { printLine } from "../actions/shared";
import { startCodexReadOnlyThread } from "../../adapters/codex/shared";
import type {
  DataQueryInputFormat,
  DataQuerySourceIntrospection,
  DataQueryWorkspaceIntrospection,
} from "../duckdb/query";

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
const DATA_QUERY_CODEX_EDITOR_SCHEMA_COLUMNS = 8;
const DATA_QUERY_CODEX_EDITOR_SAMPLE_ROWS = 3;

export type DataQueryCodexIntrospection =
  | DataQuerySourceIntrospection
  | DataQueryWorkspaceIntrospection;

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
      Object.entries(row).map(([key, value]) => [
        key,
        truncateForPrompt(value, DATA_QUERY_CODEX_MAX_SAMPLE_VALUE_CHARS),
      ]),
    );
    return `${index + 1}. ${JSON.stringify(safeRow)}`;
  });
}

function isWorkspaceIntrospection(
  introspection: DataQueryCodexIntrospection,
): introspection is DataQueryWorkspaceIntrospection {
  return introspection.kind === "workspace";
}

interface DataQueryCodexRelationContext {
  alias: string;
  columns: ReadonlyArray<{ name: string; type: string }>;
  sampleRows: readonly Record<string, string>[];
  source?: string;
  truncated: boolean;
}

function getCodexRelationContexts(
  introspection: DataQueryCodexIntrospection,
): DataQueryCodexRelationContext[] {
  if (isWorkspaceIntrospection(introspection)) {
    return introspection.relations.map((relation) => ({
      alias: relation.alias,
      columns: relation.columns,
      sampleRows: relation.sampleRows,
      source: relation.source,
      truncated: relation.truncated,
    }));
  }

  return [
    {
      alias: "file",
      columns: introspection.columns,
      sampleRows: introspection.sampleRows,
      source: introspection.selectedSource,
      truncated: introspection.truncated,
    },
  ];
}

function summarizeRelationSchema(relation: DataQueryCodexRelationContext): string {
  if (relation.columns.length === 0) {
    return "(no columns available)";
  }

  const visibleColumns = relation.columns
    .slice(0, DATA_QUERY_CODEX_EDITOR_SCHEMA_COLUMNS)
    .map((column) => `${column.name} (${column.type})`);
  const remainingColumns = relation.columns.length - visibleColumns.length;
  return remainingColumns > 0
    ? `${visibleColumns.join(", ")}, +${remainingColumns} more`
    : visibleColumns.join(", ");
}

function summarizeEditorSchema(introspection: DataQueryCodexIntrospection): string {
  const relations = getCodexRelationContexts(introspection);
  if (relations.length === 0) {
    return "(no relations available)";
  }

  return isWorkspaceIntrospection(introspection)
    ? relations
        .map((relation) => `${relation.alias}: ${summarizeRelationSchema(relation)}`)
        .join(" | ")
    : summarizeRelationSchema(relations[0]);
}

function buildSingleSourceEditorContextLines(
  introspection: Exclude<DataQueryCodexIntrospection, DataQueryWorkspaceIntrospection>,
): string[] {
  return [
    "# Logical table: file",
    ...(introspection.selectedSource ? [`# Source: ${introspection.selectedSource}`] : []),
    ...(introspection.selectedRange ? [`# Range: ${introspection.selectedRange}`] : []),
    ...(introspection.selectedBodyStartRow !== undefined
      ? [`# Body start row: ${introspection.selectedBodyStartRow}`]
      : []),
    ...(introspection.selectedHeaderRow !== undefined
      ? [`# Header row: ${introspection.selectedHeaderRow}`]
      : []),
  ];
}

interface DataQueryCodexIntrospectionView {
  editorContextLines: string[];
  mode: "single-source" | "workspace";
  promptContextLines: string[];
  promptRuleLine: string;
  promptTargetLine: string;
  relations: DataQueryCodexRelationContext[];
  renderContextLines: (options: {
    format: DataQueryInputFormat;
    intent: string;
    pc: ReturnType<typeof getCliColors>;
  }) => string[];
}

function buildCodexIntrospectionView(
  introspection: DataQueryCodexIntrospection,
): DataQueryCodexIntrospectionView {
  const relations = getCodexRelationContexts(introspection);
  if (isWorkspaceIntrospection(introspection)) {
    return {
      editorContextLines: [
        "# Workspace relations:",
        ...relations.map((relation) => `# - ${relation.alias} (source: ${relation.source})`),
      ],
      mode: "workspace",
      promptContextLines: ["Workspace relations:"],
      promptRuleLine: `- Use only these relation names: ${relations
        .map((relation) => relation.alias)
        .join(", ")}.`,
      promptTargetLine: `Draft one DuckDB SQL query for the workspace relations ${relations
        .map((relation) => `\`${relation.alias}\``)
        .join(", ")}.`,
      relations,
      renderContextLines: ({ format, intent, pc }) => [
        `${pc.bold(pc.cyan("Intent"))}: ${pc.white(intent)}`,
        `${pc.bold(pc.cyan("Format"))}: ${pc.white(format)}`,
        `${pc.bold(pc.cyan("Relations"))}: ${pc.white(
          relations.map((relation) => relation.alias).join(", "),
        )}`,
      ],
    };
  }

  return {
    editorContextLines: buildSingleSourceEditorContextLines(introspection),
    mode: "single-source",
    promptContextLines: [
      `Selected source: ${introspection.selectedSource ?? "(implicit single source)"}`,
      `Selected range: ${introspection.selectedRange ?? "(whole source)"}`,
      `Selected body start row: ${
        introspection.selectedBodyStartRow !== undefined
          ? String(introspection.selectedBodyStartRow)
          : "(not set)"
      }`,
      `Selected header row: ${
        introspection.selectedHeaderRow !== undefined
          ? String(introspection.selectedHeaderRow)
          : "(auto or first row)"
      }`,
    ],
    promptRuleLine: "- Use only the table name `file`.",
    promptTargetLine: "Draft one DuckDB SQL query for the logical table `file`.",
    relations,
    renderContextLines: ({ format, intent, pc }) => [
      `${pc.bold(pc.cyan("Intent"))}: ${pc.white(intent)}`,
      `${pc.bold(pc.cyan("Format"))}: ${pc.white(format)}`,
      ...(introspection.selectedSource
        ? [`${pc.bold(pc.cyan("Source"))}: ${pc.white(introspection.selectedSource)}`]
        : []),
      ...(introspection.selectedRange
        ? [`${pc.bold(pc.cyan("Range"))}: ${pc.white(introspection.selectedRange)}`]
        : []),
      ...(introspection.selectedBodyStartRow !== undefined
        ? [
            `${pc.bold(pc.cyan("Body start row"))}: ${pc.white(String(introspection.selectedBodyStartRow))}`,
          ]
        : []),
      ...(introspection.selectedHeaderRow !== undefined
        ? [
            `${pc.bold(pc.cyan("Header row"))}: ${pc.white(String(introspection.selectedHeaderRow))}`,
          ]
        : []),
    ],
  };
}

export function normalizeDataQueryCodexIntent(intent: string): string {
  return intent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(" ")
    .trim();
}

export function stripDataQueryCodexIntentCommentLines(intent: string): string {
  return intent
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");
}

export function normalizeDataQueryCodexEditorIntent(intent: string): string {
  return normalizeDataQueryCodexIntent(stripDataQueryCodexIntentCommentLines(intent));
}

export function buildDataQueryCodexIntentEditorTemplate(options: {
  format: DataQueryInputFormat;
  intent?: string;
  introspection: DataQueryCodexIntrospection;
}): string {
  const view = buildCodexIntrospectionView(options.introspection);
  const sampleSections = view.relations.flatMap((relation) => {
    const sampleLines = normalizePromptSampleRows(
      relation.sampleRows.slice(0, DATA_QUERY_CODEX_EDITOR_SAMPLE_ROWS),
    );
    const remainingSampleRows = relation.sampleRows.length - sampleLines.length;
    const sampleOverflowLine =
      remainingSampleRows > 0
        ? `${view.mode === "workspace" ? "#   " : "# "}... +${remainingSampleRows} more sampled rows`
        : relation.truncated
          ? `${view.mode === "workspace" ? "#   " : "# "}... additional sampled rows omitted`
          : undefined;

    if (view.mode === "workspace") {
      return [
        `# ${relation.alias}:`,
        ...sampleLines.map((line) => `#   ${line}`),
        ...(sampleOverflowLine ? [sampleOverflowLine] : []),
      ];
    }

    return [
      ...sampleLines.map((line) => `# ${line}`),
      ...(sampleOverflowLine ? [sampleOverflowLine] : []),
    ];
  });

  return [
    "# Query context for Codex drafting.",
    ...view.editorContextLines,
    `# Format: ${options.format}`,
    `# Schema: ${summarizeEditorSchema(options.introspection)}`,
    "# Sample rows:",
    ...sampleSections,
    "#",
    "# Write plain intent below. Comment lines starting with # are ignored.",
    "",
    options.intent?.trim() ?? "",
  ].join("\n");
}

export function buildDataQueryCodexPrompt(options: {
  format: DataQueryInputFormat;
  intent: string;
  introspection: DataQueryCodexIntrospection;
}): string {
  const view = buildCodexIntrospectionView(options.introspection);

  return [
    view.promptTargetLine,
    "Return JSON only following the provided schema.",
    "",
    "Rules:",
    view.promptRuleLine,
    "- Draft SQL only; do not execute it.",
    "- Keep the SQL readable and explicit.",
    "- Prefer named columns instead of `select *` when the intent does not require every column.",
    "- If the intent is slightly ambiguous, make the narrowest reasonable assumption and explain it briefly in reasoning_summary.",
    "",
    `User intent: ${options.intent}`,
    `Detected format: ${options.format}`,
    ...view.promptContextLines,
    "",
    ...view.relations.flatMap((relation, relationIndex) => {
      const schemaLines =
        relation.columns.length > 0
          ? relation.columns.map((column, index) => `${index + 1}. ${column.name}: ${column.type}`)
          : ["(no columns available)"];
      const sampleLines = normalizePromptSampleRows(relation.sampleRows);
      return [
        ...(view.mode === "workspace" && relationIndex === 0 ? ["Workspace relations:"] : []),
        view.mode === "workspace"
          ? `Relation ${relation.alias} (source: ${relation.source})`
          : `Schema (${relation.columns.length} columns):`,
        ...(view.mode === "workspace" ? [`Schema (${relation.columns.length} columns):`] : []),
        ...schemaLines,
        "",
        `Sample rows (showing ${relation.sampleRows.length}${relation.truncated ? "+" : ""}):`,
        ...sampleLines,
        "",
      ];
    }),
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
  introspection: DataQueryCodexIntrospection;
  runner?: DataQueryCodexRunner;
  timeoutMs?: number;
  workingDirectory: string;
}): Promise<DataQueryCodexDraftResult> {
  try {
    const runner = options.runner ?? runDataQueryCodexPrompt;
    const normalizedIntent = normalizeDataQueryCodexIntent(options.intent);
    const finalResponse = await runner({
      prompt: buildDataQueryCodexPrompt({
        format: options.format,
        intent: normalizedIntent,
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
  introspection: DataQueryCodexIntrospection;
  runtime: CliRuntime;
}): void {
  const pc = getCliColors(options.runtime);
  const view = buildCodexIntrospectionView(options.introspection);

  const lines = [
    ...view.renderContextLines({
      format: options.format,
      intent: options.intent,
      pc,
    }),
    `${pc.bold(pc.cyan("Schema"))}:`,
    ...view.relations.flatMap((relation) =>
      view.mode === "workspace"
        ? [
            `- ${pc.bold(relation.alias)} ${pc.dim(`(source: ${relation.source})`)}`,
            ...(relation.columns.length > 0
              ? relation.columns.map(
                  (column) => `  - ${pc.bold(column.name)}: ${pc.dim(column.type)}`,
                )
              : [`  - ${pc.dim("(no columns available)")}`]),
          ]
        : relation.columns.length > 0
          ? relation.columns.map((column) => `- ${pc.bold(column.name)}: ${pc.dim(column.type)}`)
          : [`- ${pc.dim("(no columns available)")}`],
    ),
    `${pc.bold(pc.cyan("Sample Rows"))}:`,
    ...view.relations.flatMap((relation) =>
      view.mode === "workspace"
        ? [
            `- ${pc.bold(relation.alias)}:`,
            ...(relation.sampleRows.length > 0
              ? relation.sampleRows.map(
                  (row, index) => `  - ${pc.dim(`${index + 1}.`)} ${pc.white(JSON.stringify(row))}`,
                )
              : [`  - ${pc.dim("(no sample rows available)")}`]),
          ]
        : relation.sampleRows.length > 0
          ? relation.sampleRows.map(
              (row, index) => `- ${pc.dim(`${index + 1}.`)} ${pc.white(JSON.stringify(row))}`,
            )
          : [`- ${pc.dim("(no sample rows available)")}`],
    ),
    `${pc.bold(pc.cyan("Codex Summary"))}: ${pc.white(options.draft.reasoningSummary)}`,
    "",
    `${pc.bold(pc.green("SQL"))}:`,
    pc.yellow(options.draft.sql),
  ];

  for (const line of lines) {
    printLine(options.runtime.stdout, line);
  }
}
