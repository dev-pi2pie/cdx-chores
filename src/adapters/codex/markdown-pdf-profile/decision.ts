import { validateMarkdownPdfProfileShape } from "../../../cli/markdown-pdf/profile/schema";
import type { MarkdownPdfProfileCandidate } from "../../../cli/markdown-pdf/profile/candidates";
import { normalizeMarkdownPdfProfile } from "../../../cli/markdown-pdf/profile/normalize";
import {
  MARKDOWN_PDF_CODEX_DECISION_MODES,
  MARKDOWN_PDF_CODEX_FONT_PATCH_ROLES,
  MARKDOWN_PDF_CODEX_PATCH_PATHS,
  type MarkdownPdfCodexDecision,
  type MarkdownPdfCodexDecisionMode,
  type MarkdownPdfCodexFontPatchRole,
  type MarkdownPdfCodexPatchPath,
  type MarkdownPdfCodexPatchValue,
  type MarkdownPdfCodexProfileFontPatch,
  type MarkdownPdfCodexProfilePatch,
  type MarkdownPdfCodexProfileResult,
} from "./types";
import { validateMarkdownPdfCodexPatchValueDomain } from "./value-domains";

const ACCEPTED_PATCH_PATHS = new Set<string>(MARKDOWN_PDF_CODEX_PATCH_PATHS);
const ACCEPTED_FONT_PATCH_ROLES = new Set<string>(MARKDOWN_PDF_CODEX_FONT_PATCH_ROLES);
const MATERIALIZABLE_PATCH_PARENT_PATHS = new Set([
  "/toc",
  "/pdf",
  "/cover",
  "/cover/fields",
  "/header",
  "/footer",
  "/pageNumbers",
  "/code",
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
  if (typeof value !== "string") {
    throw new Error(`Markdown PDF Codex response ${context} must be a string.`);
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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

function parsePatchPath(value: unknown, context: string): MarkdownPdfCodexPatchPath {
  if (typeof value === "string" && ACCEPTED_PATCH_PATHS.has(value)) {
    return value as MarkdownPdfCodexPatchPath;
  }
  throw new Error(
    `Markdown PDF Codex response ${context} must be one of: ${MARKDOWN_PDF_CODEX_PATCH_PATHS.join(", ")}.`,
  );
}

function parsePatchValue(value: unknown, context: string): MarkdownPdfCodexPatchValue {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
  ) {
    return structuredClone(value) as MarkdownPdfCodexPatchValue;
  }
  throw new Error(
    `Markdown PDF Codex response ${context} must be a string, number, boolean, or string array.`,
  );
}

function parseFontPatchRole(value: unknown, context: string): MarkdownPdfCodexFontPatchRole {
  if (typeof value === "string" && ACCEPTED_FONT_PATCH_ROLES.has(value)) {
    return value as MarkdownPdfCodexFontPatchRole;
  }
  throw new Error(
    `Markdown PDF Codex response ${context} must be one of: ${MARKDOWN_PDF_CODEX_FONT_PATCH_ROLES.join(", ")}.`,
  );
}

function parseAcceptedPatch(value: unknown, context: string): MarkdownPdfCodexProfilePatch {
  const patch = parseRecord(value, context);
  if (patch.op !== "replace") {
    throw new Error(`Markdown PDF Codex response ${context}.op must be replace.`);
  }
  if (!("value" in patch)) {
    throw new Error(`Markdown PDF Codex response ${context}.value is required.`);
  }
  return {
    op: "replace",
    path: parsePatchPath(patch.path, `${context}.path`),
    value: parsePatchValue(patch.value, `${context}.value`),
  };
}

function parseAcceptedFontPatch(value: unknown, context: string): MarkdownPdfCodexProfileFontPatch {
  const patch = parseRecord(value, context);
  if (patch.op !== "replace-font") {
    throw new Error(`Markdown PDF Codex response ${context}.op must be replace-font.`);
  }
  return {
    op: "replace-font",
    role: parseFontPatchRole(patch.role, `${context}.role`),
    key: parseString(patch.key, `${context}.key`),
    value: parseString(patch.value, `${context}.value`),
  };
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

function parseAcceptedPatches(value: unknown): MarkdownPdfCodexProfilePatch[] {
  if (!Array.isArray(value)) {
    throw new Error("Markdown PDF Codex response accepted_patches must be an array.");
  }
  return value.map((patch, index) => parseAcceptedPatch(patch, `accepted_patches[${index}]`));
}

function parseAcceptedFontPatches(value: unknown): MarkdownPdfCodexProfileFontPatch[] {
  if (!Array.isArray(value)) {
    throw new Error("Markdown PDF Codex response accepted_font_patches must be an array.");
  }
  return value.map((patch, index) =>
    parseAcceptedFontPatch(patch, `accepted_font_patches[${index}]`),
  );
}

export function parseMarkdownPdfCodexDecision(finalResponse: string): MarkdownPdfCodexDecision {
  const parsed = parseRecord(JSON.parse(finalResponse), "root");
  const decisionMode = parseDecisionMode(parsed.decision_mode);
  const selectedCandidateId = parseString(parsed.selected_candidate_id, "selected_candidate_id");
  const acceptedPatches = parseAcceptedPatches(parsed.accepted_patches);
  const acceptedFontPatches = parseAcceptedFontPatches(parsed.accepted_font_patches);
  if (decisionMode === "no-usable-profile") {
    if (selectedCandidateId !== "none") {
      throw new Error(
        "Markdown PDF Codex response selected_candidate_id must be none for no-usable-profile.",
      );
    }
    if (acceptedPatches.length > 0) {
      throw new Error(
        "Markdown PDF Codex response accepted_patches must be empty for no-usable-profile.",
      );
    }
    if (acceptedFontPatches.length > 0) {
      throw new Error(
        "Markdown PDF Codex response accepted_font_patches must be empty for no-usable-profile.",
      );
    }
  }

  return {
    acceptedFontPatches,
    acceptedPatches,
    decisionMode,
    fallbackReason: parseOptionalString(parsed.fallback_reason, "fallback_reason"),
    reasoning: parseString(parsed.reasoning, "reasoning"),
    selectedCandidateId,
    unmatchedDirections: parseStringArray(parsed.unmatched_directions, "unmatched_directions"),
    warnings: parseStringArray(parsed.warnings, "warnings"),
  };
}

function applyAcceptedProfilePatches(
  base: Record<string, unknown>,
  acceptedPatches: readonly MarkdownPdfCodexProfilePatch[],
): Record<string, unknown> {
  const merged = structuredClone(base) as Record<string, unknown>;
  for (const [index, patch] of acceptedPatches.entries()) {
    validateMarkdownPdfCodexPatchValueDomain({
      context: `accepted_patches[${index}].value`,
      path: patch.path,
      value: patch.value,
    });
    const segments = patch.path.slice(1).split("/");
    let target = merged;
    const parentSegments = segments.slice(0, -1);
    for (const [segmentIndex, segment] of parentSegments.entries()) {
      const existing = target[segment];
      const parentPath = `/${segments.slice(0, segmentIndex + 1).join("/")}`;
      if (existing === undefined && MATERIALIZABLE_PATCH_PARENT_PATHS.has(parentPath)) {
        target[segment] = {};
        target = target[segment] as Record<string, unknown>;
        continue;
      }
      if (typeof existing !== "object" || existing === null || Array.isArray(existing)) {
        throw new Error(
          `Markdown PDF Codex response accepted_patches path cannot replace nested value at ${patch.path}.`,
        );
      }
      target = target[segment] as Record<string, unknown>;
    }
    const last = segments.at(-1);
    if (!last) {
      throw new Error(
        `Markdown PDF Codex response accepted_patches path is invalid: ${patch.path}`,
      );
    }
    target[last] = structuredClone(patch.value);
  }
  validateMarkdownPdfProfileShape(merged);
  normalizeMarkdownPdfProfile({ profile: merged });
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
  const profile = applyAcceptedProfilePatches(
    candidate.fullProfile,
    options.decision.acceptedPatches,
  );
  validateMarkdownPdfProfileShape(profile);
  normalizeMarkdownPdfProfile({ profile });
  return { decision: options.decision, profile };
}
