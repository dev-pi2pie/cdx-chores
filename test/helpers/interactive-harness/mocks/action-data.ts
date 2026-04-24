import type { HarnessRunnerContext } from "../context";

interface ActionRuntimeLike {
  stdout: { write(chunk: string): boolean };
  stderr: { write(chunk: string): boolean };
}

function resolveOutputPath(
  context: HarnessRunnerContext,
  options: Record<string, unknown>,
): string | undefined {
  if (typeof options.output !== "string" || options.output.length === 0) {
    return undefined;
  }

  return context.resolveHarnessPath(options.output);
}

function createOutputExistsError(outputPath: string): Error & { code: string } {
  const error = new Error(
    `Output file already exists: ${outputPath}. Use --overwrite to replace it.`,
  ) as Error & { code: string };
  error.code = "OUTPUT_EXISTS";
  return error;
}

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
    actionDataStack: async (runtime: ActionRuntimeLike, options: Record<string, unknown>) => {
      context.recordAction("data:stack", options);

      if (typeof context.scenario.dataStackActionStdout === "string") {
        runtime.stdout.write(context.scenario.dataStackActionStdout);
      }
      if (typeof context.scenario.dataStackActionStderr === "string") {
        runtime.stderr.write(context.scenario.dataStackActionStderr);
      }

      const outputPath = resolveOutputPath(context, options);
      if (outputPath && context.existingPaths.has(outputPath) && options.overwrite !== true) {
        throw createOutputExistsError(outputPath);
      }

      if (context.scenario.dataStackActionErrorMessage) {
        const error = new Error(context.scenario.dataStackActionErrorMessage) as Error & {
          code: string;
        };
        error.code = context.scenario.dataStackActionErrorCode ?? "DATA_STACK_FAILED";
        throw error;
      }
    },
    writePreparedDataStackOutput: async (
      runtime: ActionRuntimeLike,
      options: {
        outputFormat?: unknown;
        outputPath?: unknown;
        overwrite?: unknown;
        prepared?: { files?: unknown[]; rows?: unknown[] } | undefined;
      },
    ) => {
      context.recordAction("data:stack", {
        fileCount: options.prepared?.files?.length,
        outputFormat: options.outputFormat,
        outputPath: options.outputPath,
        overwrite: options.overwrite,
        rowCount: options.prepared?.rows?.length,
      });

      if (typeof context.scenario.dataStackActionStdout === "string") {
        runtime.stdout.write(context.scenario.dataStackActionStdout);
      }
      if (typeof context.scenario.dataStackActionStderr === "string") {
        runtime.stderr.write(context.scenario.dataStackActionStderr);
      }

      if (typeof options.outputPath === "string" && context.existingPaths.has(options.outputPath)) {
        if (options.overwrite !== true) {
          throw createOutputExistsError(String(options.outputPath));
        }
      }

      if (context.scenario.dataStackActionErrorMessage) {
        const error = new Error(context.scenario.dataStackActionErrorMessage) as Error & {
          code: string;
        };
        error.code = context.scenario.dataStackActionErrorCode ?? "DATA_STACK_FAILED";
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
