import { getCliColors } from "../colors";
import type {
  DataQueryInputFormat,
  DataQuerySourceIntrospection,
  DataQueryWorkspaceIntrospection,
} from "../duckdb/query";

const DATA_QUERY_CODEX_MAX_SAMPLE_VALUE_CHARS = 120;
const DATA_QUERY_CODEX_EDITOR_SCHEMA_COLUMNS = 8;
export const DATA_QUERY_CODEX_EDITOR_SAMPLE_ROWS = 3;

export type DataQueryCodexIntrospection =
  | DataQuerySourceIntrospection
  | DataQueryWorkspaceIntrospection;

export interface DataQueryCodexRelationContext {
  alias: string;
  columns: ReadonlyArray<{ name: string; type: string }>;
  sampleRows: readonly Record<string, string>[];
  source?: string;
  truncated: boolean;
}

export interface DataQueryCodexIntrospectionView {
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

function truncateForPrompt(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  if (maxChars <= 3) {
    return value.slice(0, maxChars);
  }
  return `${value.slice(0, maxChars - 3)}...`;
}

export function normalizePromptSampleRows(rows: readonly Record<string, string>[]): string[] {
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

export function summarizeEditorSchema(introspection: DataQueryCodexIntrospection): string {
  const relations = getCodexRelationContexts(introspection);
  const [firstRelation] = relations;
  if (!firstRelation) {
    return "(no relations available)";
  }

  return isWorkspaceIntrospection(introspection)
    ? relations
        .map((relation) => `${relation.alias}: ${summarizeRelationSchema(relation)}`)
        .join(" | ")
    : summarizeRelationSchema(firstRelation);
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

export function buildCodexIntrospectionView(
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
            `${pc.bold(pc.cyan("Body start row"))}: ${pc.white(
              String(introspection.selectedBodyStartRow),
            )}`,
          ]
        : []),
      ...(introspection.selectedHeaderRow !== undefined
        ? [
            `${pc.bold(pc.cyan("Header row"))}: ${pc.white(
              String(introspection.selectedHeaderRow),
            )}`,
          ]
        : []),
    ],
  };
}
