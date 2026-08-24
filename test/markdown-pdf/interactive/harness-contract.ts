export interface MarkdownPdfInteractiveHarnessScenario {
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
}

export interface MarkdownPdfInteractiveHarnessResult {
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
}

export function createMarkdownPdfInteractiveHarnessResultState(): MarkdownPdfInteractiveHarnessResult {
  return {
    markdownPdfPrepareCalls: [],
    markdownPdfPlanCalls: [],
    markdownPdfExecuteCalls: [],
    markdownPdfBundleDiscoveryCalls: [],
    markdownPdfDeterministicPrepareCalls: [],
    markdownPdfDeterministicBindCalls: [],
    markdownPdfDeterministicWriteCalls: [],
    markdownPdfCodexPrepareCalls: [],
    markdownPdfCodexBindCalls: [],
    markdownPdfCodexWriteCalls: [],
    markdownPdfSessionCreateCalls: [],
    markdownPdfSessionRetainCalls: [],
    markdownPdfSessionCleanupCalls: [],
    markdownPdfFontDiscoveryCalls: [],
  };
}
