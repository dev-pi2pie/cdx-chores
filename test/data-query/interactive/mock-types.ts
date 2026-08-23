export interface DataQueryCodexDraftOptions {
  format?: unknown;
  intent?: unknown;
  timeoutMs?: unknown;
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
  timeoutMs?: unknown;
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
import type { DataQueryIntrospectionColumn } from "../../helpers/interactive-harness/mocks/data-query/types";
