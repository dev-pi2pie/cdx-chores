import type { DataQuerySourceIntrospection } from "../query";
import type { XlsxSheetSnapshot } from "../xlsx-sources";

export const DATA_SOURCE_SHAPE_ARTIFACT_TYPE = "data-source-shape";
export const DATA_SOURCE_SHAPE_VERSION = 1;

export interface DataSourceShapeInputReference {
  format: "excel";
  path: string;
  source: string;
}

export interface DataSourceShapeSelection {
  headerRow?: number;
  range?: string;
}

export type DataSourceShapeArtifact = Record<string, unknown> & {
  version: number;
  metadata: Record<string, unknown> & {
    artifactType: string;
    issuedAt: string;
  };
  input: Record<string, unknown> & DataSourceShapeInputReference;
  shape: Record<string, unknown> & DataSourceShapeSelection;
};

export interface DataSourceShapeSuggestionResult {
  errorMessage?: string;
  reasoningSummary?: string;
  shape?: DataSourceShapeSelection;
}

export type DataSourceShapeSuggestionRunner = (options: {
  prompt: string;
  timeoutMs?: number;
  workingDirectory: string;
}) => Promise<string>;

export interface DataSourceShapeSuggestionContext {
  currentIntrospection: DataQuerySourceIntrospection;
  sheetSnapshot: XlsxSheetSnapshot;
}
