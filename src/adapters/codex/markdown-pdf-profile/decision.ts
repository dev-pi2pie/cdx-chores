import {
  MARKDOWN_PDF_PROFILE_ROOT_KEYS,
  validateMarkdownPdfProfileShape,
} from "../../../cli/markdown-pdf/profile/schema";
import type { MarkdownPdfProfileCandidate } from "../../../cli/markdown-pdf/profile/candidates";
import {
  MARKDOWN_PDF_CODEX_DECISION_MODES,
  type MarkdownPdfCodexDecision,
  type MarkdownPdfCodexDecisionMode,
  type MarkdownPdfCodexProfileResult,
} from "./types";

const ACCEPTED_PROFILE_ROOT_KEYS = new Set(
  MARKDOWN_PDF_PROFILE_ROOT_KEYS.filter((key) => key !== "profile"),
);

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
  return value.map((item, index) => {
    const trimmed = item.trim();
    if (trimmed.length === 0) {
      throw new Error(`Markdown PDF Codex response ${context}[${index}] must not be empty.`);
    }
    return trimmed;
  });
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
  const decisionMode = parseDecisionMode(parsed.decision_mode);
  const selectedCandidateId = parseString(parsed.selected_candidate_id, "selected_candidate_id");
  const acceptedFields = validateAcceptedFields(parsed.accepted_fields);
  if (decisionMode === "no-usable-profile") {
    if (selectedCandidateId !== "none") {
      throw new Error(
        "Markdown PDF Codex response selected_candidate_id must be none for no-usable-profile.",
      );
    }
    if (Object.keys(acceptedFields).length > 0) {
      throw new Error(
        "Markdown PDF Codex response accepted_fields must be empty for no-usable-profile.",
      );
    }
  }

  return {
    acceptedFields,
    decisionMode,
    fallbackReason: parseOptionalString(parsed.fallback_reason, "fallback_reason"),
    reasoning: parseString(parsed.reasoning, "reasoning"),
    selectedCandidateId,
    unmatchedDirections: parseStringArray(parsed.unmatched_directions, "unmatched_directions"),
    warnings: parseStringArray(parsed.warnings, "warnings"),
  };
}

function mergeProfileSection(base: unknown, update: unknown): unknown {
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
        merged[key] = mergeProfileSection(merged[key], value);
      }
    }
    return merged;
  }
  return structuredClone(update);
}

function mergeAcceptedProfileFields(
  base: Record<string, unknown>,
  acceptedFields: Record<string, unknown>,
): Record<string, unknown> {
  const merged = structuredClone(base) as Record<string, unknown>;
  for (const key of ACCEPTED_PROFILE_ROOT_KEYS) {
    if (Object.hasOwn(acceptedFields, key)) {
      merged[key] = mergeProfileSection(merged[key], acceptedFields[key]);
    }
  }
  return merged;
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
  const profile = mergeAcceptedProfileFields(
    candidate.fullProfile,
    options.decision.acceptedFields,
  );
  validateMarkdownPdfProfileShape(profile);
  return { decision: options.decision, profile };
}
