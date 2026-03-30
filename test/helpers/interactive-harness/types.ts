export interface InteractiveHarnessScenario {
  mode: "run" | "invalid-data-action";
  selectQueue?: unknown[];
  nowIsoString?: string;
  checkboxQueue?: unknown[];
  confirmQueue?: boolean[];
  editorQueue?: string[];
  existingPaths?: string[];
  inputQueue?: string[];
  requiredPathQueue?: string[];
  optionalPathQueue?: Array<string | undefined>;
  dataExtractActionErrorMessage?: string;
  dataExtractActionErrorCode?: string;
  dataExtractActionStderr?: string;
  dataExtractActionStdout?: string;
  stdoutColumns?: number;
  stdoutIsTTY?: boolean;
  dataQueryActionErrorMessage?: string;
  dataQueryActionErrorCode?: string;
  dataQueryActionStderr?: string;
  dataQueryActionStdout?: string;
  dataQueryCodexDraft?: { reasoningSummary?: string; sql: string };
  dataQueryCodexErrorMessage?: string;
  dataQueryDetectedFormat?: string;
  dataQueryHeaderSuggestionErrorMessage?: string;
  dataQueryHeaderSuggestions?: Array<Record<string, unknown>>;
  dataQueryIntrospection?: Record<string, unknown>;
  dataQueryIntrospectionQueue?: Record<string, unknown>[];
  dataSourceShapeSuggestion?: Record<string, unknown>;
  dataSourceShapeSuggestionErrorMessage?: string;
  dataQuerySources?: string[];
  xlsxSheetSnapshot?: Record<string, unknown>;
  cleanupAnalyzerEvidence?: Record<string, unknown>;
  cleanupAnalyzerSuggestion?: Record<string, unknown>;
  cleanupAnalyzerErrorMessage?: string;
  cleanupAnalysisReportPath?: string;
  captureCleanupSuggestInput?: boolean;
  captureCleanupCollectInput?: boolean;
  renameApplyErrorMessage?: string;
}

export interface InteractiveHarnessResult {
  promptCalls: Array<{
    kind: "select" | "checkbox" | "confirm" | "input" | "editor";
    message: string;
    defaultValue?: string;
    postfix?: string;
  }>;
  selectChoicesByMessage: Record<
    string,
    Array<{ name: string; value: string; description?: string }>
  >;
  validationCalls: Array<{ kind: "input"; message: string; value: string; error: string }>;
  pathCalls: Array<{
    kind: "required" | "optional" | "hint";
    message?: string;
    options?: Record<string, unknown>;
    inputPath?: string;
    nextExtension?: string;
  }>;
  actionCalls: Array<{ name: string; options: Record<string, unknown> }>;
  stdout: string;
  stderr: string;
  error?: string;
}
