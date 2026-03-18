import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";

import { startCodexReadOnlyThread } from "../../adapters/codex/shared";
import { CliError } from "../errors";
import type {
  DataQueryInputFormat,
  DataQuerySourceIntrospection,
  DataQuerySourceShape,
} from "./query";

export const DATA_HEADER_MAPPING_ARTIFACT_TYPE = "data-header-mapping";
export const DATA_HEADER_MAPPING_VERSION = 1;

const DATA_HEADER_SUGGESTION_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          from: { type: "string" },
          to: { type: "string" },
        },
        required: ["from", "to"],
        additionalProperties: false,
      },
    },
  },
  required: ["suggestions"],
  additionalProperties: false,
} as const;

const DATA_HEADER_SUGGESTION_TIMEOUT_MS = 30_000;
const DATA_HEADER_SUGGESTION_SAMPLE_LIMIT = 3;
const DATA_HEADER_SUGGESTION_SAMPLE_VALUE_CHARS = 80;
const SUPPORTED_QUERY_INPUT_FORMATS = new Set<DataQueryInputFormat>([
  "csv",
  "excel",
  "parquet",
  "sqlite",
  "tsv",
]);

export interface DataHeaderMappingInputReference {
  format: DataQueryInputFormat;
  path: string;
  range?: string;
  source?: string;
}

export type DataHeaderMappingEntry = Record<string, unknown> & {
  from: string;
  inferredType?: string;
  sample?: string;
  to: string;
};

export type DataHeaderMappingArtifact = Record<string, unknown> & {
  version: number;
  metadata: Record<string, unknown> & {
    artifactType: string;
    issuedAt: string;
  };
  input: Record<string, unknown> & DataHeaderMappingInputReference;
  mappings: DataHeaderMappingEntry[];
};

export interface DataHeaderSuggestionResult {
  errorMessage?: string;
  mappings: DataHeaderMappingEntry[];
}

export type DataHeaderSuggestionRunner = (options: {
  prompt: string;
  timeoutMs?: number;
  workingDirectory: string;
}) => Promise<string>;

