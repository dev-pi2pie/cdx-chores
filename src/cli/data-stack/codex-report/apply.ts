import { CliError } from "../../errors";
import { createDataStackPlanArtifact, type DataStackPlanArtifact } from "../plan";
import {
  type DataStackCodexRecommendationDecisionInput,
  type DataStackCodexReportArtifact,
} from "./types";
import { applyPatchToPlan, validateDataStackCodexPatch } from "./validation";

export function applyDataStackCodexRecommendationDecisions(options: {
  decisions: readonly DataStackCodexRecommendationDecisionInput[];
  now: Date;
  plan: DataStackPlanArtifact;
  report: DataStackCodexReportArtifact;
}): DataStackPlanArtifact {
  const recommendationsById = new Map(
    options.report.recommendations.map((recommendation) => [recommendation.id, recommendation]),
  );
  const patchPaths = new Set<string>();
  let nextPlan = options.plan;
  const decisions = options.decisions.map((decision) => {
    const recommendation = recommendationsById.get(decision.recommendationId);
    if (!recommendation) {
      throw new CliError(`Unknown data stack Codex recommendation: ${decision.recommendationId}.`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    const patches =
      decision.decision === "edited" ? (decision.patches ?? []) : recommendation.patches;
    if (patches.length === 0) {
      throw new CliError(
        `Data stack Codex recommendation ${decision.recommendationId} has no patches to apply.`,
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }
    for (const patch of patches) {
      const validated = validateDataStackCodexPatch(nextPlan, patch);
      if (patchPaths.has(validated.path)) {
        throw new CliError(`Conflicting data stack Codex patches for ${validated.path}.`, {
          code: "INVALID_INPUT",
          exitCode: 2,
        });
      }
      patchPaths.add(validated.path);
      nextPlan = applyPatchToPlan(nextPlan, validated);
    }
    return {
      decision: decision.decision,
      recommendationId: decision.recommendationId,
      reportArtifactId: options.report.metadata.artifactId,
    };
  });

  return createDataStackPlanArtifact({
    diagnostics: nextPlan.diagnostics,
    duplicates: nextPlan.duplicates,
    input: nextPlan.input,
    metadata: {
      createdBy: nextPlan.metadata.createdBy,
      derivedFromPayloadId: options.plan.metadata.payloadId,
      recommendationDecisions: [...options.plan.metadata.recommendationDecisions, ...decisions],
    },
    now: options.now,
    output: nextPlan.output,
    schema: nextPlan.schema,
    sources: nextPlan.sources,
  });
}
