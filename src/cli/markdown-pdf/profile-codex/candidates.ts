import { MarkdownPdfCodexProfileError } from "../../../adapters/codex/markdown-pdf-profile";
import type { MarkdownPdfCodexSignalMode } from "../../../adapters/codex/markdown-pdf-profile/types";
import {
  createMarkdownPdfProfileCandidates,
  type MarkdownPdfProfileCandidate,
} from "../profile/candidates";
import { executionModeForMarkdownPdfProfileCodexSignalMode } from "./signal-mode";

interface MarkdownPdfCodexProfileCandidateResolutionBase {
  candidates: MarkdownPdfProfileCandidate[];
  strongestCandidate: MarkdownPdfProfileCandidate;
}

export interface MarkdownPdfCodexProfileDeterministicCandidateResolution extends MarkdownPdfCodexProfileCandidateResolutionBase {
  executionMode: "deterministic";
  selectedCandidate: MarkdownPdfProfileCandidate;
}

export interface MarkdownPdfCodexProfileCodexAssistedCandidateResolution extends MarkdownPdfCodexProfileCandidateResolutionBase {
  executionMode: "codex-assisted";
}

export type MarkdownPdfCodexProfileCandidateResolution =
  | MarkdownPdfCodexProfileDeterministicCandidateResolution
  | MarkdownPdfCodexProfileCodexAssistedCandidateResolution;

function requireStrongestMarkdownPdfProfileCandidate(
  candidates: MarkdownPdfProfileCandidate[],
): MarkdownPdfProfileCandidate {
  const candidate = candidates[0];
  if (!candidate) {
    throw new MarkdownPdfCodexProfileError(
      "No Markdown PDF profile candidates are available.",
      "invalid-application",
    );
  }
  return candidate;
}

function requireBaseMarkdownPdfProfileCandidate(
  candidate: MarkdownPdfProfileCandidate | undefined,
): MarkdownPdfProfileCandidate {
  if (!candidate) {
    throw new MarkdownPdfCodexProfileError(
      "No base Markdown PDF profile candidate is available.",
      "invalid-application",
    );
  }
  return candidate;
}

export function resolveMarkdownPdfCodexProfileCandidates(input: {
  baseProfileCandidate?: MarkdownPdfProfileCandidate;
  baseProfileRole?: "authoritative" | "candidate";
  signalMode: MarkdownPdfCodexSignalMode;
}): MarkdownPdfCodexProfileCandidateResolution {
  const candidates =
    input.baseProfileCandidate && input.baseProfileRole === "authoritative"
      ? [input.baseProfileCandidate]
      : createMarkdownPdfProfileCandidates();
  if (input.baseProfileCandidate && input.baseProfileRole !== "authoritative") {
    candidates.unshift(input.baseProfileCandidate);
  }
  const strongestCandidate =
    input.baseProfileCandidate ?? requireStrongestMarkdownPdfProfileCandidate(candidates);
  const executionMode = executionModeForMarkdownPdfProfileCodexSignalMode(input.signalMode);
  if (executionMode === "deterministic") {
    return {
      candidates,
      executionMode,
      selectedCandidate:
        input.signalMode === "base-only-deterministic"
          ? requireBaseMarkdownPdfProfileCandidate(input.baseProfileCandidate)
          : strongestCandidate,
      strongestCandidate,
    };
  }

  return {
    candidates,
    executionMode,
    strongestCandidate,
  };
}
