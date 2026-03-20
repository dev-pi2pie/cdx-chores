import type { DataQueryOptions } from "../../actions";
import type { DataHeaderMappingEntry } from "../../duckdb/header-mapping";
import type { DataQuerySourceIntrospection } from "../../duckdb/query";

export type DataQueryInteractiveMode = "manual" | "formal-guide" | "Codex Assistant";
export type OutputPromptSelection = Pick<DataQueryOptions, "json" | "output" | "overwrite" | "pretty" | "rows">;
export type FormalGuideFilterOperator = "=" | "!=" | ">" | ">=" | "<" | "<=" | "contains";
export type FormalGuideAggregateKind = "none" | "count" | "sum" | "avg" | "min" | "max";

export interface FormalGuideFilter {
  column: string;
  operator: FormalGuideFilterOperator;
  value: string;
}

export interface FormalGuideAnswers {
  aggregateColumn?: string;
  aggregateKind: FormalGuideAggregateKind;
  filters: FormalGuideFilter[];
  groupByColumns: string[];
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