interface DataHeaderSuggestionEvidence {
  from: string;
  inferredType: string;
  sample?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function truncateForPrompt(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  if (maxChars <= 3) {
    return value.slice(0, maxChars);
  }
  return `${value.slice(0, maxChars - 3)}...`;
}

function normalizePromptSamples(values: string[]): string {
  if (values.length === 0) {
    return "(no sample values)";
  }
  return values.map((value) => truncateForPrompt(value, DATA_HEADER_SUGGESTION_SAMPLE_VALUE_CHARS)).join(", ");
}

function normalizeArtifactPath(path: string): string {
  return path.replace(/\\/g, "/");
}

function ensureKnownQueryInputFormat(value: unknown, context: string): DataQueryInputFormat {
  if (typeof value === "string" && SUPPORTED_QUERY_INPUT_FORMATS.has(value as DataQueryInputFormat)) {
    return value as DataQueryInputFormat;
  }
  throw new CliError(`Invalid header mapping artifact: ${context} must be one of csv, tsv, parquet, sqlite, excel.`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

function ensureNonEmptyString(value: unknown, context: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  throw new CliError(`Invalid header mapping artifact: ${context} must be a non-empty string.`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function throwUnsupportedHeaderMappingVersion(version: unknown, options: { rewriting?: boolean } = {}): never {
  const suffix = options.rewriting ? " Cannot preserve it safely while rewriting." : "";
  throw new CliError(`Unsupported header mapping artifact version: ${String(version)}.${suffix}`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

export function normalizeHeaderMappingTargetName(value: string): string {
  const collapsed = value
    .trim()
    .replace(/[`"'“”‘’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toLowerCase();

  if (!collapsed) {
    return "";
  }

  if (/^[\p{N}]/u.test(collapsed)) {
    return `column_${collapsed}`;
  }

  return collapsed;
}

export function createHeaderMappingInputReference(options: {
  cwd: string;
  format: DataQueryInputFormat;
  inputPath: string;
  shape?: Pick<DataQuerySourceShape, "range" | "source">;
}): DataHeaderMappingInputReference {
  const normalizedRelativePath = normalizeArtifactPath(relative(options.cwd, options.inputPath) || ".");
  return {
    format: options.format,
    path: normalizedRelativePath,
    ...(options.shape?.range ? { range: options.shape.range } : {}),
    ...(options.shape?.source ? { source: options.shape.source } : {}),
  };
}

export function generateDataHeaderMappingFileName(): string {
  return `data-header-mapping-${randomUUID().replace(/-/g, "").slice(0, 10)}.json`;
}

export function collectHeaderSuggestionEvidence(
  introspection: DataQuerySourceIntrospection,
): DataHeaderSuggestionEvidence[] {
  return introspection.columns.map((column) => ({
    from: column.name,
    inferredType: column.type,
    sample: introspection.sampleRows
      .map((row) => row[column.name] ?? "")
      .find((value) => value.trim().length > 0),
  }));
}

function buildHeaderSuggestionPrompt(options: {
  format: DataQueryInputFormat;
  introspection: DataQuerySourceIntrospection;
}): string {
  const evidence = collectHeaderSuggestionEvidence(options.introspection);
  const lines =
    evidence.length > 0
      ? evidence.map((entry, index) => {
          const samples = options.introspection.sampleRows
            .map((row) => row[entry.from] ?? "")
            .filter((value) => value.trim().length > 0)
            .slice(0, DATA_HEADER_SUGGESTION_SAMPLE_LIMIT);
          return `${index + 1}. ${entry.from} (${entry.inferredType}) samples: ${normalizePromptSamples(samples)}`;
        })
      : ["(no columns available)"];

  return [
    "Suggest semantic header renames for the current shaped logical table `file`.",
    "Return JSON only following the provided schema.",
    "",
    "Rules:",
    "- Propose renames only when the new name is materially better than the current column name.",
    "- Use short snake_case names.",
    "- Do not invent meaning unsupported by the observed samples and types.",
    "- If a column should stay as-is, omit it from suggestions.",
    "- Never propose duplicate target names.",
    "",
    `Detected format: ${options.format}`,
    `Selected source: ${options.introspection.selectedSource ?? "(implicit single source)"}`,
    `Selected range: ${options.introspection.selectedRange ?? "(whole source)"}`,
    "",
    `Columns (${options.introspection.columns.length}):`,
    ...lines,
  ].join("\n");
}

function normalizeSuggestedHeaderMappings(options: {
  introspection: DataQuerySourceIntrospection;
  suggestions: Array<{ from?: unknown; to?: unknown }>;
}): DataHeaderMappingEntry[] {
  const evidence = collectHeaderSuggestionEvidence(options.introspection);
  const evidenceByColumn = new Map(evidence.map((entry) => [entry.from, entry]));
  const candidateTargets = new Map<string, string>();

  for (const item of options.suggestions) {
    const from = typeof item.from === "string" ? item.from.trim() : "";
    const to = typeof item.to === "string" ? normalizeHeaderMappingTargetName(item.to) : "";
    if (!from || !to || !evidenceByColumn.has(from) || candidateTargets.has(from) || to === from) {
      continue;
    }
    candidateTargets.set(from, to);
  }

  const currentColumns = evidence.map((entry) => entry.from);
  const usedTargets = new Set(
    currentColumns.filter((column) => !candidateTargets.has(column)),
  );
  const normalizedMappings: DataHeaderMappingEntry[] = [];

  for (const entry of evidence) {
    const target = candidateTargets.get(entry.from);
    if (!target) {
      continue;
    }

    let uniqueTarget = target;
    let collisionIndex = 2;
    while (usedTargets.has(uniqueTarget)) {
      uniqueTarget = `${target}_${collisionIndex}`;
      collisionIndex += 1;
    }
    usedTargets.add(uniqueTarget);

    normalizedMappings.push({
      from: entry.from,
      ...(entry.inferredType ? { inferredType: entry.inferredType } : {}),
      ...(entry.sample ? { sample: entry.sample } : {}),
      to: uniqueTarget,
    });
  }

  return normalizedMappings;
}

function parseHeaderSuggestionResponse(
  finalResponse: string,
  introspection: DataQuerySourceIntrospection,
): DataHeaderMappingEntry[] {
  const parsed = JSON.parse(finalResponse) as {
    suggestions?: Array<{ from?: unknown; to?: unknown }>;
  };
  return normalizeSuggestedHeaderMappings({
    introspection,
    suggestions: parsed.suggestions ?? [],
  });
}

async function runHeaderSuggestionPrompt(options: {
  prompt: string;
  timeoutMs?: number;
  workingDirectory: string;
}): Promise<string> {
  const thread = startCodexReadOnlyThread(options.workingDirectory);
  const turn = await thread.run([{ type: "text", text: options.prompt }], {
    outputSchema: DATA_HEADER_SUGGESTION_OUTPUT_SCHEMA,
    signal: AbortSignal.timeout(options.timeoutMs ?? DATA_HEADER_SUGGESTION_TIMEOUT_MS),
  });
  return turn.finalResponse;
}

export async function suggestDataHeaderMappingsWithCodex(options: {
  format: DataQueryInputFormat;
  introspection: DataQuerySourceIntrospection;
  runner?: DataHeaderSuggestionRunner;
  timeoutMs?: number;
  workingDirectory: string;
}): Promise<DataHeaderSuggestionResult> {
  try {
    const runner = options.runner ?? runHeaderSuggestionPrompt;
    const finalResponse = await runner({
      prompt: buildHeaderSuggestionPrompt({
        format: options.format,
        introspection: options.introspection,
      }),
      timeoutMs: options.timeoutMs,
      workingDirectory: options.workingDirectory,
    });
    return {
      mappings: parseHeaderSuggestionResponse(finalResponse, options.introspection),
    };
  } catch (error) {
    return {
      errorMessage: error instanceof Error ? error.message : String(error),
      mappings: [],
    };
  }
}

export function normalizeAndValidateAcceptedHeaderMappings(options: {
  availableColumns: readonly string[];
  mappings: readonly DataHeaderMappingEntry[];
}): DataHeaderMappingEntry[] {
  const availableColumns = new Set(options.availableColumns);
  const usedTargets = new Set(
    options.availableColumns.filter((column) =>
      !options.mappings.some((mapping) => mapping.from === column),
    ),
  );
  const seenFrom = new Set<string>();
  const normalizedMappings: DataHeaderMappingEntry[] = [];

  for (const mapping of options.mappings) {
    const from = ensureNonEmptyString(mapping.from, "mappings[].from");
    const normalizedTarget = normalizeHeaderMappingTargetName(ensureNonEmptyString(mapping.to, "mappings[].to"));
    if (!normalizedTarget) {
      throw new CliError("Invalid header mapping: mappings[].to must normalize to a non-empty identifier.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    if (!availableColumns.has(from)) {
      throw new CliError(`Unknown header mapping source column: ${from}.`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    if (seenFrom.has(from)) {
      throw new CliError(`Duplicate header mapping source column: ${from}.`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    seenFrom.add(from);

    if (normalizedTarget === from) {
      continue;
    }

    if (usedTargets.has(normalizedTarget)) {
      throw new CliError(`Duplicate or colliding header mapping target: ${normalizedTarget}.`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    usedTargets.add(normalizedTarget);

    normalizedMappings.push({
      ...mapping,
      from,
      to: normalizedTarget,
    });
  }

  return normalizedMappings;
}

export function createDataHeaderMappingArtifact(options: {
  input: DataHeaderMappingInputReference;
  mappings: readonly DataHeaderMappingEntry[];
  now: Date;
}): DataHeaderMappingArtifact {
  return {
    input: {
      ...options.input,
    },
    mappings: options.mappings.map((mapping) => ({ ...mapping })),
    metadata: {
      artifactType: DATA_HEADER_MAPPING_ARTIFACT_TYPE,
      issuedAt: options.now.toISOString(),
    },
    version: DATA_HEADER_MAPPING_VERSION,
  };
}

function parseDataHeaderMappingArtifact(
  parsed: unknown,
  options: { rewriting?: boolean } = {},
): DataHeaderMappingArtifact {
  if (!isRecord(parsed)) {
    throw new CliError("Invalid header mapping artifact: expected a JSON object.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const version = parsed.version;
  if (version !== DATA_HEADER_MAPPING_VERSION) {
    throwUnsupportedHeaderMappingVersion(version, options);
  }

  const metadata = parsed.metadata;
  if (!isRecord(metadata)) {
    throw new CliError("Invalid header mapping artifact: metadata must be an object.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const artifactType = ensureNonEmptyString(metadata.artifactType, "metadata.artifactType");
  if (artifactType !== DATA_HEADER_MAPPING_ARTIFACT_TYPE) {
    throw new CliError(
      `Invalid header mapping artifact: metadata.artifactType must be ${DATA_HEADER_MAPPING_ARTIFACT_TYPE}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  const issuedAt = ensureNonEmptyString(metadata.issuedAt, "metadata.issuedAt");

  const input = parsed.input;
  if (!isRecord(input)) {
    throw new CliError("Invalid header mapping artifact: input must be an object.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const normalizedInput: DataHeaderMappingArtifact["input"] = {
    ...input,
    format: ensureKnownQueryInputFormat(input.format, "input.format"),
    path: normalizeArtifactPath(ensureNonEmptyString(input.path, "input.path")),
  };
  const source = normalizeOptionalString(input.source);
  const range = normalizeOptionalString(input.range);
  if (source) {
    normalizedInput.source = source;
  }
  if (range) {
    normalizedInput.range = range;
  }

  if (!Array.isArray(parsed.mappings)) {
    throw new CliError("Invalid header mapping artifact: mappings must be an array.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const mappings = parsed.mappings.map((mapping, index) => {
    if (!isRecord(mapping)) {
      throw new CliError(`Invalid header mapping artifact: mappings[${index}] must be an object.`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    return {
      ...mapping,
      from: ensureNonEmptyString(mapping.from, `mappings[${index}].from`),
      ...(typeof mapping.inferredType === "string" && mapping.inferredType.trim().length > 0
        ? { inferredType: mapping.inferredType.trim() }
        : {}),
      ...(typeof mapping.sample === "string" && mapping.sample.trim().length > 0
        ? { sample: mapping.sample }
        : {}),
      to: normalizeHeaderMappingTargetName(
        ensureNonEmptyString(mapping.to, `mappings[${index}].to`),
      ),
    };
  });

  if (mappings.some((mapping) => mapping.to.length === 0)) {
    throw new CliError("Invalid header mapping artifact: mappings[].to must normalize to a non-empty identifier.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  return {
    ...parsed,
    input: normalizedInput,
    mappings,
    metadata: {
      ...metadata,
      artifactType,
      issuedAt,
    },
    version: DATA_HEADER_MAPPING_VERSION,
  };
}

export async function readDataHeaderMappingArtifact(path: string): Promise<DataHeaderMappingArtifact> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Failed to read header mapping artifact: ${path} (${message})`, {
      code: "FILE_READ_ERROR",
      exitCode: 2,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Invalid header mapping artifact JSON: ${path} (${message})`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  return parseDataHeaderMappingArtifact(parsed);
}

function mergeDataHeaderMappingArtifacts(
  existing: DataHeaderMappingArtifact,
  next: DataHeaderMappingArtifact,
): DataHeaderMappingArtifact {
  if (existing.version !== DATA_HEADER_MAPPING_VERSION) {
    throwUnsupportedHeaderMappingVersion(existing.version, { rewriting: true });
  }

  const existingMappingsByFrom = new Map(existing.mappings.map((mapping) => [mapping.from, mapping]));

  return {
    ...existing,
    ...next,
    input: {
      ...existing.input,
      ...next.input,
    },
    mappings: next.mappings.map((mapping) => ({
      ...(existingMappingsByFrom.get(mapping.from) ?? {}),
      ...mapping,
    })),
    metadata: {
      ...existing.metadata,
      ...next.metadata,
    },
  };
}

export async function writeDataHeaderMappingArtifact(
  path: string,
  artifact: DataHeaderMappingArtifact,
  options: { overwrite?: boolean } = {},
): Promise<void> {
  const overwrite = options.overwrite ?? false;
  let contentArtifact = artifact;

  try {
    await stat(path);
    if (!overwrite) {
      throw new CliError(`Output file already exists: ${path}. Use --overwrite to replace it.`, {
        code: "OUTPUT_EXISTS",
        exitCode: 2,
      });
    }
    try {
      const existingArtifact = await readDataHeaderMappingArtifact(path);
      contentArtifact = mergeDataHeaderMappingArtifacts(existingArtifact, artifact);
    } catch (error) {
      if (error instanceof CliError && error.code === "INVALID_INPUT") {
        contentArtifact = artifact;
      } else {
        throw error;
      }
    }
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    // ignore missing file
  }

  await mkdir(dirname(path), { recursive: true });
  try {
    await writeFile(path, `${JSON.stringify(contentArtifact, null, 2)}\n`, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Failed to write file: ${path} (${message})`, {
      code: "FILE_WRITE_ERROR",
      exitCode: 2,
    });
  }
}

export function resolveReusableHeaderMappings(options: {
  artifact: DataHeaderMappingArtifact;
  currentInput: DataHeaderMappingInputReference;
}): DataHeaderMappingEntry[] {
  const expected = options.currentInput;
  const actual = options.artifact.input;
  const exactMatch =
    actual.path === expected.path &&
    actual.format === expected.format &&
    actual.source === expected.source &&
    actual.range === expected.range;

  if (!exactMatch) {
    throw new CliError(
      "Header mapping artifact does not match the current input context exactly.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  return options.artifact.mappings.map((mapping) => ({ ...mapping }));
}
