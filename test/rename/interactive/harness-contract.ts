export interface RenameInteractiveHarnessScenario {
  cleanupAnalyzerEvidence?: Record<string, unknown>;
  cleanupAnalyzerSuggestion?: Record<string, unknown>;
  cleanupAnalyzerErrorMessage?: string;
  cleanupAnalyzerThrowMessage?: string;
  cleanupAnalysisReportPath?: string;
  captureCleanupSuggestInput?: boolean;
  captureCleanupCollectInput?: boolean;
  renameApplyErrorMessage?: string;
}
