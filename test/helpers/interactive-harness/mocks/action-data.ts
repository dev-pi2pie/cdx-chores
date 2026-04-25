import type { HarnessRunnerContext } from "../context";
import { applyDataStackCodexRecommendationDecisions as applyRealDataStackCodexRecommendationDecisions } from "../../../../src/cli/data-stack/codex-report";

interface ActionRuntimeLike {
  stdout: { write(chunk: string): boolean };
  stderr: { write(chunk: string): boolean };
}

interface MockStackPlanOptions {
  diagnostics?: { planDiagnostics?: { reportPath?: unknown; rowCount?: unknown } } | undefined;
  duplicatePolicy?: unknown;
  inputColumns?: unknown;
  metadata?: Record<string, unknown>;
  outputFormat?: unknown;
  outputPath?: unknown;
  prepared?: { files?: unknown[]; header?: unknown[]; rows?: unknown[] } | undefined;
  sourcePaths?: unknown;
  stackOptions?: Record<string, unknown>;
  uniqueBy?: unknown;
}

function createMockStackPlanArtifact(options: MockStackPlanOptions): Record<string, unknown> {
  return {
    command: {
      action: "stack",
      family: "data",
      replayCommand: "data stack replay",
    },
    diagnostics: {
      candidateUniqueKeys: [],
      matchedFileCount: options.prepared?.files?.length ?? 0,
      reportPath: options.diagnostics?.planDiagnostics?.reportPath ?? null,
      rowCount: options.prepared?.rows?.length ?? 0,
      schemaNameCount: options.prepared?.header?.length ?? 0,
    },
    duplicates: {
      duplicateKeyConflicts: 0,
      exactDuplicateRows: 0,
      policy: options.duplicatePolicy,
      uniqueBy: options.uniqueBy,
    },
    input: {
      columns: options.inputColumns,
      format: options.stackOptions?.inputFormat,
      headerMode: "header",
    },
    metadata: {
      acceptedRecommendationIds: [],
      artifactId: "data-stack-plan-test",
      artifactType: "data-stack-plan",
      createdBy: "test",
      derivedFromPayloadId: null,
      issuedAt: "2026-02-25T00:00:00.000Z",
      payloadId: "stack-payload-test",
      recommendationDecisions: [],
      ...options.metadata,
    },
    output: {
      format: options.outputFormat,
      overwrite: options.stackOptions?.overwrite,
      path: options.outputPath,
    },
    schema: {
      excludedNames: options.stackOptions?.excludeColumns,
      includedNames: options.prepared?.header ?? [],
      mode: options.stackOptions?.unionByName === true ? "union-by-name" : "strict",
    },
    sources: {
      baseDirectory: process.cwd(),
      maxDepth: null,
      pattern: options.stackOptions?.pattern,
      raw: options.sourcePaths,
      recursive: options.stackOptions?.recursive,
      resolved: [],
    },
    version: 1,
  };
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
    createPreparedDataStackPlan: async (options: MockStackPlanOptions) =>
      createMockStackPlanArtifact(options),
    writePreparedDataStackOutput: async (
      runtime: ActionRuntimeLike,
      options: {
        uniqueBy?: unknown;
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
        ...(Array.isArray(options.uniqueBy) && options.uniqueBy.length > 0
          ? { uniqueBy: options.uniqueBy }
          : {}),
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
    writePreparedDataStackPlan: async (
      _runtime: ActionRuntimeLike,
      options: {
        diagnostics?:
          | { planDiagnostics?: { reportPath?: unknown; rowCount?: unknown } }
          | undefined;
        duplicatePolicy?: unknown;
        inputColumns?: unknown;
        outputFormat?: unknown;
        outputPath?: unknown;
        metadata?: Record<string, unknown>;
        plan?: Record<string, unknown>;
        planPath?: unknown;
        prepared?: { files?: unknown[]; header?: unknown[]; rows?: unknown[] } | undefined;
        sourcePaths?: unknown;
        stackOptions?: Record<string, unknown>;
        uniqueBy?: unknown;
      },
    ) => {
      const planPath = String(options.planPath ?? "");
      const plan = options.plan ?? createMockStackPlanArtifact(options);
      const planDiagnostics = plan?.diagnostics as Record<string, unknown> | undefined;
      const planDuplicates = plan?.duplicates as Record<string, unknown> | undefined;
      const planMetadata =
        (plan?.metadata as Record<string, unknown> | undefined) ?? options.metadata;
      context.recordStackPlanWrite(planPath, {
        acceptedRecommendationIds: planMetadata?.acceptedRecommendationIds,
        columnCount: options.prepared?.header?.length ?? planDiagnostics?.schemaNameCount,
        derivedFromPayloadId: planMetadata?.derivedFromPayloadId,
        duplicatePolicy: planDuplicates?.policy ?? options.duplicatePolicy,
        fileCount: options.prepared?.files?.length,
        outputFormat: options.outputFormat,
        outputPath: options.outputPath,
        payloadId: planMetadata?.payloadId,
        recommendationDecisions: planMetadata?.recommendationDecisions,
        reportPath:
          planDiagnostics?.reportPath ?? options.diagnostics?.planDiagnostics?.reportPath ?? null,
        rowCount: options.prepared?.rows?.length ?? options.diagnostics?.planDiagnostics?.rowCount,
        uniqueBy: planDuplicates?.uniqueBy ?? options.uniqueBy,
      });
      return plan;
    },
    generateDataStackCodexReportFileName: () =>
      "data-stack-codex-report-20260225T000000Z-testabcd.json",
    applyDataStackCodexRecommendationDecisions: (options: {
      decisions: Array<{
        decision: "accepted" | "edited";
        patches?: Array<Record<string, unknown>>;
        recommendationId: string;
      }>;
      plan: Record<string, unknown>;
      report: {
        metadata?: { artifactId?: string };
        recommendations?: Array<Record<string, unknown>>;
      };
    }) => {
      return applyRealDataStackCodexRecommendationDecisions({
        decisions: options.decisions,
        now: new Date("2026-02-25T00:00:00.000Z"),
        plan: options.plan as never,
        report: options.report as never,
      });
    },
    suggestDataStackWithCodex: async () => {
      if (context.scenario.dataStackCodexErrorMessage) {
        throw new Error(context.scenario.dataStackCodexErrorMessage);
      }
      return {
        facts: {},
        metadata: {
          artifactId: "data-stack-codex-report-test",
          artifactType: "data-stack-codex-report",
          createdBy: "test",
          issuedAt: "2026-02-25T00:00:00.000Z",
          payloadId: "stack-codex-report-payload-test",
          planArtifactId: "data-stack-plan-test",
          planPayloadId: "stack-payload-test",
        },
        recommendations: context.scenario.dataStackCodexRecommendations ?? [],
        version: 1,
      };
    },
    writeDataStackCodexReportArtifact: async (
      path: string,
      report: { recommendations?: unknown[] },
    ) => {
      context.recordCodexReportWrite(path, {
        recommendationCount: report.recommendations?.length ?? 0,
      });
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
