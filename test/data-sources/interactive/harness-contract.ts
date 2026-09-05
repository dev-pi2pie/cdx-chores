export interface SourceShapeSuggestionOptions {
  currentHeaderRow?: unknown;
  currentRange?: unknown;
  codexExecution?: unknown;
  timeoutMs?: unknown;
  context?: {
    currentIntrospection?: { selectedSource?: unknown };
    sheetSnapshot?: { sheetName?: unknown };
  };
}

export interface DataSourcesInteractiveHarnessScenario {
  dataQueryDetectedFormat?: string;
  dataQueryIntrospection?: Record<string, unknown>;
  dataQueryIntrospectionQueue?: Record<string, unknown>[];
  dataSourceShapeSuggestion?: Record<string, unknown>;
  dataSourceShapeSuggestionErrorMessage?: string;
  dataQuerySources?: string[];
  xlsxSheetSnapshot?: Record<string, unknown>;
}
