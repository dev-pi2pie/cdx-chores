import { startCodexReadOnlyThread } from "../../../adapters/codex/shared";
import type {
  RenameCleanupHint,
  RenameCleanupStyle,
  RenameCleanupTimestampAction,
} from "./cleanup-contract";
import {
  RENAME_CLEANUP_ANALYZER_EVIDENCE_LIMITS,
  type RenameCleanupAnalyzerEvidence,
} from "./cleanup-analyzer";

const CLEANUP_HINT_VALUES = [
  "date",
  "timestamp",
  "serial",
  "uid",
] as const satisfies readonly RenameCleanupHint[];
const CLEANUP_STYLE_VALUES = ["preserve", "slug"] as const satisfies readonly RenameCleanupStyle[];
const CLEANUP_TIMESTAMP_ACTION_VALUES = [
  "keep",
  "remove",
] as const satisfies readonly RenameCleanupTimestampAction[];
const RENAME_CLEANUP_CODEX_PROMPT_LIMITS = {
  maxSampleLines: RENAME_CLEANUP_ANALYZER_EVIDENCE_LIMITS.sampleLimit,
  maxGroupedLines: RENAME_CLEANUP_ANALYZER_EVIDENCE_LIMITS.groupLimit,
  maxSampleNameChars: 180,
  maxGroupedExamplesChars: 260,
  maxGroupedSectionChars: 3_000,
} as const;

const CLEANUP_SUGGESTION_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    recommended_hints: {
      type: "array",
      items: {
        type: "string",
        enum: CLEANUP_HINT_VALUES,
      },
    },
    recommended_style: {
      type: "string",
      enum: CLEANUP_STYLE_VALUES,
    },
    recommended_timestamp_action: {
      type: "string",
      enum: [...CLEANUP_TIMESTAMP_ACTION_VALUES, "none"],
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
    },
    reasoning_summary: {
      type: "string",
    },
  },
  required: [
    "recommended_hints",
    "recommended_style",
    "recommended_timestamp_action",
    "confidence",
    "reasoning_summary",
  ],
  additionalProperties: false,
} as const;

export interface RenameCleanupCodexSuggestion {
  recommendedHints: RenameCleanupHint[];
  recommendedStyle: RenameCleanupStyle;
  recommendedTimestampAction?: RenameCleanupTimestampAction;
  confidence: number;
  reasoningSummary: string;
}

export interface RenameCleanupCodexSuggestionResult {
  suggestion?: RenameCleanupCodexSuggestion;
  errorMessage?: string;
}

export type RenameCleanupCodexRunner = (options: {
  prompt: string;
  workingDirectory: string;
  timeoutMs?: number;
}) => Promise<string>;

export interface SuggestRenameCleanupWithCodexOptions {
  evidence: RenameCleanupAnalyzerEvidence;
  workingDirectory: string;
  timeoutMs?: number;
  runner?: RenameCleanupCodexRunner;
}

function isCleanupHint(value: string): value is RenameCleanupHint {
  return CLEANUP_HINT_VALUES.includes(value as RenameCleanupHint);
}

function isCleanupStyle(value: string): value is RenameCleanupStyle {
  return CLEANUP_STYLE_VALUES.includes(value as RenameCleanupStyle);
}

function isCleanupTimestampAction(value: string): value is RenameCleanupTimestampAction {
  return CLEANUP_TIMESTAMP_ACTION_VALUES.includes(value as RenameCleanupTimestampAction);
}

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, value));
}

function parseRenameCleanupSuggestion(finalResponse: string): RenameCleanupCodexSuggestion {
  const parsed = JSON.parse(finalResponse) as {
    recommended_hints?: unknown;
    recommended_style?: unknown;
    recommended_timestamp_action?: unknown;
    confidence?: unknown;
    reasoning_summary?: unknown;
  };

  const recommendedHints = Array.isArray(parsed.recommended_hints)
    ? [
        ...new Set(
          parsed.recommended_hints.filter(
            (item): item is RenameCleanupHint => typeof item === "string" && isCleanupHint(item),
          ),
        ),
      ]
    : [];
  if (recommendedHints.length === 0) {
    throw new Error("Codex cleanup suggestion did not include any supported hints.");
  }

  if (typeof parsed.recommended_style !== "string" || !isCleanupStyle(parsed.recommended_style)) {
    throw new Error("Codex cleanup suggestion returned an unsupported style.");
  }

  const timestampValue =
    typeof parsed.recommended_timestamp_action === "string"
      ? parsed.recommended_timestamp_action
      : "none";
  if (recommendedHints.includes("timestamp")) {
    if (!isCleanupTimestampAction(timestampValue)) {
      throw new Error(
        "Codex cleanup suggestion must include a timestamp action for timestamp hints.",
      );
    }
  } else if (timestampValue !== "none" && !isCleanupTimestampAction(timestampValue)) {
    throw new Error("Codex cleanup suggestion returned an unsupported timestamp action.");
  }

  const reasoningSummary =
    typeof parsed.reasoning_summary === "string" ? parsed.reasoning_summary.trim() : "";
  if (!reasoningSummary) {
    throw new Error("Codex cleanup suggestion did not include reasoning summary.");
  }

  return {
    recommendedHints,
    recommendedStyle: parsed.recommended_style,
    recommendedTimestampAction: isCleanupTimestampAction(timestampValue)
      ? timestampValue
      : undefined,
    confidence: clampConfidence(parsed.confidence),
    reasoningSummary,
  };
}

