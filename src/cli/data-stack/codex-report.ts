import { randomUUID } from "node:crypto";

import { writeTextFileSafe } from "../file-io";
import { CliError } from "../errors";
import {
  createDataStackPlanArtifact,
  DATA_STACK_DUPLICATE_POLICY_VALUES,
  formatDataStackArtifactTimestamp,
  parseDataStackPlanArtifact,
  type DataStackDuplicatePolicy,
  type DataStackPlanArtifact,
} from "./plan";
import type { DataStackDiagnosticsResult, DataStackColumnSummary } from "./diagnostics";
import { normalizeDataStackSchemaOptions } from "./disclosure";

export const DATA_STACK_CODEX_REPORT_ARTIFACT_TYPE = "data-stack-codex-report";
export const DATA_STACK_CODEX_REPORT_VERSION = 1;
export const DATA_STACK_CODEX_REPORT_CREATED_BY = "cdx-chores data stack --codex-assist";
export const DATA_STACK_CODEX_REPORT_UID_HEX_LENGTH = 8;

export const DATA_STACK_CODEX_PATCH_PATHS = [
  "/input/columns",
  "/schema/mode",
  "/schema/excludedNames",
  "/duplicates/uniqueBy",
  "/duplicates/policy",
] as const;

export type DataStackCodexPatchPath = (typeof DATA_STACK_CODEX_PATCH_PATHS)[number];

export interface DataStackCodexPatch {
  op: "replace";
  path: DataStackCodexPatchPath;
  value: unknown;
}

export interface DataStackCodexRecommendation {
  confidence: number;
  id: string;
  patches: DataStackCodexPatch[];
  reasoningSummary: string;
  title: string;
}

export interface DataStackCodexFactPayload {
  diagnostics: {
    candidateUniqueKeys: DataStackPlanArtifact["diagnostics"]["candidateUniqueKeys"];
    columnSummaries: DataStackColumnSummary[];
    duplicateKeyNullRows: number;
    duplicateSummary: DataStackDiagnosticsResult["duplicateSummary"];
    matchedFileCount: number;
    rowCount: number;
    schemaNameCount: number;
  };
  duplicates: DataStackPlanArtifact["duplicates"];
  input: DataStackPlanArtifact["input"];
  output: DataStackPlanArtifact["output"];
  schema: DataStackPlanArtifact["schema"];
  sources: {
    baseDirectory: string;
    pattern: string | null;
    recursive: boolean;
    resolvedSample: string[];
    totalResolved: number;
  };
}

export interface DataStackCodexReportArtifact {
  facts: DataStackCodexFactPayload;
  metadata: {
    artifactId: string;
    artifactType: typeof DATA_STACK_CODEX_REPORT_ARTIFACT_TYPE;
    createdBy: string;
    issuedAt: string;
    payloadId: string;
    planArtifactId: string;
    planPayloadId: string;
  };
  recommendations: DataStackCodexRecommendation[];
  version: typeof DATA_STACK_CODEX_REPORT_VERSION;
}

export interface DataStackCodexRecommendationDecisionInput {
  decision: "accepted" | "edited";
  patches?: DataStackCodexPatch[];
  recommendationId: string;
}

function createDataStackCodexReportUid(): string {
  return randomUUID().replaceAll("-", "").slice(0, DATA_STACK_CODEX_REPORT_UID_HEX_LENGTH);
}

export function generateDataStackCodexReportFileName(now = new Date()): string {
  return `data-stack-codex-report-${formatDataStackArtifactTimestamp(now)}-${createDataStackCodexReportUid()}.json`;
}

