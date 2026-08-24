export interface DataQueryInteractiveHarnessScenario {
  dataQueryActionErrorMessage?: string;
  dataQueryActionErrorCode?: string;
  dataQueryActionStderr?: string;
  dataQueryActionStdout?: string;
  dataQueryCodexDraft?: { reasoningSummary?: string; sql: string };
  dataQueryCodexErrorMessage?: string;
  dataQueryCodexFailureKind?: "timeout" | "aborted" | "other";
  dataQueryMocks?: boolean;
  dataQueryHeaderSuggestionErrorMessage?: string;
  dataQueryHeaderSuggestions?: Array<Record<string, unknown>>;
  dataQueryWorkspaceIntrospection?: Record<string, unknown>;
  dataQueryWorkspaceIntrospectionQueue?: Record<string, unknown>[];
}
