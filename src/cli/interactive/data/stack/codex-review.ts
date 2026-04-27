import { editor, select } from "@inquirer/prompts";

import {
  applyDataStackCodexRecommendationDecisions,
  formatDataStackCodexAssistFailure,
  generateDataStackCodexReportFileName,
  suggestDataStackWithCodex,
  type DataStackCodexPatch,
  type DataStackCodexRecommendation,
  type DataStackCodexRecommendationDecisionInput,
  type DataStackCodexReportArtifact,
} from "../../../actions";
import { displayPath, printLine } from "../../../actions/shared";
import { createInteractiveAnalyzerStatus } from "../../analyzer-status";
import { computeDataStackDiagnostics } from "../../../data-stack/diagnostics";
import {
  formatDataStackCodexAssistSignal,
  getDataStackCodexAssistSignals,
  type DataStackCodexAssistSignal,
} from "../../../data-stack/codex-signals";
import type { DataStackPlanArtifact } from "../../../data-stack/plan";
import { resolveFromCwd } from "../../../path-utils";
import type { CliRuntime } from "../../../types";

import { createInteractiveStackPlanArtifact, getInteractiveStackPlanMetadata } from "./artifacts";
import { prepareInteractiveStackPreviewState } from "./review";
import {
  INTERACTIVE_DATA_STACK_CODEX_TIMEOUT_MS,
  INTERACTIVE_DATA_STACK_UNIQUE_BY,
  type InteractiveDataStackPreviewState,
  type InteractiveDataStackReviewedPlan,
} from "./types";

function renderInteractiveCodexRecommendations(
  runtime: CliRuntime,
  recommendations: readonly DataStackCodexRecommendation[],
): void {
  printLine(runtime.stderr, "Codex recommendations");
  if (recommendations.length === 0) {
    printLine(runtime.stderr, "- none");
    return;
  }
  for (const recommendation of recommendations) {
    printLine(
      runtime.stderr,
      `- ${recommendation.id}: ${recommendation.title} (${Math.round(recommendation.confidence * 100)}%)`,
    );
    printLine(runtime.stderr, `  ${recommendation.reasoningSummary}`);
    for (const patch of recommendation.patches) {
      printLine(runtime.stderr, `  ${patch.path}: ${JSON.stringify(patch.value)}`);
    }
  }
}

export function getInteractiveStackCodexAssistSignals(
  state: InteractiveDataStackPreviewState,
): DataStackCodexAssistSignal[] {
  const plan = state.planArtifact;
  const uniqueBy = plan?.duplicates.uniqueBy ?? INTERACTIVE_DATA_STACK_UNIQUE_BY;

  return getDataStackCodexAssistSignals({
    diagnostics: state.diagnostics,
    headerMode: plan?.input.headerMode ?? "header",
    inputColumns: plan?.input.columns ?? state.prepared.header,
    schemaMode: plan?.schema.mode ?? state.resolvedSchemaMode,
    uniqueBy,
  });
}

export function createInteractiveStackCodexSignalKey(
  state: InteractiveDataStackPreviewState,
  signals: readonly DataStackCodexAssistSignal[],
): string {
  const uniqueBy = state.planArtifact?.duplicates.uniqueBy ?? INTERACTIVE_DATA_STACK_UNIQUE_BY;
  return JSON.stringify({
    duplicateKeyConflicts: state.diagnostics.duplicateSummary.duplicateKeyConflicts,
    exactDuplicateRows: state.diagnostics.duplicateSummary.exactDuplicateRows,
    header: state.prepared.header,
    schemaMode: state.planArtifact?.schema.mode ?? state.resolvedSchemaMode,
    signals,
    uniqueBy,
  });
}

export async function promptInteractiveStackCodexCheckpoint(
  runtime: CliRuntime,
  signals: readonly DataStackCodexAssistSignal[],
): Promise<"codex" | "continue" | "review" | "cancel"> {
  printLine(runtime.stderr, "Codex-powered analysis checkpoint");
  printLine(
    runtime.stderr,
    `- signals: ${signals.map(formatDataStackCodexAssistSignal).join(", ")}`,
  );

  return await select<"codex" | "continue" | "review" | "cancel">({
    message: "Codex-powered analysis checkpoint",
    choices: [
      {
        name: "Analyze with Codex",
        value: "codex",
        description: "Ask for advisory schema, key, and duplicate-policy suggestions",
      },
      {
        name: "Continue without Codex",
        value: "continue",
        description: "Keep the deterministic stack setup and choose a final action",
      },
      {
        name: "Revise setup",
        value: "review",
        description: "Choose a different source, pattern, traversal, or schema mode",
      },
      {
        name: "Cancel",
        value: "cancel",
        description: "Stop before writing the stacked output",
      },
    ],
  });
}

function renderInteractiveAcceptedCodexChanges(
  runtime: CliRuntime,
  plan: DataStackPlanArtifact,
): void {
  printLine(runtime.stderr, "Accepted Codex changes");
  printLine(runtime.stderr, `- output columns: ${plan.schema.includedNames.join(", ")}`);
  printLine(
    runtime.stderr,
    `- excluded columns: ${plan.schema.excludedNames.length > 0 ? plan.schema.excludedNames.join(", ") : "none"}`,
  );
  printLine(
    runtime.stderr,
    `- unique key: ${plan.duplicates.uniqueBy.length > 0 ? plan.duplicates.uniqueBy.join(", ") : "not selected"}`,
  );
  printLine(runtime.stderr, `- duplicate policy: ${plan.duplicates.policy}`);
}

