import type { DataStackInputFormat, DataStackOutputFormat, DataStackSchemaMode } from "../types";

export const DATA_STACK_PLAN_ARTIFACT_TYPE = "data-stack-plan";
export const DATA_STACK_PLAN_VERSION = 1;
export const DATA_STACK_PLAN_REPLAY_COMMAND = "data stack replay";
export const DATA_STACK_PLAN_CREATED_BY = "cdx-chores data stack --dry-run";
export const DATA_STACK_PLAN_UID_HEX_LENGTH = 8;
export const DATA_STACK_DUPLICATE_POLICY_VALUES = ["preserve", "report", "reject"] as const;

export type DataStackPlanHeaderMode = "header" | "no-header";
export type DataStackDuplicatePolicy = (typeof DATA_STACK_DUPLICATE_POLICY_VALUES)[number];
export type DataStackRecommendationDecisionValue = "accepted" | "edited";

export interface DataStackPlanRecommendationDecision {
  decision: DataStackRecommendationDecisionValue;
  recommendationId: string;
  reportArtifactId: string;
}

export interface DataStackPlanMetadata {
  acceptedRecommendationIds: string[];
  artifactId: string;
  artifactType: typeof DATA_STACK_PLAN_ARTIFACT_TYPE;
  createdBy: string;
  derivedFromPayloadId: string | null;
  issuedAt: string;
  payloadId: string;
  recommendationDecisions: DataStackPlanRecommendationDecision[];
}

export interface DataStackPlanCommand {
  action: "stack";
  family: "data";
  replayCommand: typeof DATA_STACK_PLAN_REPLAY_COMMAND;
}

export interface DataStackPlanSourceFingerprint {
  mtimeMs: number;
  sizeBytes: number;
}

export interface DataStackPlanResolvedSource {
  fingerprint?: DataStackPlanSourceFingerprint;
  kind: "file";
  path: string;
}

export interface DataStackPlanSources {
  baseDirectory: string;
  maxDepth: number | null;
  pattern: string | null;
  raw: string[];
  recursive: boolean;
  resolved: DataStackPlanResolvedSource[];
}

export interface DataStackPlanInput {
  columns: string[];
  format: DataStackInputFormat;
  headerMode: DataStackPlanHeaderMode;
}

export interface DataStackPlanSchema {
  excludedNames: string[];
  includedNames: string[];
  mode: DataStackSchemaMode;
}

export interface DataStackPlanDuplicates {
  duplicateKeyConflicts: number;
  exactDuplicateRows: number;
  policy: DataStackDuplicatePolicy;
  uniqueBy: string[];
}

export interface DataStackPlanOutput {
  format: DataStackOutputFormat;
  overwrite: boolean;
  path: string | null;
}

export interface DataStackPlanCandidateUniqueKey {
  columns: string[];
  duplicateRows: number;
  nullRows: number;
}

export interface DataStackPlanDiagnostics {
  candidateUniqueKeys: DataStackPlanCandidateUniqueKey[];
  matchedFileCount: number;
  reportPath: string | null;
  rowCount: number;
  schemaNameCount: number;
}

export interface DataStackPlanArtifact {
  command: DataStackPlanCommand;
  diagnostics: DataStackPlanDiagnostics;
  duplicates: DataStackPlanDuplicates;
  input: DataStackPlanInput;
  metadata: DataStackPlanMetadata;
  output: DataStackPlanOutput;
  schema: DataStackPlanSchema;
  sources: DataStackPlanSources;
  version: typeof DATA_STACK_PLAN_VERSION;
}

export interface DataStackPlanIdentity {
  artifactId: string;
  fileName: string;
  payloadId: string;
  timestamp: string;
  uid: string;
}
