import type { DataStackDiagnosticsResult } from "./diagnostics";
import type { DataStackPlanHeaderMode } from "./plan";
import type { DataStackSchemaMode } from "./types";

export type DataStackCodexAssistSignal =
  | "headerless-columns"
  | "union-by-name-gaps"
  | "duplicate-rows"
  | "candidate-unique-keys"
  | "selected-key-conflicts";

const DATA_STACK_CODEX_ASSIST_SIGNAL_LABELS: Record<DataStackCodexAssistSignal, string> = {
  "candidate-unique-keys": "candidate unique keys",
  "duplicate-rows": "duplicate rows",
  "headerless-columns": "headerless columns",
  "selected-key-conflicts": "selected-key conflicts",
  "union-by-name-gaps": "union-by-name gaps",
};

function isGeneratedHeaderlessColumnName(name: string): boolean {
  return /^column_\d+$/.test(name);
}

export function formatDataStackCodexAssistSignal(signal: DataStackCodexAssistSignal): string {
  return DATA_STACK_CODEX_ASSIST_SIGNAL_LABELS[signal];
}

export function getDataStackCodexAssistSignals(options: {
  diagnostics: DataStackDiagnosticsResult;
  headerMode: DataStackPlanHeaderMode;
  inputColumns: readonly string[];
  schemaMode: DataStackSchemaMode;
  uniqueBy: readonly string[];
}): DataStackCodexAssistSignal[] {
  const signals: DataStackCodexAssistSignal[] = [];

  if (
    options.headerMode === "no-header" &&
    options.inputColumns.some(isGeneratedHeaderlessColumnName)
  ) {
    signals.push("headerless-columns");
  }

  if (
    options.schemaMode === "union-by-name" &&
    options.diagnostics.columnSummaries.some((summary) => summary.nullRows > 0)
  ) {
    signals.push("union-by-name-gaps");
  }

  if (options.diagnostics.duplicateSummary.exactDuplicateRows > 0) {
    signals.push("duplicate-rows");
  }

  if (
    options.uniqueBy.length === 0 &&
    options.diagnostics.planDiagnostics.candidateUniqueKeys.length > 0
  ) {
    signals.push("candidate-unique-keys");
  }

  if (
    options.uniqueBy.length > 0 &&
    options.diagnostics.duplicateSummary.duplicateKeyConflicts > 0
  ) {
    signals.push("selected-key-conflicts");
  }

  return signals;
}
