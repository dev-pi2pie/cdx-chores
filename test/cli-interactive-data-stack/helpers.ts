import { expect } from "bun:test";

import { runInteractiveHarness } from "../helpers/interactive-harness";
import type {
  InteractiveHarnessResult,
  InteractiveHarnessScenario,
} from "../helpers/interactive-harness/types";

export { stripAnsi } from "../cli-actions-data-preview/helpers";

export const DEFAULT_DATA_STACK_TIMESTAMP = "20260225T000000Z";
export const DEFAULT_DATA_STACK_SOURCE = "examples/playground/stack-cases/csv-matching-headers";
export const DEFAULT_DATA_STACK_PATTERN = "*.csv";

type DataStackInteractiveHarnessScenario = Omit<InteractiveHarnessScenario, "mode"> & {
  mode?: InteractiveHarnessScenario["mode"];
};

export function runDataStackInteractiveHarness(
  scenario: DataStackInteractiveHarnessScenario,
  options: { allowFailure?: boolean } = {},
): InteractiveHarnessResult {
  return runInteractiveHarness(
    {
      mode: "run",
      requiredPathQueue: [DEFAULT_DATA_STACK_SOURCE],
      inputQueue: [DEFAULT_DATA_STACK_PATTERN],
      ...scenario,
    },
    options,
  );
}

export function dataStackDefaultOutputMatcher(
  timestamp: string,
  extension: string,
): ReturnType<typeof expect.stringMatching> {
  return expect.stringMatching(new RegExp(`data-stack-${timestamp}-[a-f0-9]{8}\\.${extension}$`));
}

export function dataStackDefaultPathPattern(timestamp: string, extension: string): RegExp {
  return new RegExp(`data-stack-${timestamp}-[a-f0-9]{8}\\.${extension}$`);
}
