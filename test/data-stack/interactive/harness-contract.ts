export interface DataStackInteractiveHarnessScenario {
  dataStackActionErrorMessage?: string;
  dataStackActionErrorCode?: string;
  dataStackActionStderr?: string;
  dataStackActionStdout?: string;
  dataStackCodexErrorMessage?: string;
  dataStackCodexErrorName?: string;
  dataStackCodexRecommendations?: Array<Record<string, unknown>>;
  dataStackWriteExistingPaths?: string[];
}

export interface DataStackInteractiveHarnessResult {
  stackPlanWrites: Array<{ path: string; options: Record<string, unknown> }>;
  codexReportWrites: Array<{ path: string; options: Record<string, unknown> }>;
}

export function createDataStackInteractiveHarnessResultState(): DataStackInteractiveHarnessResult {
  return {
    stackPlanWrites: [],
    codexReportWrites: [],
  };
}
