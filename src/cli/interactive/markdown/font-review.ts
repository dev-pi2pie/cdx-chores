import type { MarkdownPdfCodexProfileFontPatch } from "../../../adapters/codex/markdown-pdf-profile";
import type { MarkdownPdfTemplateCodexMaterializedFontDecision } from "../../markdown-pdf/template-codex";
import type { PreparedMarkdownPdfCodexCandidate } from "./codex-types";

export interface MarkdownPdfInteractiveAppliedFontMapping {
  family: string;
  key: string;
  layer: "Profile" | "Template";
  role: string;
}

export interface MarkdownPdfInteractiveBlockedFontMapping extends MarkdownPdfInteractiveAppliedFontMapping {
  reason: string;
}

export interface MarkdownPdfInteractiveFontReview {
  applied: MarkdownPdfInteractiveAppliedFontMapping[];
  blocked: MarkdownPdfInteractiveBlockedFontMapping[];
  unresolved: string[];
}

function profileMappings(
  patches: readonly MarkdownPdfCodexProfileFontPatch[],
): MarkdownPdfInteractiveAppliedFontMapping[] {
  return patches.map((patch) => ({
    family: patch.value,
    key: patch.key,
    layer: "Profile",
    role: patch.role,
  }));
}

function templateMappings(
  decisions: readonly MarkdownPdfTemplateCodexMaterializedFontDecision[],
): Pick<MarkdownPdfInteractiveFontReview, "applied" | "blocked"> {
  const applied: MarkdownPdfInteractiveAppliedFontMapping[] = [];
  const blocked: MarkdownPdfInteractiveBlockedFontMapping[] = [];
  for (const decision of decisions) {
    const mapping = {
      family: decision.family,
      key: decision.key,
      layer: "Template" as const,
      role: decision.role,
    };
    if (decision.status === "applied") {
      applied.push(mapping);
    } else {
      blocked.push({ ...mapping, reason: decision.reason.replaceAll("-", " ") });
    }
  }
  return { applied, blocked };
}

export function collectMarkdownPdfInteractiveFontReview(
  candidate: PreparedMarkdownPdfCodexCandidate,
): MarkdownPdfInteractiveFontReview {
  if (candidate.setup.fontHints.length === 0) {
    return { applied: [], blocked: [], unresolved: [] };
  }
  if (candidate.artifact === "profile") {
    if (candidate.prepared.kind !== "profile") {
      return { applied: [], blocked: [], unresolved: [] };
    }
    return {
      applied: profileMappings(candidate.prepared.result?.decision.acceptedFontPatches ?? []),
      blocked: [],
      unresolved: candidate.prepared.result?.decision.unmatchedDirections ?? [],
    };
  }
  if (candidate.artifact === "template-bundle") {
    return {
      ...templateMappings(candidate.prepared.synthesis.fontDecisions),
      unresolved: candidate.prepared.synthesis.unsupportedDirections ?? [],
    };
  }
  const template = templateMappings(candidate.prepared.templatePhase.synthesis.fontDecisions);
  return {
    applied: [
      ...profileMappings(
        candidate.prepared.profilePhase.codexResult?.decision.acceptedFontPatches ?? [],
      ),
      ...template.applied,
    ],
    blocked: template.blocked,
    unresolved: candidate.prepared.binding.reportArtifact.unsupportedDirections,
  };
}
