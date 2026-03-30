import type { DataQueryOptions } from "../../actions";
import type { DataHeaderMappingEntry } from "../../duckdb/header-mapping";
import type { DataQuerySourceIntrospection } from "../../duckdb/query";

export type DataQueryInteractiveMode = "manual" | "formal-guide" | "Codex Assistant";
export type DataQueryReviewMode = "manual" | "formal-guide" | "codex";
export type InteractiveQueryRunResult = "executed" | "change-mode" | "cancel";
export type ExecuteInteractiveCandidateResult =
  | "executed"
  | "revise"
  | "regenerate"
  | "change-mode"
  | "cancel";
export type OutputPromptSelection =
  | ({
      kind: "table";
    } & Pick<DataQueryOptions, "rows">)
  | ({
      kind: "json";
    } & Pick<DataQueryOptions, "json" | "pretty">)
  | ({
      kind: "file";
    } & Pick<DataQueryOptions, "output" | "overwrite" | "pretty">)
  | { kind: "back" }
  | { kind: "cancel" };
export type FormalGuideFilterOperator =
  | "="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "contains"
  | "starts-with"
  | "ends-with"
  | "is-null"
  | "is-not-null"
  | "is-true"
  | "is-false"
  | "is-empty"
  | "is-not-empty";
export type FormalGuideAggregateKind = "none" | "count" | "sum" | "avg" | "min" | "max";

export interface FormalGuideFilter {
  column: string;
  operator: FormalGuideFilterOperator;
  value?: string;
}

export interface FormalGuideAnswers {
  aggregateColumn?: string;
  aggregateKind: FormalGuideAggregateKind;
  filters: FormalGuideFilter[];
  groupByColumns: string[];
  limit?: number;
  orderBySpecs: OrderBySpec[];
  selectAllColumns: boolean;
  selectedColumns: string[];
}

export interface OrderBySpec {
  column: string;
  direction: "asc" | "desc";
}

export interface InteractiveHeaderReviewState {
  headerMappings?: DataHeaderMappingEntry[];
  introspection: DataQuerySourceIntrospection;
}

export interface InteractiveSourceShapeState {
  selectedBodyStartRow?: number;
  selectedHeaderRow?: number;
  selectedNoHeader?: boolean;
  selectedRange?: string;
}

export interface InteractiveContinuationLabels {
  continuationLabel: string;
  notWritingLabel: string;
  reviewPromptLabel: string;
}

export const QUERY_CONTINUATION_LABELS: InteractiveContinuationLabels = {
  continuationLabel: "SQL authoring",
  notWritingLabel: "SQL yet",
  reviewPromptLabel: "SQL",
};
