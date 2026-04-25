import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { CliError } from "../errors";
import type { DataStackInputFormat, DataStackOutputFormat, DataStackSchemaMode } from "./types";

export const DATA_STACK_PLAN_ARTIFACT_TYPE = "data-stack-plan";
export const DATA_STACK_PLAN_VERSION = 1;
export const DATA_STACK_PLAN_REPLAY_COMMAND = "data stack replay";
export const DATA_STACK_PLAN_CREATED_BY = "cdx-chores data stack --dry-run";
export const DATA_STACK_PLAN_UID_HEX_LENGTH = 8;

export type DataStackPlanHeaderMode = "header" | "no-header";
export type DataStackDuplicatePolicy = "preserve" | "report" | "reject";
export type DataStackRecommendationDecisionValue = "accepted" | "edited";

export interface DataStackPlanRecommendationDecision {
  decision: DataStackRecommendationDecisionValue;
  recommendationId: string;
  reportArtifactId: string;
}

export interface DataStackPlanMetadata {
  acceptedRecommendationIds: string[];
  artifactId: string;
  artifactType: typeof DATA_STACK_PLAN_ARTIFACT_TYPE;
  createdBy: string;
  derivedFromPayloadId: string | null;
  issuedAt: string;
  payloadId: string;
  recommendationDecisions: DataStackPlanRecommendationDecision[];
}

export interface DataStackPlanCommand {
  action: "stack";
  family: "data";
  replayCommand: typeof DATA_STACK_PLAN_REPLAY_COMMAND;
}

export interface DataStackPlanSourceFingerprint {
  mtimeMs: number;
  sizeBytes: number;
}

export interface DataStackPlanResolvedSource {
  fingerprint?: DataStackPlanSourceFingerprint;
  kind: "file";
  path: string;
}

export interface DataStackPlanSources {
  baseDirectory: string;
  maxDepth: number | null;
  pattern: string | null;
  raw: string[];
  recursive: boolean;
  resolved: DataStackPlanResolvedSource[];
}

export interface DataStackPlanInput {
  columns: string[];
  format: DataStackInputFormat;
  headerMode: DataStackPlanHeaderMode;
}

export interface DataStackPlanSchema {
  excludedNames: string[];
  includedNames: string[];
  mode: DataStackSchemaMode;
}

export interface DataStackPlanDuplicates {
  duplicateKeyConflicts: number;
  exactDuplicateRows: number;
  policy: DataStackDuplicatePolicy;
  uniqueBy: string[];
}

export interface DataStackPlanOutput {
  format: DataStackOutputFormat;
  overwrite: boolean;
  path: string | null;
}

export interface DataStackPlanCandidateUniqueKey {
  columns: string[];
  duplicateRows: number;
  nullRows: number;
}

export interface DataStackPlanDiagnostics {
  candidateUniqueKeys: DataStackPlanCandidateUniqueKey[];
  matchedFileCount: number;
  reportPath: string | null;
  rowCount: number;
  schemaNameCount: number;
}

export interface DataStackPlanArtifact {
  command: DataStackPlanCommand;
  diagnostics: DataStackPlanDiagnostics;
  duplicates: DataStackPlanDuplicates;
  input: DataStackPlanInput;
  metadata: DataStackPlanMetadata;
  output: DataStackPlanOutput;
  schema: DataStackPlanSchema;
  sources: DataStackPlanSources;
  version: typeof DATA_STACK_PLAN_VERSION;
}

