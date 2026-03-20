import type { DelimitedFormat } from "../../../utils/delimited";
import type { DataHeaderMappingEntry, DataHeaderSuggestionRunner } from "../../duckdb/header-mapping";
import type { DataQueryInputFormat } from "../../duckdb/query";
import type { DataSourceShapeSuggestionRunner } from "../../duckdb/source-shape";

export interface DataExtractOptions {
  bodyStartRow?: number;
  codexSuggestShape?: boolean;
  codexSuggestHeaders?: boolean;
  headerMapping?: string;
  headerMappings?: DataHeaderMappingEntry[];
  headerRow?: number;
  headerSuggestionRunner?: DataHeaderSuggestionRunner;
  input: string;
  inputFormat?: DataQueryInputFormat;
  noHeader?: boolean;
  output?: string;
  overwrite?: boolean;
  range?: string;
  sourceShape?: string;
  sourceShapeSuggestionRunner?: DataSourceShapeSuggestionRunner;
  source?: string;
  writeHeaderMapping?: string;
  writeSourceShape?: string;
}

export type DataExtractOutputFormat = DelimitedFormat | "json";

export const DATA_EXTRACT_HEADER_SUGGESTION_SAMPLE_ROWS = 5;
export const DATA_EXTRACT_SOURCE_SHAPE_SNAPSHOT_ROWS = 24;
