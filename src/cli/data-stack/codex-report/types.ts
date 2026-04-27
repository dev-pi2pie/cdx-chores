import type { DataStackColumnSummary, DataStackDiagnosticsResult } from "../diagnostics";
import type { DataStackPlanArtifact } from "../plan";

export const DATA_STACK_CODEX_REPORT_ARTIFACT_TYPE = "data-stack-codex-report";
export const DATA_STACK_CODEX_REPORT_VERSION = 1;
export const DATA_STACK_CODEX_REPORT_CREATED_BY = "cdx-chores data stack --codex-assist";
export const DATA_STACK_CODEX_REPORT_UID_HEX_LENGTH = 8;

export const DATA_STACK_CODEX_PATCH_PATHS = [
  "/input/columns",
  "/schema/mode",
  "/schema/excludedNames",
  "/duplicates/uniqueBy",
  "/duplicates/policy",
] as const;

export type DataStackCodexPatchPath = (typeof DATA_STACK_CODEX_PATCH_PATHS)[number];

export interface DataStackCodexPatch {
  op: "replace";
  path: DataStackCodexPatchPath;
  value: unknown;
}

export interface DataStackCodexRecommendation {
  confidence: number;
  id: string;
  patches: DataStackCodexPatch[];
  reasoningSummary: string;
  title: string;
}

export interface DataStackCodexFactPayload {
  diagnostics: {
    candidateUniqueKeys: DataStackPlanArtifact["diagnostics"]["candidateUniqueKeys"];
    columnSummaries: DataStackColumnSummary[];
    duplicateKeyNullRows: number;
    duplicateSummary: DataStackDiagnosticsResult["duplicateSummary"];
    matchedFileCount: number;
    rowCount: number;
    schemaNameCount: number;
  };
  duplicates: DataStackPlanArtifact["duplicates"];
  input: DataStackPlanArtifact["input"];
  output: DataStackPlanArtifact["output"];
  schema: DataStackPlanArtifact["schema"];
  sources: {
    baseDirectory: string;
    pattern: string | null;
    recursive: boolean;
    resolvedSample: string[];
    totalResolved: number;
  };
}

export interface DataStackCodexReportArtifact {
  facts: DataStackCodexFactPayload;
  metadata: {
    artifactId: string;
    artifactType: typeof DATA_STACK_CODEX_REPORT_ARTIFACT_TYPE;
    createdBy: string;
    issuedAt: string;
    payloadId: string;
    planArtifactId: string;
    planPayloadId: string;
  };
  recommendations: DataStackCodexRecommendation[];
  version: typeof DATA_STACK_CODEX_REPORT_VERSION;
}

export interface DataStackCodexRecommendationDecisionInput {
  decision: "accepted" | "edited";
  patches?: DataStackCodexPatch[];
  recommendationId: string;
}
