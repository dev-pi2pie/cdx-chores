import { startCodexReadOnlyThread } from "../../../adapters/codex/shared";
import { normalizeHeaderMappingTargetName } from "./normalize";
import type {
  DataHeaderMappingEntry,
  DataHeaderSuggestionEvidence,
  DataHeaderSuggestionIntrospection,
  DataHeaderSuggestionResult,
  DataHeaderSuggestionRunner,
  DataHeaderMappingFormat,
} from "./types";

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
  return values
    .map((value) => truncateForPrompt(value, DATA_HEADER_SUGGESTION_SAMPLE_VALUE_CHARS))
    .join(", ");
}

export function collectHeaderSuggestionEvidence(
  introspection: DataHeaderSuggestionIntrospection,
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
  format: DataHeaderMappingFormat;
  introspection: DataHeaderSuggestionIntrospection;
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
  introspection: DataHeaderSuggestionIntrospection;
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
  const usedTargets = new Set(currentColumns.filter((column) => !candidateTargets.has(column)));
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
  introspection: DataHeaderSuggestionIntrospection,
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
  format: DataHeaderMappingFormat;
  introspection: DataHeaderSuggestionIntrospection;
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
