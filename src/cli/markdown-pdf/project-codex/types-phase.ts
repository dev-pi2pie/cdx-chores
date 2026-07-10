import type { MarkdownPdfProjectCodexDecisionMode } from "./types-modes";

export type MarkdownPdfProjectCodexProfilePhaseSignalMode =
  | "document-informed"
  | "hint-only"
  | "mixed-with-base"
  | "base-only-deterministic"
  | "basic-default";

export type MarkdownPdfProjectCodexTemplatePhaseSignalMode =
  | "base-profile-only"
  | "cover-image-only"
  | "deterministic"
  | "codex-assisted";

interface MarkdownPdfProjectCodexPhaseSummaryBase {
  decisionMode: MarkdownPdfProjectCodexDecisionMode;
  fallbackReason?: string;
  warnings: string[];
}

export interface MarkdownPdfProjectCodexProfilePhaseSummary extends MarkdownPdfProjectCodexPhaseSummaryBase {
  phase: "profile";
  signalMode: MarkdownPdfProjectCodexProfilePhaseSignalMode;
}

export interface MarkdownPdfProjectCodexTemplatePhaseSummary extends MarkdownPdfProjectCodexPhaseSummaryBase {
  phase: "template";
  signalMode: MarkdownPdfProjectCodexTemplatePhaseSignalMode;
}

export type MarkdownPdfProjectCodexPhaseSummary =
  | MarkdownPdfProjectCodexProfilePhaseSummary
  | MarkdownPdfProjectCodexTemplatePhaseSummary;