function ensureString(value: unknown, context: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CliError(`Invalid data stack Codex report: ${context} must be a non-empty string.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return value.trim();
}

function ensureStringArray(
  value: unknown,
  context: string,
  options: { allowEmpty?: boolean } = {},
): string[] {
  if (!Array.isArray(value)) {
    throw new CliError(`Invalid data stack Codex patch: ${context} must be an array.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  const strings = value.map((item, index) => ensureString(item, `${context}[${index}]`));
  if (strings.length === 0 && options.allowEmpty !== true) {
    throw new CliError(`Invalid data stack Codex patch: ${context} cannot be empty.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  if (new Set(strings.map((item) => item.toLowerCase())).size !== strings.length) {
    throw new CliError(`Invalid data stack Codex patch: ${context} cannot contain duplicates.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return strings;
}

function ensurePatchPath(value: unknown): DataStackCodexPatchPath {
  if (
    typeof value === "string" &&
    (DATA_STACK_CODEX_PATCH_PATHS as readonly string[]).includes(value)
  ) {
    return value as DataStackCodexPatchPath;
  }
  throw new CliError(
    `Invalid data stack Codex patch: path must be one of: ${DATA_STACK_CODEX_PATCH_PATHS.join(", ")}.`,
    {
      code: "INVALID_INPUT",
      exitCode: 2,
    },
  );
}

function ensureDuplicatePolicy(value: unknown): DataStackDuplicatePolicy {
  if (
    typeof value === "string" &&
    (DATA_STACK_DUPLICATE_POLICY_VALUES as readonly string[]).includes(value)
  ) {
    return value as DataStackDuplicatePolicy;
  }
  throw new CliError(
    `Invalid data stack Codex patch: /duplicates/policy must be one of: ${DATA_STACK_DUPLICATE_POLICY_VALUES.join(", ")}.`,
    {
      code: "INVALID_INPUT",
      exitCode: 2,
    },
  );
}

function ensureSchemaMode(value: unknown): DataStackPlanArtifact["schema"]["mode"] {
  if (value === "strict" || value === "union-by-name") {
    return value;
  }
  throw new CliError(
    "Invalid data stack Codex patch: /schema/mode must be one of: strict, union-by-name.",
    {
      code: "INVALID_INPUT",
      exitCode: 2,
    },
  );
}

function assertKnownSchemaNames(
  plan: DataStackPlanArtifact,
  names: readonly string[],
  context: string,
): void {
  const available = new Set(plan.schema.includedNames);
  const unknown = names.filter((name) => !available.has(name));
  if (unknown.length > 0) {
    throw new CliError(
      `Invalid data stack Codex patch: ${context} contains unknown schema names: ${unknown.join(", ")}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
}

function assertExecutableSchemaPatch(
  plan: DataStackPlanArtifact,
  schema: DataStackPlanArtifact["schema"],
): void {
  normalizeDataStackSchemaOptions({
    excludeColumns: schema.excludedNames,
    noHeader: plan.input.headerMode === "no-header",
    schemaMode: schema.mode,
  });
}

export function validateDataStackCodexPatch(
  plan: DataStackPlanArtifact,
  patch: DataStackCodexPatch,
): DataStackCodexPatch {
  if (patch.op !== "replace") {
    throw new CliError("Invalid data stack Codex patch: only replace operations are supported.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const path = ensurePatchPath(patch.path);
  if (path === "/input/columns") {
    const columns = ensureStringArray(patch.value, path);
    if (plan.input.headerMode !== "no-header") {
      throw new CliError(
        "Invalid data stack Codex patch: /input/columns is only valid for headerless input.",
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }
    return { op: "replace", path, value: columns };
  }
  if (path === "/schema/mode") {
    const mode = ensureSchemaMode(patch.value);
    assertExecutableSchemaPatch(plan, {
      ...plan.schema,
      mode,
    });
    return { op: "replace", path, value: mode };
  }
  if (path === "/schema/excludedNames") {
    const excludedNames = ensureStringArray(patch.value, path, { allowEmpty: true });
    assertKnownSchemaNames(plan, excludedNames, path);
    assertExecutableSchemaPatch(plan, {
      ...plan.schema,
      excludedNames,
    });
    return {
      op: "replace",
      path,
      value: excludedNames,
    };
  }
  if (path === "/duplicates/uniqueBy") {
    const uniqueBy = ensureStringArray(patch.value, path, { allowEmpty: true });
    assertKnownSchemaNames(plan, uniqueBy, path);
    return { op: "replace", path, value: uniqueBy };
  }
  return { op: "replace", path, value: ensureDuplicatePolicy(patch.value) };
}

export function validateDataStackCodexRecommendation(
  plan: DataStackPlanArtifact,
  recommendation: DataStackCodexRecommendation,
): DataStackCodexRecommendation {
  const id = ensureString(recommendation.id, "recommendations[].id");
  const title = ensureString(recommendation.title, `recommendations[${id}].title`);
  const reasoningSummary = ensureString(
    recommendation.reasoningSummary,
    `recommendations[${id}].reasoningSummary`,
  );
  const confidence =
    typeof recommendation.confidence === "number" && Number.isFinite(recommendation.confidence)
      ? Math.max(0, Math.min(1, recommendation.confidence))
      : 0.5;
  if (!Array.isArray(recommendation.patches) || recommendation.patches.length === 0) {
    throw new CliError(`Invalid data stack Codex recommendation ${id}: patches cannot be empty.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  const seenPaths = new Set<string>();
  let validationPlan = plan;
  const patches = recommendation.patches.map((patch) => {
    const validated = validateDataStackCodexPatch(validationPlan, patch);
    if (seenPaths.has(validated.path)) {
      throw new CliError(
        `Invalid data stack Codex recommendation ${id}: duplicate patch path ${validated.path}.`,
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }
    seenPaths.add(validated.path);
    validationPlan = applyPatchToPlan(validationPlan, validated);
    return validated;
  });
  return {
    confidence,
    id,
    patches,
    reasoningSummary,
    title,
  };
}

export function validateDataStackCodexRecommendations(
  plan: DataStackPlanArtifact,
  recommendations: readonly DataStackCodexRecommendation[],
): DataStackCodexRecommendation[] {
  const seenIds = new Set<string>();
  return recommendations.map((recommendation) => {
    const validated = validateDataStackCodexRecommendation(plan, recommendation);
    if (seenIds.has(validated.id)) {
      throw new CliError(
        `Invalid data stack Codex report: duplicate recommendation id ${validated.id}.`,
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }
    seenIds.add(validated.id);
    return validated;
  });
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

function applyPatchToPlan(
  plan: DataStackPlanArtifact,
  patch: DataStackCodexPatch,
): DataStackPlanArtifact {
  const next = structuredClone(plan) as DataStackPlanArtifact;
  switch (patch.path) {
    case "/input/columns":
      next.input.columns = [...(patch.value as string[])];
      next.schema.includedNames = [...next.input.columns];
      break;
    case "/schema/mode":
      next.schema.mode = patch.value as DataStackPlanArtifact["schema"]["mode"];
      break;
    case "/schema/excludedNames":
      next.schema.excludedNames = [...(patch.value as string[])];
      break;
    case "/duplicates/uniqueBy":
      next.duplicates.uniqueBy = [...(patch.value as string[])];
      break;
    case "/duplicates/policy":
      next.duplicates.policy = patch.value as DataStackDuplicatePolicy;
      break;
  }
  return parseDataStackPlanArtifact(next);
}

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