function truncateForPrompt(value: string, maxChars: number): { value: string; truncated: boolean } {
  if (value.length <= maxChars) {
    return { value, truncated: false };
  }
  if (maxChars <= 3) {
    return { value: value.slice(0, maxChars), truncated: true };
  }
  return {
    value: `${value.slice(0, maxChars - 3)}...`,
    truncated: true,
  };
}

function buildCleanupAnalyzerPrompt(evidence: RenameCleanupAnalyzerEvidence): string {
  const promptSampleNames = evidence.sampleNames.slice(
    0,
    RENAME_CLEANUP_CODEX_PROMPT_LIMITS.maxSampleLines,
  );
  const sampleLines =
    promptSampleNames.length > 0
      ? promptSampleNames.map((name, index) => {
          const truncated = truncateForPrompt(
            name,
            RENAME_CLEANUP_CODEX_PROMPT_LIMITS.maxSampleNameChars,
          );
          return `${index + 1}. ${truncated.value}`;
        })
      : ["(no sampled names)"];
  if (evidence.sampleNames.length > promptSampleNames.length) {
    sampleLines.push(
      `... ${evidence.sampleNames.length - promptSampleNames.length} additional sample name(s) omitted for prompt safety.`,
    );
  }
  const sampleList = sampleLines.join("\n");

  const promptGroupedPatterns = evidence.groupedPatterns.slice(
    0,
    RENAME_CLEANUP_CODEX_PROMPT_LIMITS.maxGroupedLines,
  );
  const groupedLines: string[] = [];
  let emittedGroupedPatternCount = 0;
  let groupedSectionChars = 0;
  for (const [index, group] of promptGroupedPatterns.entries()) {
    const truncatedExamples = truncateForPrompt(
      group.examples.join(" | "),
      RENAME_CLEANUP_CODEX_PROMPT_LIMITS.maxGroupedExamplesChars,
    );
    const nextLine = `${index + 1}. pattern=${group.pattern}; count=${group.count}; examples=${truncatedExamples.value}`;
    const projectedChars =
      groupedSectionChars + (groupedLines.length > 0 ? 1 : 0) + nextLine.length;
    if (projectedChars > RENAME_CLEANUP_CODEX_PROMPT_LIMITS.maxGroupedSectionChars) {
      break;
    }
    groupedLines.push(nextLine);
    emittedGroupedPatternCount += 1;
    groupedSectionChars = projectedChars;
  }
  if (groupedLines.length === 0) {
    groupedLines.push("(no grouped patterns)");
  }
  const omittedByLineLimit = Math.max(
    0,
    evidence.groupedPatterns.length - promptGroupedPatterns.length,
  );
  const omittedBySectionCap = Math.max(0, promptGroupedPatterns.length - groupedLines.length);
  const omittedGroupedCount = omittedByLineLimit + omittedBySectionCap;
  if (omittedGroupedCount > 0) {
    groupedLines.push(`... ${omittedGroupedCount} grouped pattern(s) omitted for prompt safety.`);
  }
  const groupedPatternList = groupedLines.join("\n");

  return [
    "Analyze these filename cleanup candidates and recommend rename-cleanup settings.",
    "Return JSON only following the provided schema.",
    "Goal:",
    "- Infer likely cleanup hint families from filenames only.",
    "- Recommend the best cleanup style for the surviving text.",
    "- Recommend timestamp action only when timestamp hints are included.",
    "",
    "Rules:",
    "- Use only supported hints: date, timestamp, serial, uid.",
    "- Use only supported styles: preserve, slug.",
    "- Use recommended_timestamp_action = none when timestamp is not recommended.",
    "- Keep reasoning_summary short and concrete.",
    "- Do not invent regex rules or content-based reasoning.",
    "",
    `Target kind: ${evidence.targetKind}`,
    `Total candidate count: ${evidence.totalCandidateCount}`,
    `Sampled count: ${evidence.sampledCount}`,
    "",
    `Sample filenames (showing ${promptSampleNames.length} of ${evidence.sampleNames.length}):`,
    sampleList,
    "",
    `Grouped filename patterns (showing ${emittedGroupedPatternCount} of ${evidence.groupedPatterns.length}):`,
    groupedPatternList,
  ].join("\n");
}

async function runRenameCleanupCodexPrompt(options: {
  prompt: string;
  workingDirectory: string;
  timeoutMs?: number;
}): Promise<string> {
  const thread = startCodexReadOnlyThread(options.workingDirectory);
  const turn = await thread.run([{ type: "text", text: options.prompt }], {
    outputSchema: CLEANUP_SUGGESTION_OUTPUT_SCHEMA,
    signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
  });
  return turn.finalResponse;
}

export async function suggestRenameCleanupWithCodex(
  options: SuggestRenameCleanupWithCodexOptions,
): Promise<RenameCleanupCodexSuggestionResult> {
  try {
    const runner = options.runner ?? runRenameCleanupCodexPrompt;
    const finalResponse = await runner({
      prompt: buildCleanupAnalyzerPrompt(options.evidence),
      workingDirectory: options.workingDirectory,
      timeoutMs: options.timeoutMs,
    });
    return {
      suggestion: parseRenameCleanupSuggestion(finalResponse),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { errorMessage: message };
  }
}