function parseEditedCodexPatches(value: string): DataStackCodexPatch[] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Edited patches must be a JSON array.");
  }
  return parsed as DataStackCodexPatch[];
}

async function reviewInteractiveCodexRecommendations(
  runtime: CliRuntime,
  report: DataStackCodexReportArtifact,
): Promise<DataStackCodexRecommendationDecisionInput[]> {
  const decisions: DataStackCodexRecommendationDecisionInput[] = [];
  for (const recommendation of report.recommendations) {
    printLine(runtime.stderr, "");
    printLine(runtime.stderr, `Recommendation ${recommendation.id}: ${recommendation.title}`);
    printLine(runtime.stderr, recommendation.reasoningSummary);
    for (const patch of recommendation.patches) {
      printLine(runtime.stderr, `- ${patch.path}: ${JSON.stringify(patch.value)}`);
    }

    const action = await select<"accept" | "edit" | "skip" | "cancel">({
      message: "Codex recommendation review",
      choices: [
        {
          name: "Accept recommendation",
          value: "accept",
          description: "Apply this recommendation to the deterministic stack plan",
        },
        {
          name: "Edit patches",
          value: "edit",
          description: "Edit this recommendation's JSON patches before applying",
        },
        {
          name: "Skip recommendation",
          value: "skip",
          description: "Leave this recommendation out of the stack plan",
        },
        {
          name: "Cancel review",
          value: "cancel",
          description: "Stop reviewing recommendations and keep the current stack setup",
        },
      ],
    });

    if (action === "cancel") {
      return [];
    }
    if (action === "skip") {
      continue;
    }
    if (action === "accept") {
      decisions.push({ decision: "accepted", recommendationId: recommendation.id });
      continue;
    }

    const edited = await editor({
      message: "Edit recommendation patches JSON",
      default: JSON.stringify(recommendation.patches, null, 2),
      postfix: ".json",
      validate: (value) => {
        try {
          parseEditedCodexPatches(String(value ?? ""));
          return true;
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      },
    });
    decisions.push({
      decision: "edited",
      recommendationId: recommendation.id,
      patches: parseEditedCodexPatches(edited),
    });
  }
  return decisions;
}

export async function requestInteractiveStackCodexReview(
  runtime: CliRuntime,
  state: InteractiveDataStackPreviewState,
): Promise<InteractiveDataStackReviewedPlan | undefined> {
  const reportPath = resolveFromCwd(runtime, generateDataStackCodexReportFileName(runtime.now()));
  const diagnosticsWithReport = computeDataStackDiagnostics({
    header: state.prepared.header,
    matchedFileCount: state.prepared.files.length,
    reportPath,
    rows: state.prepared.rows,
    uniqueBy: state.planArtifact?.duplicates.uniqueBy ?? INTERACTIVE_DATA_STACK_UNIQUE_BY,
  });
  const plan = await createInteractiveStackPlanArtifact(runtime, {
    ...state,
    diagnostics: diagnosticsWithReport,
    planWriteOptions: {
      ...state.planWriteOptions,
      diagnostics: diagnosticsWithReport,
    },
  });

  const status = createInteractiveAnalyzerStatus(runtime.stdout, runtime.colorEnabled);
  let report: DataStackCodexReportArtifact;
  try {
    status.wait("Waiting for Codex stack recommendations");
    report = await suggestDataStackWithCodex({
      diagnostics: diagnosticsWithReport,
      now: runtime.now(),
      plan,
      timeoutMs: INTERACTIVE_DATA_STACK_CODEX_TIMEOUT_MS,
      workingDirectory: runtime.cwd,
    });
  } catch (error) {
    printLine(runtime.stderr, formatDataStackCodexAssistFailure(error));
    printLine(runtime.stderr, "Keeping current deterministic stack setup.");
    return undefined;
  } finally {
    status.stop();
  }

  printLine(
    runtime.stderr,
    `Codex assist: prepared advisory report ${displayPath(runtime, reportPath)}`,
  );
  renderInteractiveCodexRecommendations(runtime, report.recommendations);
  const decisions = await reviewInteractiveCodexRecommendations(runtime, report);
  if (decisions.length === 0) {
    printLine(runtime.stderr, "No Codex recommendations accepted.");
    return {
      plan,
      report: {
        artifact: report,
        path: reportPath,
      },
    };
  }

  try {
    const appliedPlan = applyDataStackCodexRecommendationDecisions({
      decisions,
      now: runtime.now(),
      plan,
      report,
    });
    const nextState = await prepareInteractiveStackPreviewState({
      outputPath: state.outputPath,
      outputPlan: state.plan,
      planArtifact: appliedPlan,
      runtime,
      setup: state.setup,
    });
    const nextPlan = await createInteractiveStackPlanArtifact(
      runtime,
      nextState,
      getInteractiveStackPlanMetadata(appliedPlan),
    );
    renderInteractiveAcceptedCodexChanges(runtime, nextPlan);
    printLine(runtime.stderr, "Re-running stack status preview with accepted Codex changes.");
    return {
      plan: nextPlan,
      report: {
        artifact: report,
        path: reportPath,
      },
    };
  } catch (error) {
    printLine(
      runtime.stderr,
      `Codex recommendation application failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    printLine(runtime.stderr, "Keeping current deterministic stack setup.");
    return {
      plan,
      report: {
        artifact: report,
        path: reportPath,
      },
    };
  }
}
