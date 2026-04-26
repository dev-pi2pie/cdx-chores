import { startCodexReadOnlyThread } from "../../adapters/codex/shared";
import {
  createDataStackCodexReportArtifact,
  DATA_STACK_CODEX_PATCH_PATHS,
  type DataStackCodexPatch,
  type DataStackCodexPatchPath,
  type DataStackCodexRecommendation,
  type DataStackCodexReportArtifact,
} from "./codex-report";
import type { DataStackDiagnosticsResult } from "./diagnostics";
import type { DataStackPlanArtifact } from "./plan";

const DATA_STACK_CODEX_TIMEOUT_MS = 30_000;

export const DATA_STACK_CODEX_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          reasoning_summary: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          patches: {
            type: "array",
            items: {
              type: "object",
              properties: {
                op: { type: "string", enum: ["replace"] },
                path: {
                  type: "string",
                  enum: [...DATA_STACK_CODEX_PATCH_PATHS],
                },
                value: {
                  type: ["string", "array"],
                  items: { type: "string" },
                },
              },
              required: ["op", "path", "value"],
              additionalProperties: false,
            },
          },
        },
        required: ["id", "title", "reasoning_summary", "confidence", "patches"],
        additionalProperties: false,
      },
    },
  },
  required: ["recommendations"],
  additionalProperties: false,
} as const;

export type DataStackCodexRunner = (options: {
  prompt: string;
  timeoutMs?: number;
  workingDirectory: string;
}) => Promise<string>;

export type DataStackCodexAssistFailureKind = "structured-output-schema" | "unavailable";

export interface SuggestDataStackWithCodexOptions {
  diagnostics: DataStackDiagnosticsResult;
  now: Date;
  plan: DataStackPlanArtifact;
  runner?: DataStackCodexRunner;
  timeoutMs?: number;
  workingDirectory: string;
}

function buildDataStackCodexPrompt(options: {
  diagnostics: DataStackDiagnosticsResult;
  plan: DataStackPlanArtifact;
}): string {
  const { diagnostics, plan } = options;
  const facts = {
    candidateUniqueKeys: plan.diagnostics.candidateUniqueKeys,
    columnSummaries: diagnostics.columnSummaries,
    duplicateKeyNullRows: diagnostics.duplicateKeyNullRows,
    duplicateSummary: diagnostics.duplicateSummary,
    duplicates: plan.duplicates,
    input: plan.input,
    output: plan.output,
    rowCount: plan.diagnostics.rowCount,
    schema: plan.schema,
    sources: {
      pattern: plan.sources.pattern,
      recursive: plan.sources.recursive,
      totalResolved: plan.sources.resolved.length,
    },
  };

  return [
    "Review this data stack dry-run plan and return advisory recommendations.",
    "Return JSON only following the provided schema.",
    "",
    "Rules:",
    "- Recommendations are advisory only; do not assume they will be applied automatically.",
    "- Use only replace patches against the allowed JSON Pointer paths.",
    "- Prefer the smallest deterministic patch that expresses the recommendation.",
    "- Recommend headerless column names only through /input/columns.",
    "- Recommend schema mode changes only through /schema/mode with strict or union-by-name.",
    "- Recommend unique key changes only through /duplicates/uniqueBy.",
    "- Recommend duplicate policy changes only through /duplicates/policy.",
    "- Keep reasoning_summary short and grounded in the facts.",
    "",
    "Allowed duplicate policies: preserve, report, reject.",
    "",
    "Deterministic facts:",
    JSON.stringify(facts, null, 2),
  ].join("\n");
}

function parseCodexAssistRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Codex stack response ${context} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function parseCodexAssistString(value: unknown, context: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Codex stack response ${context} must be a non-empty string.`);
  }
  return value.trim();
}

function parseCodexAssistConfidence(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Codex stack response ${context} must be a finite number.`);
  }
  return Math.max(0, Math.min(1, value));
}

