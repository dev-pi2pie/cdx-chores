import type {
  MarkdownPdfDocumentSignals,
  MarkdownPdfFontSignals,
} from "../../../cli/markdown-pdf/profile/signals";
import type {
  MarkdownPdfProfileCandidateSummary,
  MarkdownPdfProfileCandidate,
} from "../../../cli/markdown-pdf/profile/candidates";
import type { MarkdownPdfPreset } from "../../../cli/markdown-pdf/validation";

export const MARKDOWN_PDF_CODEX_DECISION_MODES = [
  "adapted",
  "conservative-fallback",
  "no-usable-profile",
] as const;

export type MarkdownPdfCodexDecisionMode = (typeof MARKDOWN_PDF_CODEX_DECISION_MODES)[number];

export type MarkdownPdfCodexSignalMode =
  | "document-informed"
  | "hint-only"
  | "mixed-with-base"
  | "base-only-deterministic"
  | "basic-default";

export interface MarkdownPdfCodexProfileRequest {
  candidates: MarkdownPdfProfileCandidate[];
  documentSignals: MarkdownPdfDocumentSignals;
  fontHints: string[];
  fontSignals: MarkdownPdfFontSignals;
  intent?: string;
  selectedBaseProfileSummary?: MarkdownPdfProfileCandidateSummary;
  signalMode: MarkdownPdfCodexSignalMode;
  supportedSchemaSummary: string[];
  workingDirectory: string;
}

export interface MarkdownPdfCodexDecision {
  acceptedFields: Record<string, unknown>;
  decisionMode: MarkdownPdfCodexDecisionMode;
  fallbackReason?: string;
  reasoning: string;
  selectedCandidateId: string;
  unmatchedDirections: string[];
  warnings: string[];
}

export interface MarkdownPdfCodexProfileResult {
  decision: MarkdownPdfCodexDecision;
  profile?: Record<string, unknown>;
}

export interface MarkdownPdfCodexReportPayload {
  candidateSummaries: MarkdownPdfProfileCandidateSummary[];
  decision: MarkdownPdfCodexDecision;
  documentSignals: MarkdownPdfDocumentSignals;
  fontSignals: MarkdownPdfFontSignals;
  intent?: string;
  selectedPreset?: MarkdownPdfPreset;
}

export type MarkdownPdfCodexProfileRunner = (options: {
  prompt: string;
  timeoutMs?: number;
  workingDirectory: string;
}) => Promise<string>;
