import type { HarnessRunnerContext } from "../context";
import type {
  DataStackDuplicatePolicy,
  DataStackPlanArtifact,
  DataStackPlanMetadata,
} from "../../../../src/cli/data-stack/plan";
import type {
  DataStackInputFormat,
  DataStackOutputFormat,
  DataStackSchemaMode,
} from "../../../../src/cli/data-stack/types";
import { applyDataStackCodexRecommendationDecisions as applyRealDataStackCodexRecommendationDecisions } from "../../../../src/cli/data-stack/codex-report";
import { formatDataStackCodexAssistFailure as formatRealDataStackCodexAssistFailure } from "../../../../src/cli/data-stack/codex-assist";

import {
  createOutputExistsError,
  resolveOutputPath,
  type ActionRuntimeLike,
} from "./action-data-shared";

interface MockStackPlanOptions {
  diagnostics?: { planDiagnostics?: { reportPath?: unknown; rowCount?: unknown } } | undefined;
  duplicatePolicy?: unknown;
  inputColumns?: unknown;
  metadata?: Record<string, unknown>;
  outputFormat?: unknown;
  outputPath?: unknown;
  prepared?:
    | { files?: unknown[]; header?: unknown[]; rows?: unknown[]; schemaMode?: unknown }
    | undefined;
  sourcePaths?: unknown;
  stackOptions?: Record<string, unknown>;
  uniqueBy?: unknown;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function createMockStackPlanArtifact(options: MockStackPlanOptions): DataStackPlanArtifact {
  const metadata = options.metadata as Partial<DataStackPlanMetadata> | undefined;
  const stackOptions = options.stackOptions ?? {};
  const schemaMode: DataStackSchemaMode =
    options.prepared?.schemaMode === "union-by-name" ||
    stackOptions.schemaMode === "union-by-name" ||
    stackOptions.unionByName === true
      ? "union-by-name"
      : "strict";

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
      policy:
        typeof options.duplicatePolicy === "string"
          ? (options.duplicatePolicy as DataStackDuplicatePolicy)
          : "preserve",
      uniqueBy: toStringArray(options.uniqueBy),
    },
    input: {
      columns: toStringArray(options.inputColumns),
      format:
        typeof stackOptions.inputFormat === "string"
          ? (stackOptions.inputFormat as DataStackInputFormat)
          : "csv",
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
      ...metadata,
    },
    output: {
      format:
        typeof options.outputFormat === "string"
          ? (options.outputFormat as DataStackOutputFormat)
          : "json",
      overwrite: stackOptions.overwrite === true,
      path: typeof options.outputPath === "string" ? options.outputPath : null,
    },
    schema: {
      excludedNames: toStringArray(stackOptions.excludeColumns),
      includedNames: toStringArray(options.prepared?.header),
      mode: schemaMode,
    },
    sources: {
      baseDirectory: process.cwd(),
      maxDepth: null,
      pattern: typeof stackOptions.pattern === "string" ? stackOptions.pattern : null,
      raw: toStringArray(options.sourcePaths),
      recursive: stackOptions.recursive === true,
      resolved: [],
    },
    version: 1,
  };
}

export function createStackActionMocks(context: HarnessRunnerContext) {
  return {
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

      if (
        typeof options.outputPath === "string" &&
        (context.existingPaths.has(options.outputPath) ||
          context.dataStackWriteExistingPaths.has(options.outputPath))
      ) {
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
        plan?: DataStackPlanArtifact;
        planPath?: unknown;
        prepared?:
          | { files?: unknown[]; header?: unknown[]; rows?: unknown[]; schemaMode?: unknown }
          | undefined;
        sourcePaths?: unknown;
        stackOptions?: Record<string, unknown>;
        uniqueBy?: unknown;
      },
    ) => {
      const planPath = String(options.planPath ?? "");
      const plan = options.plan ?? createMockStackPlanArtifact(options);
      const planDiagnostics = plan.diagnostics;
      const planDuplicates = plan.duplicates;
      const planMetadata = plan.metadata;
      context.recordStackPlanWrite(planPath, {
        acceptedRecommendationIds: planMetadata.acceptedRecommendationIds,
        columnCount: options.prepared?.header?.length ?? planDiagnostics.schemaNameCount,
        derivedFromPayloadId: planMetadata.derivedFromPayloadId,
        duplicatePolicy: planDuplicates.policy ?? options.duplicatePolicy,
        fileCount: options.prepared?.files?.length,
        inputFormat: plan.input.format,
        outputFormat: options.outputFormat,
        outputPath: options.outputPath,
        payloadId: planMetadata.payloadId,
        pattern: plan.sources.pattern,
        recommendationDecisions: planMetadata.recommendationDecisions,
        recursive: plan.sources.recursive,
        reportPath:
          planDiagnostics.reportPath ?? options.diagnostics?.planDiagnostics?.reportPath ?? null,
        rowCount: options.prepared?.rows?.length ?? options.diagnostics?.planDiagnostics?.rowCount,
        schemaMode: plan.schema.mode,
        uniqueBy: planDuplicates.uniqueBy ?? options.uniqueBy,
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
      plan: DataStackPlanArtifact;
      report: {
        metadata?: { artifactId?: string };
        recommendations?: Array<Record<string, unknown>>;
      };
    }) => {
      return applyRealDataStackCodexRecommendationDecisions({
        decisions: options.decisions,
        now: new Date("2026-02-25T00:00:00.000Z"),
        plan: options.plan,
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
    formatDataStackCodexAssistFailure: formatRealDataStackCodexAssistFailure,
    writeDataStackCodexReportArtifact: async (
      path: string,
      report: { recommendations?: unknown[] },
    ) => {
      context.recordCodexReportWrite(path, {
        recommendationCount: report.recommendations?.length ?? 0,
      });
    },
  };
}