export interface DataStackPlanIdentity {
  artifactId: string;
  fileName: string;
  payloadId: string;
  timestamp: string;
  uid: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ensureRecord(value: unknown, context: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new CliError(`Invalid data stack plan artifact: ${context} must be an object.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return value;
}

function ensureString(value: unknown, context: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CliError(`Invalid data stack plan artifact: ${context} must be a non-empty string.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return value;
}

function ensureOptionalStringOrNull(value: unknown, context: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return ensureString(value, context);
}

function ensureBoolean(value: unknown, context: string): boolean {
  if (typeof value !== "boolean") {
    throw new CliError(`Invalid data stack plan artifact: ${context} must be a boolean.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return value;
}

function ensureNonNegativeNumber(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new CliError(
      `Invalid data stack plan artifact: ${context} must be a non-negative number.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
  return value;
}

function ensureStringArray(value: unknown, context: string): string[] {
  if (!Array.isArray(value)) {
    throw new CliError(`Invalid data stack plan artifact: ${context} must be an array.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return value.map((item, index) => ensureString(item, `${context}[${index}]`));
}

function ensureLiteral<T extends string>(value: unknown, expected: T, context: string): T {
  if (value !== expected) {
    throw new CliError(
      `Invalid data stack plan artifact: ${context} must be ${JSON.stringify(expected)}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
  return expected;
}

function ensureOneOf<T extends string>(value: unknown, values: readonly T[], context: string): T {
  if (typeof value === "string" && (values as readonly string[]).includes(value)) {
    return value as T;
  }
  throw new CliError(
    `Invalid data stack plan artifact: ${context} must be one of: ${values.join(", ")}.`,
    {
      code: "INVALID_INPUT",
      exitCode: 2,
    },
  );
}

function formatDataStackPlanTimestamp(now: Date): string {
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
  const timestamp = formatDataStackPlanTimestamp(options.now);
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
  return normalizeDataStackPlanArtifact({
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

function parseRecommendationDecision(
  value: unknown,
  context: string,
): DataStackPlanRecommendationDecision {
  const decision = ensureRecord(value, context);
  return {
    decision: ensureOneOf(decision.decision, ["accepted", "edited"], `${context}.decision`),
    recommendationId: ensureString(decision.recommendationId, `${context}.recommendationId`),
    reportArtifactId: ensureString(decision.reportArtifactId, `${context}.reportArtifactId`),
  };
}

function normalizeRecommendationMetadata(options: {
  acceptedRecommendationIds: string[];
  recommendationDecisions: DataStackPlanRecommendationDecision[];
}): {
  acceptedRecommendationIds: string[];
  recommendationDecisions: DataStackPlanRecommendationDecision[];
} {
  const derivedAcceptedIds = options.recommendationDecisions
    .filter((decision) => decision.decision === "accepted")
    .map((decision) => decision.recommendationId);
  const providedAcceptedIds = options.acceptedRecommendationIds;
  const sameAcceptedIds =
    providedAcceptedIds.length === derivedAcceptedIds.length &&
    providedAcceptedIds.every((id, index) => id === derivedAcceptedIds[index]);

  if (!sameAcceptedIds) {
    throw new CliError(
      "Invalid data stack plan artifact: metadata.acceptedRecommendationIds must match accepted recommendation decisions.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  return {
    acceptedRecommendationIds: derivedAcceptedIds,
    recommendationDecisions: options.recommendationDecisions.map((decision) => ({
      decision: decision.decision,
      recommendationId: decision.recommendationId,
      reportArtifactId: decision.reportArtifactId,
    })),
  };
}

function parseMetadata(value: unknown): DataStackPlanMetadata {
  const metadata = ensureRecord(value, "metadata");
  const recommendationMetadata = normalizeRecommendationMetadata({
    acceptedRecommendationIds: ensureStringArray(
      metadata.acceptedRecommendationIds,
      "metadata.acceptedRecommendationIds",
    ),
    recommendationDecisions: ensureArray(metadata.recommendationDecisions, {
      context: "metadata.recommendationDecisions",
      parse: parseRecommendationDecision,
    }),
  });
  return {
    acceptedRecommendationIds: recommendationMetadata.acceptedRecommendationIds,
    artifactId: ensureString(metadata.artifactId, "metadata.artifactId"),
    artifactType: ensureLiteral(
      metadata.artifactType,
      DATA_STACK_PLAN_ARTIFACT_TYPE,
      "metadata.artifactType",
    ),
    createdBy: ensureString(metadata.createdBy, "metadata.createdBy"),
    derivedFromPayloadId: ensureOptionalStringOrNull(
      metadata.derivedFromPayloadId,
      "metadata.derivedFromPayloadId",
    ),
    issuedAt: ensureString(metadata.issuedAt, "metadata.issuedAt"),
    payloadId: ensureString(metadata.payloadId, "metadata.payloadId"),
    recommendationDecisions: recommendationMetadata.recommendationDecisions,
  };
}

function parseCommand(value: unknown): DataStackPlanCommand {
  const command = ensureRecord(value, "command");
  return {
    action: ensureLiteral(command.action, "stack", "command.action"),
    family: ensureLiteral(command.family, "data", "command.family"),
    replayCommand: ensureLiteral(
      command.replayCommand,
      DATA_STACK_PLAN_REPLAY_COMMAND,
      "command.replayCommand",
    ),
  };
}

function parseFingerprint(value: unknown, context: string): DataStackPlanSourceFingerprint {
  const fingerprint = ensureRecord(value, context);
  return {
    mtimeMs: ensureNonNegativeNumber(fingerprint.mtimeMs, `${context}.mtimeMs`),
    sizeBytes: ensureNonNegativeNumber(fingerprint.sizeBytes, `${context}.sizeBytes`),
  };
}

function parseResolvedSource(value: unknown, context: string): DataStackPlanResolvedSource {
  const source = ensureRecord(value, context);
  return {
    ...(source.fingerprint !== undefined
      ? { fingerprint: parseFingerprint(source.fingerprint, `${context}.fingerprint`) }
      : {}),
    kind: ensureLiteral(source.kind, "file", `${context}.kind`),
    path: ensureString(source.path, `${context}.path`),
  };
}

function parseSources(value: unknown): DataStackPlanSources {
  const sources = ensureRecord(value, "sources");
  const maxDepth =
    sources.maxDepth === null || sources.maxDepth === undefined
      ? null
      : ensureNonNegativeNumber(sources.maxDepth, "sources.maxDepth");
  return {
    baseDirectory: ensureString(sources.baseDirectory, "sources.baseDirectory"),
    maxDepth,
    pattern: ensureOptionalStringOrNull(sources.pattern, "sources.pattern"),
    raw: ensureStringArray(sources.raw, "sources.raw"),
    recursive: ensureBoolean(sources.recursive, "sources.recursive"),
    resolved: ensureArray(sources.resolved, {
      context: "sources.resolved",
      parse: parseResolvedSource,
    }),
  };
}

function parseInput(value: unknown): DataStackPlanInput {
  const input = ensureRecord(value, "input");
  const normalizedInput: DataStackPlanInput = {
    columns: ensureStringArray(input.columns, "input.columns"),
    format: ensureOneOf(input.format, ["csv", "tsv", "json", "jsonl"], "input.format"),
    headerMode: ensureOneOf(input.headerMode, ["header", "no-header"], "input.headerMode"),
  };
  if (normalizedInput.headerMode === "no-header" && normalizedInput.columns.length === 0) {
    throw new CliError(
      "Invalid data stack plan artifact: input.columns is required when input.headerMode is no-header.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
  return normalizedInput;
}

function parseSchema(value: unknown): DataStackPlanSchema {
  const schema = ensureRecord(value, "schema");
  return {
    excludedNames: ensureStringArray(schema.excludedNames, "schema.excludedNames"),
    includedNames: ensureStringArray(schema.includedNames, "schema.includedNames"),
    mode: ensureOneOf(schema.mode, ["strict", "union-by-name"], "schema.mode"),
  };
}

function parseDuplicates(value: unknown): DataStackPlanDuplicates {
  const duplicates = ensureRecord(value, "duplicates");
  return {
    duplicateKeyConflicts: ensureNonNegativeNumber(
      duplicates.duplicateKeyConflicts,
      "duplicates.duplicateKeyConflicts",
    ),
    exactDuplicateRows: ensureNonNegativeNumber(
      duplicates.exactDuplicateRows,
      "duplicates.exactDuplicateRows",
    ),
    policy: ensureOneOf(duplicates.policy, ["preserve", "report", "reject"], "duplicates.policy"),
    uniqueBy: ensureStringArray(duplicates.uniqueBy, "duplicates.uniqueBy"),
  };
}

function parseOutput(value: unknown): DataStackPlanOutput {
  const output = ensureRecord(value, "output");
  return {
    format: ensureOneOf(output.format, ["csv", "tsv", "json"], "output.format"),
    overwrite: ensureBoolean(output.overwrite, "output.overwrite"),
    path: ensureOptionalStringOrNull(output.path, "output.path"),
  };
}

function parseCandidateUniqueKey(value: unknown, context: string): DataStackPlanCandidateUniqueKey {
  const candidate = ensureRecord(value, context);
  return {
    columns: ensureStringArray(candidate.columns, `${context}.columns`),
    duplicateRows: ensureNonNegativeNumber(candidate.duplicateRows, `${context}.duplicateRows`),
    nullRows: ensureNonNegativeNumber(candidate.nullRows, `${context}.nullRows`),
  };
}

function parseDiagnostics(value: unknown): DataStackPlanDiagnostics {
  const diagnostics = ensureRecord(value, "diagnostics");
  return {
    candidateUniqueKeys: ensureArray(diagnostics.candidateUniqueKeys, {
      context: "diagnostics.candidateUniqueKeys",
      parse: parseCandidateUniqueKey,
    }),
    matchedFileCount: ensureNonNegativeNumber(
      diagnostics.matchedFileCount,
      "diagnostics.matchedFileCount",
    ),
    reportPath: ensureOptionalStringOrNull(diagnostics.reportPath, "diagnostics.reportPath"),
    rowCount: ensureNonNegativeNumber(diagnostics.rowCount, "diagnostics.rowCount"),
    schemaNameCount: ensureNonNegativeNumber(
      diagnostics.schemaNameCount,
      "diagnostics.schemaNameCount",
    ),
  };
}

function ensureArray<T>(
  value: unknown,
  options: {
    context: string;
    parse: (value: unknown, context: string) => T;
  },
): T[] {
  if (!Array.isArray(value)) {
    throw new CliError(`Invalid data stack plan artifact: ${options.context} must be an array.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return value.map((item, index) => options.parse(item, `${options.context}[${index}]`));
}

export function parseDataStackPlanArtifact(parsed: unknown): DataStackPlanArtifact {
  const artifact = ensureRecord(parsed, "root");
  if (artifact.version !== DATA_STACK_PLAN_VERSION) {
    throw new CliError(
      `Unsupported data stack plan artifact version: ${String(artifact.version)}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  return normalizeDataStackPlanArtifact({
    command: parseCommand(artifact.command),
    diagnostics: parseDiagnostics(artifact.diagnostics),
    duplicates: parseDuplicates(artifact.duplicates),
    input: parseInput(artifact.input),
    metadata: parseMetadata(artifact.metadata),
    output: parseOutput(artifact.output),
    schema: parseSchema(artifact.schema),
    sources: parseSources(artifact.sources),
    version: DATA_STACK_PLAN_VERSION,
  });
}

export async function readDataStackPlanArtifact(path: string): Promise<DataStackPlanArtifact> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Failed to read data stack plan artifact: ${path} (${message})`, {
      code: "FILE_READ_ERROR",
      exitCode: 2,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Invalid data stack plan artifact JSON: ${path} (${message})`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  return parseDataStackPlanArtifact(parsed);
}

function orderDataStackPlanArtifact(artifact: DataStackPlanArtifact): DataStackPlanArtifact {
  return {
    version: DATA_STACK_PLAN_VERSION,
    metadata: {
      artifactType: artifact.metadata.artifactType,
      artifactId: artifact.metadata.artifactId,
      payloadId: artifact.metadata.payloadId,
      derivedFromPayloadId: artifact.metadata.derivedFromPayloadId,
      acceptedRecommendationIds: [...artifact.metadata.acceptedRecommendationIds],
      recommendationDecisions: artifact.metadata.recommendationDecisions.map((decision) => ({
        reportArtifactId: decision.reportArtifactId,
        recommendationId: decision.recommendationId,
        decision: decision.decision,
      })),
      issuedAt: artifact.metadata.issuedAt,
      createdBy: artifact.metadata.createdBy,
    },
    command: {
      family: artifact.command.family,
      action: artifact.command.action,
      replayCommand: artifact.command.replayCommand,
    },
    sources: {
      baseDirectory: artifact.sources.baseDirectory,
      raw: [...artifact.sources.raw],
      pattern: artifact.sources.pattern,
      recursive: artifact.sources.recursive,
      maxDepth: artifact.sources.maxDepth,
      resolved: artifact.sources.resolved.map((source) => ({
        path: source.path,
        kind: source.kind,
        ...(source.fingerprint
          ? {
              fingerprint: {
                sizeBytes: source.fingerprint.sizeBytes,
                mtimeMs: source.fingerprint.mtimeMs,
              },
            }
          : {}),
      })),
    },
    input: {
      format: artifact.input.format,
      headerMode: artifact.input.headerMode,
      columns: [...artifact.input.columns],
    },
    schema: {
      mode: artifact.schema.mode,
      includedNames: [...artifact.schema.includedNames],
      excludedNames: [...artifact.schema.excludedNames],
    },
    duplicates: {
      policy: artifact.duplicates.policy,
      uniqueBy: [...artifact.duplicates.uniqueBy],
      exactDuplicateRows: artifact.duplicates.exactDuplicateRows,
      duplicateKeyConflicts: artifact.duplicates.duplicateKeyConflicts,
    },
    output: {
      format: artifact.output.format,
      path: artifact.output.path,
      overwrite: artifact.output.overwrite,
    },
    diagnostics: {
      matchedFileCount: artifact.diagnostics.matchedFileCount,
      rowCount: artifact.diagnostics.rowCount,
      schemaNameCount: artifact.diagnostics.schemaNameCount,
      candidateUniqueKeys: artifact.diagnostics.candidateUniqueKeys.map((candidate) => ({
        columns: [...candidate.columns],
        nullRows: candidate.nullRows,
        duplicateRows: candidate.duplicateRows,
      })),
      reportPath: artifact.diagnostics.reportPath,
    },
  };
}

function normalizeDataStackPlanArtifact(artifact: DataStackPlanArtifact): DataStackPlanArtifact {
  return orderDataStackPlanArtifact({
    command: parseCommand(artifact.command),
    diagnostics: parseDiagnostics(artifact.diagnostics),
    duplicates: parseDuplicates(artifact.duplicates),
    input: parseInput(artifact.input),
    metadata: parseMetadata(artifact.metadata),
    output: parseOutput(artifact.output),
    schema: parseSchema(artifact.schema),
    sources: parseSources(artifact.sources),
    version: DATA_STACK_PLAN_VERSION,
  });
}

export function serializeDataStackPlanArtifact(artifact: DataStackPlanArtifact): string {
  return `${JSON.stringify(orderDataStackPlanArtifact(artifact), null, 2)}\n`;
}

export async function writeDataStackPlanArtifact(
  path: string,
  artifact: DataStackPlanArtifact,
  options: { overwrite?: boolean } = {},
): Promise<void> {
  const overwrite = options.overwrite ?? false;
  try {
    await stat(path);
    if (!overwrite) {
      throw new CliError(`Output file already exists: ${path}. Use --overwrite to replace it.`, {
        code: "OUTPUT_EXISTS",
        exitCode: 2,
      });
    }
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    // Missing files are expected for new plan artifacts.
  }

  await mkdir(dirname(path), { recursive: true });
  try {
    await writeFile(path, serializeDataStackPlanArtifact(artifact), "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Failed to write file: ${path} (${message})`, {
      code: "FILE_WRITE_ERROR",
      exitCode: 2,
    });
  }
}
