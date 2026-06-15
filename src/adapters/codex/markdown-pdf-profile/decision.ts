import { validateMarkdownPdfProfileShape } from "../../../cli/markdown-pdf/profile/schema";
import { normalizeMarkdownPdfProfile } from "../../../cli/markdown-pdf/profile/normalize";
import type { MarkdownPdfProfileCandidate } from "../../../cli/markdown-pdf/profile/candidates";
import {
  MARKDOWN_PDF_CODEX_DECISION_MODES,
  type MarkdownPdfCodexDecision,
  type MarkdownPdfCodexDecisionMode,
  type MarkdownPdfCodexProfileResult,
} from "./types";

const ACCEPTED_PROFILE_ROOT_KEYS = new Set([
  "page",
  "toc",
  "metadata",
  "pdf",
  "fonts",
  "cover",
  "header",
  "footer",
  "pageNumbers",
  "code",
]);

function parseRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Markdown PDF Codex response ${context} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function parseString(value: unknown, context: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Markdown PDF Codex response ${context} must be a non-empty string.`);
  }
  return value.trim();
}

function parseOptionalString(value: unknown, context: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return parseString(value, context);
}

function parseStringArray(value: unknown, context: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Markdown PDF Codex response ${context} must be an array of strings.`);
  }
  return value.map((item) => item.trim()).filter((item) => item.length > 0);
}

function parseDecisionMode(value: unknown): MarkdownPdfCodexDecisionMode {
  if (
    typeof value === "string" &&
    (MARKDOWN_PDF_CODEX_DECISION_MODES as readonly string[]).includes(value)
  ) {
    return value as MarkdownPdfCodexDecisionMode;
  }
  throw new Error(
    `Markdown PDF Codex response decision_mode must be one of: ${MARKDOWN_PDF_CODEX_DECISION_MODES.join(", ")}.`,
  );
}

function validateAcceptedFields(value: unknown): Record<string, unknown> {
  const acceptedFields = parseRecord(value, "accepted_fields");
  for (const key of Object.keys(acceptedFields)) {
    if (!ACCEPTED_PROFILE_ROOT_KEYS.has(key)) {
      throw new Error(`Markdown PDF Codex response accepted_fields.${key} is not supported.`);
    }
  }
  validateMarkdownPdfProfileShape(acceptedFields);
  return acceptedFields;
}

export function parseMarkdownPdfCodexDecision(finalResponse: string): MarkdownPdfCodexDecision {
  const parsed = parseRecord(JSON.parse(finalResponse), "root");
  return {
    acceptedFields: validateAcceptedFields(parsed.accepted_fields ?? {}),
    decisionMode: parseDecisionMode(parsed.decision_mode),
    fallbackReason: parseOptionalString(parsed.fallback_reason, "fallback_reason"),
    reasoning: parseString(parsed.reasoning, "reasoning"),
    selectedCandidateId: parseString(parsed.selected_candidate_id, "selected_candidate_id"),
    unmatchedDirections: parseStringArray(
      parsed.unmatched_directions ?? [],
      "unmatched_directions",
    ),
    warnings: parseStringArray(parsed.warnings ?? [], "warnings"),
  };
}

function mergeProfileValue(base: unknown, update: unknown): unknown {
  if (update === undefined) {
    return structuredClone(base);
  }
  if (
    base &&
    update &&
    typeof base === "object" &&
    typeof update === "object" &&
    !Array.isArray(base) &&
    !Array.isArray(update)
  ) {
    const merged: Record<string, unknown> = structuredClone(base) as Record<string, unknown>;
    for (const [key, value] of Object.entries(update as Record<string, unknown>)) {
      if (value !== undefined) {
        merged[key] = mergeProfileValue(merged[key], value);
      }
    }
    return merged;
  }
  return structuredClone(update);
}

function selectedCandidate(
  candidates: readonly MarkdownPdfProfileCandidate[],
  id: string,
): MarkdownPdfProfileCandidate {
  const candidate = candidates.find((item) => item.summary.id === id);
  if (!candidate) {
    throw new Error(`Markdown PDF Codex response selected unknown candidate: ${id}.`);
  }
  return candidate;
}

export function applyMarkdownPdfCodexDecision(options: {
  candidates: readonly MarkdownPdfProfileCandidate[];
  decision: MarkdownPdfCodexDecision;
}): MarkdownPdfCodexProfileResult {
  if (options.decision.decisionMode === "no-usable-profile") {
    return { decision: options.decision };
  }

  const candidate = selectedCandidate(options.candidates, options.decision.selectedCandidateId);
  const profile = mergeProfileValue(
    candidate.fullProfile,
    options.decision.acceptedFields,
  ) as Record<string, unknown>;
  validateMarkdownPdfProfileShape(profile);
  normalizeMarkdownPdfProfile({ profile });
  return { decision: options.decision, profile };
}
