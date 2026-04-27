import { randomUUID } from "node:crypto";

import {
  DATA_STACK_PLAN_CREATED_BY,
  DATA_STACK_PLAN_ARTIFACT_TYPE,
  DATA_STACK_PLAN_REPLAY_COMMAND,
  DATA_STACK_PLAN_UID_HEX_LENGTH,
  DATA_STACK_PLAN_VERSION,
  type DataStackPlanArtifact,
  type DataStackPlanIdentity,
  type DataStackPlanMetadata,
} from "./types";
import { parseDataStackPlanArtifact } from "./parse";

export function formatDataStackArtifactTimestamp(now: Date): string {
  return now
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z");
}

function createDataStackPlanUid(): string {
  // Keep filenames short while the timestamp carries most of the uniqueness budget.
  return randomUUID().replaceAll("-", "").slice(0, DATA_STACK_PLAN_UID_HEX_LENGTH);
}

export function createDataStackPlanIdentity(options: {
  now: Date;
  uid?: string;
}): DataStackPlanIdentity {
  const timestamp = formatDataStackArtifactTimestamp(options.now);
  const uid = options.uid ?? createDataStackPlanUid();
  const artifactId = `data-stack-plan-${timestamp}-${uid}`;
  const payloadId = `stack-payload-${timestamp}-${uid}`;
  return {
    artifactId,
    fileName: `${artifactId}.json`,
    payloadId,
    timestamp,
    uid,
  };
}

export function generateDataStackPlanFileName(now = new Date()): string {
  return createDataStackPlanIdentity({ now }).fileName;
}

export function createDataStackPlanArtifact(
  options: Omit<DataStackPlanArtifact, "command" | "metadata" | "version"> & {
    metadata?: Partial<
      Omit<DataStackPlanMetadata, "artifactId" | "artifactType" | "issuedAt" | "payloadId">
    > & {
      artifactId?: string;
      issuedAt?: string;
      payloadId?: string;
    };
    now: Date;
    uid?: string;
  },
): DataStackPlanArtifact {
  const identity = createDataStackPlanIdentity({ now: options.now, uid: options.uid });
  return parseDataStackPlanArtifact({
    command: {
      action: "stack",
      family: "data",
      replayCommand: DATA_STACK_PLAN_REPLAY_COMMAND,
    },
    diagnostics: options.diagnostics,
    duplicates: options.duplicates,
    input: options.input,
    metadata: {
      acceptedRecommendationIds: [
        ...(options.metadata?.acceptedRecommendationIds ??
          options.metadata?.recommendationDecisions
            ?.filter((decision) => decision.decision === "accepted")
            .map((decision) => decision.recommendationId) ??
          []),
      ],
      artifactId: options.metadata?.artifactId ?? identity.artifactId,
      artifactType: DATA_STACK_PLAN_ARTIFACT_TYPE,
      createdBy: options.metadata?.createdBy ?? DATA_STACK_PLAN_CREATED_BY,
      derivedFromPayloadId: options.metadata?.derivedFromPayloadId ?? null,
      issuedAt: options.metadata?.issuedAt ?? options.now.toISOString(),
      payloadId: options.metadata?.payloadId ?? identity.payloadId,
      recommendationDecisions: (options.metadata?.recommendationDecisions ?? []).map(
        (decision) => ({
          decision: decision.decision,
          recommendationId: decision.recommendationId,
          reportArtifactId: decision.reportArtifactId,
        }),
      ),
    },
    output: options.output,
    schema: options.schema,
    sources: options.sources,
    version: DATA_STACK_PLAN_VERSION,
  });
}
