export interface DataQueryIntrospectionColumn {
  name: string;
  type: string;
}

export interface DataQueryIntrospection {
  columns?: DataQueryIntrospectionColumn[];
  sampleRows?: Record<string, unknown>[];
  selectedBodyStartRow?: unknown;
  selectedHeaderRow?: unknown;
  selectedRange?: unknown;
  selectedSource?: unknown;
  truncated?: boolean;
}

export interface SourceShapeSuggestionOptions {
  currentHeaderRow?: unknown;
  currentRange?: unknown;
  timeoutMs?: unknown;
  context?: {
    currentIntrospection?: { selectedSource?: unknown };
    sheetSnapshot?: { sheetName?: unknown };
  };
}
