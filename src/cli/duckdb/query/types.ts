import type { DataPreviewRow } from "../../data-preview/source";
import type { DataHeaderMappingEntry } from "../header-mapping";

export const DATA_QUERY_INPUT_FORMAT_VALUES = ["csv", "tsv", "parquet", "sqlite", "excel"] as const;

export type DataQueryInputFormat = (typeof DATA_QUERY_INPUT_FORMAT_VALUES)[number];

export interface DataQueryRelationBinding {
  alias: string;
  source: string;
}

export interface DataQueryTableResult {
  columns: string[];
  rows: DataPreviewRow[];
  truncated: boolean;
}

export interface DataQueryResultSet {
  columns: string[];
  rows: Array<Record<string, unknown>>;
}

export interface DataQueryIntrospectionColumn {
  name: string;
  type: string;
}

export interface DataQuerySourceIntrospection {
  kind?: "single-source";
  selectedBodyStartRow?: number;
  columns: DataQueryIntrospectionColumn[];
  sampleRows: Array<Record<string, string>>;
  selectedHeaderRow?: number;
  selectedSource?: string;
  selectedRange?: string;
  truncated: boolean;
}

export interface DataQueryWorkspaceRelationIntrospection {
  alias: string;
  columns: DataQueryIntrospectionColumn[];
  sampleRows: Array<Record<string, string>>;
  source: string;
  truncated: boolean;
}

export interface DataQueryWorkspaceIntrospection {
  kind: "workspace";
  relations: DataQueryWorkspaceRelationIntrospection[];
}

export interface DataQuerySourceShape {
  bodyStartRow?: number;
  headerMappings?: DataHeaderMappingEntry[];
  headerRow?: number;
  noHeader?: boolean;
  range?: string;
  relations?: DataQueryRelationBinding[];
  source?: string;
}

export interface PreparedDataQueryContext {
  mode: "single-source" | "workspace";
  relationAliases?: string[];
  selectedBodyStartRow?: number;
  selectedHeaderRow?: number;
  selectedSource?: string;
  selectedRange?: string;
}

export interface QueryRelationColumn {
  name: string;
  sourceName: string;
  type: string;
}

export interface ExcelRangeParts {
  endColumn: string;
  endRow: number;
  startColumn: string;
  startRow: number;
}

export type ExcelImportMode = "default" | "empty_as_varchar" | "all_varchar";

export interface DataQueryExecutionOptions {
  installMissingExtension?: boolean;
  statusStream?: NodeJS.WritableStream;
}
