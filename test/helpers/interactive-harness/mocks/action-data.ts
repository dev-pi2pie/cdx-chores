import type { HarnessRunnerContext } from "../context";

import {
  createOutputExistsError,
  resolveOutputPath,
  type ActionRuntimeLike,
} from "./action-data-shared";

export function createDataActionMocks(context: HarnessRunnerContext) {
  return {
    actionDataExtract: async (runtime: ActionRuntimeLike, options: Record<string, unknown>) => {
      context.recordAction("data:extract", options);

      if (typeof context.scenario.dataExtractActionStdout === "string") {
        runtime.stdout.write(context.scenario.dataExtractActionStdout);
      }
      if (typeof context.scenario.dataExtractActionStderr === "string") {
        runtime.stderr.write(context.scenario.dataExtractActionStderr);
      }

      const outputPath = resolveOutputPath(context, options);
      if (outputPath && context.existingPaths.has(outputPath) && options.overwrite !== true) {
        throw createOutputExistsError(outputPath);
      }

      if (context.scenario.dataExtractActionErrorMessage) {
        const error = new Error(context.scenario.dataExtractActionErrorMessage) as Error & {
          code: string;
        };
        error.code = context.scenario.dataExtractActionErrorCode ?? "DATA_EXTRACT_FAILED";
        throw error;
      }
    },
    actionDataQuery: async (runtime: ActionRuntimeLike, options: Record<string, unknown>) => {
      context.recordAction("data:query", options);

      if (typeof context.scenario.dataQueryActionStdout === "string") {
        runtime.stdout.write(context.scenario.dataQueryActionStdout);
      }
      if (typeof context.scenario.dataQueryActionStderr === "string") {
        runtime.stderr.write(context.scenario.dataQueryActionStderr);
      }

      const outputPath = resolveOutputPath(context, options);
      if (outputPath && context.existingPaths.has(outputPath) && options.overwrite !== true) {
        throw createOutputExistsError(outputPath);
      }

      if (context.scenario.dataQueryActionErrorMessage) {
        const error = new Error(context.scenario.dataQueryActionErrorMessage) as Error & {
          code: string;
        };
        error.code = context.scenario.dataQueryActionErrorCode ?? "DATA_QUERY_FAILED";
        throw error;
      }
    },
  };
}
