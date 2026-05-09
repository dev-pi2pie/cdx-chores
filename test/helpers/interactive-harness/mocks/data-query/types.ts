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

export interface DataQueryCodexDraftOptions {
  format?: unknown;
  intent?: unknown;
  introspection?:
    | {
        selectedHeaderRow?: unknown;
        selectedRange?: unknown;
        selectedSource?: unknown;
      }
    | {
        kind?: unknown;
        relations?: Array<{ alias?: unknown; source?: unknown }>;
      };
}

export interface HeaderSuggestionOptions {
  format?: unknown;
  introspection?: {
    selectedHeaderRow?: unknown;
    selectedRange?: unknown;
    selectedSource?: unknown;
  };
}

export interface DataQueryWorkspaceRelationScenario {
  alias?: unknown;
  columns?: DataQueryIntrospectionColumn[];
  sampleRows?: Record<string, unknown>[];
  source?: unknown;
  truncated?: boolean;
}

export interface SourceShapeSuggestionOptions {
  currentHeaderRow?: unknown;
  currentRange?: unknown;
  context?: {
    currentIntrospection?: { selectedSource?: unknown };
    sheetSnapshot?: { sheetName?: unknown };
  };
}
