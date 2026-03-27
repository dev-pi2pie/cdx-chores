import { mock } from "bun:test";

import type { HarnessRunnerContext } from "../context";
import { pathConfigModuleUrl, pathModuleUrl } from "../module-urls";

interface OptionalPathPromptOptions {
  message?: unknown;
  [key: string]: unknown;
}

interface RequiredPathPromptOptions {
  [key: string]: unknown;
}

export function installPathPromptMocks(context: HarnessRunnerContext): void {
  mock.module(pathModuleUrl, () => ({
    formatDefaultOutputPathHint: (
      _runtime: unknown,
      inputPath: unknown,
      nextExtension: unknown,
    ) => {
      context.result.pathCalls.push({
        kind: "hint",
        inputPath: String(inputPath ?? ""),
        nextExtension: String(nextExtension ?? ""),
      });
      return `${String(inputPath ?? "")}${String(nextExtension ?? "")}`;
    },
    promptOptionalOutputPathChoice: async (options: OptionalPathPromptOptions) => {
      const message = String(options.message ?? "");
      context.result.pathCalls.push({
        kind: "optional",
        message,
        options,
      });
      return context.shiftQueueValue(
        context.scenario.optionalPathQueue ?? [],
        `optional:${message}`,
      );
    },
    promptRequiredPathWithConfig: async (message: unknown, options: RequiredPathPromptOptions) => {
      const resolvedMessage = String(message ?? "");
      context.result.pathCalls.push({
        kind: "required",
        message: resolvedMessage,
        options,
      });
      return context.shiftQueueValue(
        context.scenario.requiredPathQueue ?? [],
        `required:${resolvedMessage}`,
      );
    },
  }));

  mock.module(pathConfigModuleUrl, () => ({
    resolvePathPromptRuntimeConfig: () => context.mockedPathPromptRuntimeConfig,
  }));
}
