import type {
  DataQueryInputFormat,
  DataQuerySourceIntrospection,
  DataQuerySourceShape,
} from "../query";

export const DATA_HEADER_MAPPING_ARTIFACT_TYPE = "data-header-mapping";
export const DATA_HEADER_MAPPING_VERSION = 1;

export interface DataHeaderMappingInputReference {
  bodyStartRow?: number;
  format: DataQueryInputFormat;
  headerRow?: number;
  noHeader?: boolean;
  path: string;
  range?: string;
  source?: string;
}

export type DataHeaderMappingEntry = Record<string, unknown> & {
  from: string;
  inferredType?: string;
  sample?: string;
  to: string;
};

export type DataHeaderMappingArtifact = Record<string, unknown> & {
  version: number;
  metadata: Record<string, unknown> & {
    artifactType: string;
    issuedAt: string;
  };
  input: Record<string, unknown> & DataHeaderMappingInputReference;
  mappings: DataHeaderMappingEntry[];
};

export interface DataHeaderSuggestionResult {
  errorMessage?: string;
  mappings: DataHeaderMappingEntry[];
}

export type DataHeaderSuggestionRunner = (options: {
  prompt: string;
  timeoutMs?: number;
  workingDirectory: string;
}) => Promise<string>;

export interface DataHeaderSuggestionEvidence {
  from: string;
  inferredType: string;
  sample?: string;
}

export type DataHeaderMappingShape = Pick<
  DataQuerySourceShape,
  "bodyStartRow" | "headerRow" | "noHeader" | "range" | "source"
>;
export type DataHeaderSuggestionIntrospection = DataQuerySourceIntrospection;
export type DataHeaderMappingFormat = DataQueryInputFormat;
