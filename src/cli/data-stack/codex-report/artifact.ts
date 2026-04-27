import { randomUUID } from "node:crypto";

import { writeTextFileSafe } from "../../file-io";
import type { DataStackDiagnosticsResult } from "../diagnostics";
import { formatDataStackArtifactTimestamp, type DataStackPlanArtifact } from "../plan";
import {
  DATA_STACK_CODEX_REPORT_ARTIFACT_TYPE,
  DATA_STACK_CODEX_REPORT_CREATED_BY,
  DATA_STACK_CODEX_REPORT_UID_HEX_LENGTH,
  DATA_STACK_CODEX_REPORT_VERSION,
  type DataStackCodexFactPayload,
  type DataStackCodexRecommendation,
  type DataStackCodexReportArtifact,
} from "./types";
import { validateDataStackCodexRecommendations } from "./validation";

function createDataStackCodexReportUid(): string {
  return randomUUID().replaceAll("-", "").slice(0, DATA_STACK_CODEX_REPORT_UID_HEX_LENGTH);
}

export function generateDataStackCodexReportFileName(now = new Date()): string {
  return `data-stack-codex-report-${formatDataStackArtifactTimestamp(now)}-${createDataStackCodexReportUid()}.json`;
}

export function buildDataStackCodexFactPayload(options: {
  diagnostics: DataStackDiagnosticsResult;
  plan: DataStackPlanArtifact;
}): DataStackCodexFactPayload {
  return {
    diagnostics: {
      candidateUniqueKeys: options.plan.diagnostics.candidateUniqueKeys,
      columnSummaries: options.diagnostics.columnSummaries,
      duplicateKeyNullRows: options.diagnostics.duplicateKeyNullRows,
      duplicateSummary: options.diagnostics.duplicateSummary,
      matchedFileCount: options.plan.diagnostics.matchedFileCount,
      rowCount: options.plan.diagnostics.rowCount,
      schemaNameCount: options.plan.diagnostics.schemaNameCount,
    },
    duplicates: options.plan.duplicates,
    input: options.plan.input,
    output: options.plan.output,
    schema: options.plan.schema,
    sources: {
      baseDirectory: options.plan.sources.baseDirectory,
      pattern: options.plan.sources.pattern,
      recursive: options.plan.sources.recursive,
      resolvedSample: options.plan.sources.resolved.slice(0, 12).map((source) => source.path),
      totalResolved: options.plan.sources.resolved.length,
    },
  };
}

export function createDataStackCodexReportArtifact(options: {
  diagnostics: DataStackDiagnosticsResult;
  now: Date;
  plan: DataStackPlanArtifact;
  recommendations: readonly DataStackCodexRecommendation[];
  uid?: string;
}): DataStackCodexReportArtifact {
  const timestamp = formatDataStackArtifactTimestamp(options.now);
  const uid = options.uid ?? createDataStackCodexReportUid();
  const artifactId = `data-stack-codex-report-${timestamp}-${uid}`;
  const payloadId = `stack-codex-report-payload-${timestamp}-${uid}`;
  return {
    facts: buildDataStackCodexFactPayload({
      diagnostics: options.diagnostics,
      plan: options.plan,
    }),
    metadata: {
      artifactId,
      artifactType: DATA_STACK_CODEX_REPORT_ARTIFACT_TYPE,
      createdBy: DATA_STACK_CODEX_REPORT_CREATED_BY,
      issuedAt: options.now.toISOString(),
      payloadId,
      planArtifactId: options.plan.metadata.artifactId,
      planPayloadId: options.plan.metadata.payloadId,
    },
    recommendations: validateDataStackCodexRecommendations(options.plan, options.recommendations),
    version: DATA_STACK_CODEX_REPORT_VERSION,
  };
}

export function serializeDataStackCodexReportArtifact(
  report: DataStackCodexReportArtifact,
): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export async function writeDataStackCodexReportArtifact(
  path: string,
  report: DataStackCodexReportArtifact,
  options: { overwrite?: boolean } = {},
): Promise<void> {
  await writeTextFileSafe(path, serializeDataStackCodexReportArtifact(report), options);
}
