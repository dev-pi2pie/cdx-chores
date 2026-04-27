import type { DataStackCodexReportArtifact, writePreparedDataStackPlan } from "../../../actions";
import type { DataStackDiagnosticsResult } from "../../../data-stack/diagnostics";
import type { PreparedDataStackExecution } from "../../../data-stack/prepare";
import type { DataStackDuplicatePolicy, DataStackPlanArtifact } from "../../../data-stack/plan";
import type {
  DataStackInputFormat,
  DataStackOutputFormat,
  DataStackSchemaMode,
  DataStackSchemaModeOption,
} from "../../../data-stack/types";

export interface InteractiveDataStackSourcePath {
  raw: string;
  resolved: string;
}

export interface InteractiveDataStackSource extends InteractiveDataStackSourcePath {
  kind: "directory" | "file";
}

export interface InteractiveDataStackSetup {
  excludeColumns: string[];
  inputFormat: DataStackInputFormat;
  pattern?: string;
  recursive: boolean;
  schemaMode: DataStackSchemaModeOption;
  sources: InteractiveDataStackSource[];
}

export interface InteractiveDataStackSourceDiscoveryState {
  inputFormat: DataStackInputFormat;
  pattern?: string;
  recursive: boolean;
  sources: InteractiveDataStackSource[];
}

export interface InteractiveDataStackWritePlan {
  output: string;
  outputFormat: DataStackOutputFormat;
  overwrite: boolean;
}

export const INTERACTIVE_DATA_STACK_DUPLICATE_POLICY: DataStackDuplicatePolicy = "preserve";
export const INTERACTIVE_DATA_STACK_UNIQUE_BY: readonly string[] = [];
export const INTERACTIVE_DATA_STACK_CODEX_TIMEOUT_MS = 30_000;

export type InteractiveDataStackMatchedFileAction = "accept" | "options" | "sources" | "cancel";
export type InteractiveDataStackSourceDiscoveryOption = "pattern" | "recursive" | "format" | "back";

export type InteractiveDataStackWriteOutcome =
  | {
      diagnostics: DataStackDiagnosticsResult;
      kind: "write";
      plan: InteractiveDataStackWritePlan;
      planArtifact: DataStackPlanArtifact;
      planPath: string;
      prepared: PreparedDataStackExecution;
      outputPath: string;
    }
  | { kind: "dry-run" }
  | { kind: "review" }
  | { kind: "cancel" };

export type InteractiveDataStackPlanWriteOptions = Omit<
  Parameters<typeof writePreparedDataStackPlan>[1],
  "plan" | "planPath"
>;

export interface InteractiveDataStackPreviewState {
  diagnostics: DataStackDiagnosticsResult;
  outputPath: string;
  plan: InteractiveDataStackWritePlan;
  planArtifact?: DataStackPlanArtifact;
  planWriteOptions: InteractiveDataStackPlanWriteOptions;
  prepared: PreparedDataStackExecution;
  requestedSchemaMode: DataStackSchemaModeOption;
  resolvedSchemaMode: DataStackSchemaMode;
  setup: InteractiveDataStackSetup;
}

export interface InteractiveDataStackReviewedPlan {
  plan: DataStackPlanArtifact;
  report?: {
    artifact: DataStackCodexReportArtifact;
    path: string;
  };
}

export function formatInteractiveStackPattern(
  pattern: string | undefined,
  inputFormat: DataStackInputFormat,
): string {
  return pattern ?? `format default (*.${inputFormat})`;
}

export function usesInteractiveDirectoryDiscovery(
  sources: readonly InteractiveDataStackSource[],
): boolean {
  return sources.some((source) => source.kind === "directory");
}
