import { dirname, resolve as resolvePath } from "node:path";

import { createDataStackInteractiveHarnessResultState } from "../../data-stack/interactive/harness-contract";
import { createMarkdownPdfInteractiveHarnessResultState } from "../../markdown-pdf/interactive/harness-contract";
import type { InteractiveHarnessResult, InteractiveHarnessScenario } from "./types";

type InteractiveHarnessResultState = Omit<InteractiveHarnessResult, "stdout" | "stderr" | "error">;

export interface HarnessRunnerContext {
  scenario: InteractiveHarnessScenario;
  result: InteractiveHarnessResultState;
  existingPaths: Set<string>;
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
  recordRemovedPath(path: string): void;
}

function createInteractiveHarnessResultState(): InteractiveHarnessResultState {
  return {
    promptCalls: [],
    selectChoicesByMessage: {},
    selectDefaultsByMessage: {},
    searchChoicesByMessage: {},
    validationCalls: [],
    pathCalls: [],
    actionCalls: [],
    removedPaths: [],
    ...createDataStackInteractiveHarnessResultState(),
    ...createMarkdownPdfInteractiveHarnessResultState(),
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
  const statExistsQueue = [...(scenario.statExistsQueue ?? [])];
  const recordAction = (name: string, options: Record<string, unknown>): void => {
    result.actionCalls.push({ name, options });
  };
  const recordRemovedPath = (path: string): void => {
    result.removedPaths.push(path);
  };

  return {
    scenario,
    result,
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
    recordRemovedPath,
  };
}