function parseCodexAssistPatchPath(value: unknown, context: string): DataStackCodexPatchPath {
  if (
    typeof value === "string" &&
    (DATA_STACK_CODEX_PATCH_PATHS as readonly string[]).includes(value)
  ) {
    return value as DataStackCodexPatchPath;
  }
  throw new Error(
    `Codex stack response ${context} must be one of: ${DATA_STACK_CODEX_PATCH_PATHS.join(", ")}.`,
  );
}

function parseCodexAssistPatch(value: unknown, context: string): DataStackCodexPatch {
  const patch = parseCodexAssistRecord(value, context);
  if (patch.op !== "replace") {
    throw new Error(`Codex stack response ${context}.op must be replace.`);
  }
  if (!("value" in patch)) {
    throw new Error(`Codex stack response ${context}.value is required.`);
  }
  return {
    op: "replace",
    path: parseCodexAssistPatchPath(patch.path, `${context}.path`),
    value: patch.value,
  };
}

function parseDataStackCodexRecommendation(value: unknown): DataStackCodexRecommendation {
  const record = parseCodexAssistRecord(value, "recommendations[]");
  if (!Array.isArray(record.patches) || record.patches.length === 0) {
    throw new Error("Codex stack response recommendations[].patches must be a non-empty array.");
  }
  return {
    confidence: parseCodexAssistConfidence(record.confidence, "recommendations[].confidence"),
    id: parseCodexAssistString(record.id, "recommendations[].id"),
    patches: record.patches.map((patch, index) =>
      parseCodexAssistPatch(patch, `recommendations[].patches[${index}]`),
    ),
    reasoningSummary: parseCodexAssistString(
      record.reasoning_summary,
      "recommendations[].reasoning_summary",
    ),
    title: parseCodexAssistString(record.title, "recommendations[].title"),
  };
}

function parseDataStackCodexRecommendations(finalResponse: string): DataStackCodexRecommendation[] {
  const parsed = JSON.parse(finalResponse) as {
    recommendations?: unknown;
  };
  if (!Array.isArray(parsed.recommendations)) {
    throw new Error("Codex stack response did not include recommendations.");
  }
  return parsed.recommendations.map(parseDataStackCodexRecommendation);
}

export function classifyDataStackCodexAssistFailure(
  error: unknown,
): DataStackCodexAssistFailureKind {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("invalid_json_schema") ||
    message.includes("invalid_request_error") ||
    message.includes("response_format") ||
    message.trim().startsWith("{")
  ) {
    return "structured-output-schema";
  }
  return "unavailable";
}

export function formatDataStackCodexAssistFailure(error: unknown): string {
  if (classifyDataStackCodexAssistFailure(error) === "structured-output-schema") {
    return "Codex stack recommendations unavailable: Codex rejected the structured recommendation schema.";
  }
  return "Codex stack recommendations unavailable. Review failed before recommendations were returned.";
}

async function runDataStackCodexPrompt(options: {
  prompt: string;
  timeoutMs?: number;
  workingDirectory: string;
}): Promise<string> {
  const thread = startCodexReadOnlyThread(options.workingDirectory);
  const turn = await thread.run([{ type: "text", text: options.prompt }], {
    outputSchema: DATA_STACK_CODEX_OUTPUT_SCHEMA,
    signal: AbortSignal.timeout(options.timeoutMs ?? DATA_STACK_CODEX_TIMEOUT_MS),
  });
  return turn.finalResponse;
}

export async function suggestDataStackWithCodex(
  options: SuggestDataStackWithCodexOptions,
): Promise<DataStackCodexReportArtifact> {
  const runner = options.runner ?? runDataStackCodexPrompt;
  const finalResponse = await runner({
    prompt: buildDataStackCodexPrompt({
      diagnostics: options.diagnostics,
      plan: options.plan,
    }),
    timeoutMs: options.timeoutMs,
    workingDirectory: options.workingDirectory,
  });
  return createDataStackCodexReportArtifact({
    diagnostics: options.diagnostics,
    now: options.now,
    plan: options.plan,
    recommendations: parseDataStackCodexRecommendations(finalResponse),
  });
}
