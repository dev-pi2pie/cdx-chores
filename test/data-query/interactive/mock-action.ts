import type { HarnessRunnerContext } from "../../cli-foundations/interactive-harness/context";

import {
  createOutputExistsError,
  resolveOutputPath,
  type ActionRuntimeLike,
} from "../../cli-foundations/interactive-harness/action-output";

export function createDataQueryActionMock(context: HarnessRunnerContext) {
  return {
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
