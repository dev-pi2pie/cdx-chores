import type { DataQueryInputFormat } from "../duckdb/query";
import {
  buildCodexIntrospectionView,
  DATA_QUERY_CODEX_EDITOR_SAMPLE_ROWS,
  normalizePromptSampleRows,
  summarizeEditorSchema,
  type DataQueryCodexIntrospection,
} from "./view";

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
