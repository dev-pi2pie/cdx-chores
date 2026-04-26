import { dirname, resolve as resolvePath } from "node:path";

import type { InteractiveHarnessResult, InteractiveHarnessScenario } from "./types";

type InteractiveHarnessResultState = Omit<InteractiveHarnessResult, "stdout" | "stderr" | "error">;

export interface HarnessRunnerContext {
  scenario: InteractiveHarnessScenario;
  result: InteractiveHarnessResultState;
  existingPaths: Set<string>;
  dataStackWriteExistingPaths: Set<string>;
  statExistsQueue: boolean[];
  mockedPathPromptRuntimeConfig: {
    mode: "auto";
    autocomplete: {
      enabled: boolean;
      minChars: number;
      maxSuggestions: number;
      includeHidden: boolean;
    };
  };
  shiftQueueValue<T>(queue: T[], label: string): T;
  resolveHarnessPath(inputPath: unknown): string;
  directoryPathForFile(inputPath: unknown): string;
  recordAction(name: string, options: Record<string, unknown>): void;
  recordStackPlanWrite(path: string, options: Record<string, unknown>): void;
  recordCodexReportWrite(path: string, options: Record<string, unknown>): void;
  recordRemovedPath(path: string): void;
}

function createInteractiveHarnessResultState(): InteractiveHarnessResultState {
  return {
    promptCalls: [],
    selectChoicesByMessage: {},
    validationCalls: [],
    pathCalls: [],
    actionCalls: [],
    stackPlanWrites: [],
    codexReportWrites: [],
    removedPaths: [],
  };
}

export function createHarnessRunnerContext(
  scenario: InteractiveHarnessScenario,
): HarnessRunnerContext {
  const result = createInteractiveHarnessResultState();
  const resolveHarnessPath = (inputPath: unknown): string =>
    resolvePath(process.cwd(), String(inputPath ?? ""));
  const existingPaths = new Set(
    (scenario.existingPaths ?? []).map((item) => resolveHarnessPath(item)),
  );
  const dataStackWriteExistingPaths = new Set(
    (scenario.dataStackWriteExistingPaths ?? []).map((item) => resolveHarnessPath(item)),
  );
  const statExistsQueue = [...(scenario.statExistsQueue ?? [])];
  const recordAction = (name: string, options: Record<string, unknown>): void => {
    result.actionCalls.push({ name, options });
  };
  const recordStackPlanWrite = (path: string, options: Record<string, unknown>): void => {
    result.stackPlanWrites.push({ path, options });
  };
  const recordCodexReportWrite = (path: string, options: Record<string, unknown>): void => {
    result.codexReportWrites.push({ path, options });
  };
  const recordRemovedPath = (path: string): void => {
    result.removedPaths.push(path);
  };

  return {
    scenario,
    result,
    dataStackWriteExistingPaths,
    existingPaths,
    statExistsQueue,
    mockedPathPromptRuntimeConfig: {
      mode: "auto",
      autocomplete: {
        enabled: true,
        minChars: 1,
        maxSuggestions: 12,
        includeHidden: false,
      },
    },
    shiftQueueValue<T>(queue: T[], label: string): T {
      if (queue.length === 0) {
        throw new Error(`Missing queued value for ${label}`);
      }
      return queue.shift() as T;
    },
    resolveHarnessPath,
    directoryPathForFile(inputPath: unknown): string {
      return dirname(resolveHarnessPath(inputPath));
    },
    recordAction,
    recordStackPlanWrite,
    recordCodexReportWrite,
    recordRemovedPath,
  };
}
