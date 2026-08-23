import type { DataQueryInteractiveHarnessScenario } from "../../data-query/interactive/harness-contract";

export interface InteractiveHarnessScenario extends DataQueryInteractiveHarnessScenario {
  mode: "run" | "invalid-data-action";
  codexTimeoutMs?: number;
  captureCodexTimeouts?: boolean;
  markdownPdfMocks?: boolean;
  markdownPdfBundleRoles?: Array<"profile" | "template" | "css">;
  markdownPdfIgnoredBundleFiles?: string[];
  markdownPdfPrepareErrorMessage?: string;
  markdownPdfPrepareErrorMessages?: string[];
  markdownPdfDeterministicBindErrorMessage?: string;
  markdownPdfDeterministicWriteErrorMessages?: string[];
  markdownPdfCodexBindErrorMessage?: string;
  markdownPdfCodexFinalProfile?: Record<string, unknown>;
  markdownPdfCodexProjectHandoff?: Record<string, unknown>;
  markdownPdfCodexUnusableArtifacts?: Array<"profile" | "template-bundle" | "project-bundle">;
  markdownPdfProjectCompletenessErrorMessage?: string;
  markdownPdfRenderWarnings?: string[];
  markdownPdfNoDefaultCss?: boolean;
  markdownPdfProfilePageNumbersEnabled?: boolean;
  markdownPdfRendererCapabilityRequests?: Array<Record<string, unknown>>;
  markdownPdfRendererCapabilities?: Record<string, unknown>;
  markdownPdfRenderErrorMessages?: string[];
  markdownPdfOutputErrorMessages?: string[];
  markdownPdfCleanupErrorMessage?: string;
  markdownPdfFontFamilies?: string[];
  markdownPdfFontFamilyRuns?: string[][];
  markdownPdfFontDiscoveryErrorMessage?: string;
  selectQueue?: unknown[];
  nowIsoString?: string;
  checkboxQueue?: unknown[];
  confirmQueue?: boolean[];
  editorQueue?: string[];
  existingPaths?: string[];
  inputQueue?: string[];
  searchQueue?: Array<string | { term?: string; value: string }>;
  requiredPathQueue?: string[];
  statExistsQueue?: boolean[];
  optionalPathQueue?: Array<string | undefined>;
  dataExtractActionErrorMessage?: string;
  dataExtractActionErrorCode?: string;
  dataExtractActionStderr?: string;
  dataExtractActionStdout?: string;
  dataQueryDetectedFormat?: string;
  dataQueryIntrospection?: Record<string, unknown>;
  dataQueryIntrospectionQueue?: Record<string, unknown>[];
  dataSourceShapeSuggestion?: Record<string, unknown>;
  dataSourceShapeSuggestionErrorMessage?: string;
  dataQuerySources?: string[];
  xlsxSheetSnapshot?: Record<string, unknown>;
  dataStackActionErrorMessage?: string;
  dataStackActionErrorCode?: string;
  dataStackActionStderr?: string;
  dataStackActionStdout?: string;
  dataStackCodexErrorMessage?: string;
  dataStackCodexErrorName?: string;
  dataStackCodexRecommendations?: Array<Record<string, unknown>>;
  dataStackWriteExistingPaths?: string[];
  stdoutColumns?: number;
  stdoutIsTTY?: boolean;
  stderrIsTTY?: boolean;
  cleanupAnalyzerEvidence?: Record<string, unknown>;
  cleanupAnalyzerSuggestion?: Record<string, unknown>;
  cleanupAnalyzerErrorMessage?: string;
  cleanupAnalyzerThrowMessage?: string;
  cleanupAnalysisReportPath?: string;
  captureCleanupSuggestInput?: boolean;
  captureCleanupCollectInput?: boolean;
  renameApplyErrorMessage?: string;
}

export interface InteractiveHarnessResult {
  promptCalls: Array<{
    kind: "select" | "checkbox" | "confirm" | "input" | "editor" | "search";
    message: string;
    defaultValue?: string;
    postfix?: string;
  }>;
  selectChoicesByMessage: Record<
    string,
    Array<{ name: string; value: string; description?: string }>
  >;
  selectDefaultsByMessage: Record<string, string[]>;
  searchChoicesByMessage: Record<
    string,
    Array<{ name: string; value: string; description?: string }>
  >;
  validationCalls: Array<{ kind: "input"; message: string; value: string; error: string }>;
  pathCalls: Array<{
    kind: "required" | "optional" | "hint";
    message?: string;
    options?: Record<string, unknown>;
    inputPath?: string;
    nextExtension?: string;
  }>;
  actionCalls: Array<{ name: string; options: Record<string, unknown> }>;
  stackPlanWrites: Array<{ path: string; options: Record<string, unknown> }>;
  codexReportWrites: Array<{ path: string; options: Record<string, unknown> }>;
  removedPaths: string[];
  markdownPdfPrepareCalls: Array<Record<string, unknown>>;
  markdownPdfPlanCalls: Array<Record<string, unknown>>;
  markdownPdfExecuteCalls: Array<Record<string, unknown>>;
  markdownPdfBundleDiscoveryCalls: Array<Record<string, unknown>>;
  markdownPdfDeterministicPrepareCalls: Array<Record<string, unknown>>;
  markdownPdfDeterministicBindCalls: Array<Record<string, unknown>>;
  markdownPdfDeterministicWriteCalls: Array<Record<string, unknown>>;
  markdownPdfCodexPrepareCalls: Array<Record<string, unknown>>;
  markdownPdfCodexBindCalls: Array<Record<string, unknown>>;
  markdownPdfCodexWriteCalls: Array<Record<string, unknown>>;
  markdownPdfSessionCreateCalls: string[];
  markdownPdfSessionRetainCalls: string[];
  markdownPdfSessionCleanupCalls: string[];
  markdownPdfFontDiscoveryCalls: Array<Record<string, unknown>>;
  stdout: string;
  stderr: string;
  error?: string;
}
