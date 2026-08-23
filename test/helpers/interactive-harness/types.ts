import type { DataExtractInteractiveHarnessScenario } from "../../data-extract/interactive/harness-contract";
import type { DataQueryInteractiveHarnessScenario } from "../../data-query/interactive/harness-contract";
import type {
  DataStackInteractiveHarnessResult,
  DataStackInteractiveHarnessScenario,
} from "../../data-stack/interactive/harness-contract";

export interface SourceShapeSuggestionOptions {
  currentHeaderRow?: unknown;
  currentRange?: unknown;
  timeoutMs?: unknown;
  context?: {
    currentIntrospection?: { selectedSource?: unknown };
    sheetSnapshot?: { sheetName?: unknown };
  };
}

export interface InteractiveHarnessScenario
  extends
    DataExtractInteractiveHarnessScenario,
    DataQueryInteractiveHarnessScenario,
    DataStackInteractiveHarnessScenario {
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
  dataQueryDetectedFormat?: string;
  dataQueryIntrospection?: Record<string, unknown>;
  dataQueryIntrospectionQueue?: Record<string, unknown>[];
  dataSourceShapeSuggestion?: Record<string, unknown>;
  dataSourceShapeSuggestionErrorMessage?: string;
  dataQuerySources?: string[];
  xlsxSheetSnapshot?: Record<string, unknown>;
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

export interface InteractiveHarnessResult extends DataStackInteractiveHarnessResult {
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
