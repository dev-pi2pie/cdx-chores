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

export const MARKDOWN_PDF_CODEX_SIGNAL_MODES = [
  "document-informed",
  "hint-only",
  "mixed-with-base",
  "base-only-deterministic",
  "basic-default",
] as const;

export type MarkdownPdfCodexSignalMode = (typeof MARKDOWN_PDF_CODEX_SIGNAL_MODES)[number];

export const MARKDOWN_PDF_CODEX_PATCH_PATHS = [
  "/page/size",
  "/page/orientation",
  "/page/margin",
  "/page/marginX",
  "/page/marginY",
  "/page/marginTop",
  "/page/marginRight",
  "/page/marginBottom",
  "/page/marginLeft",
  "/toc/enabled",
  "/toc/depth",
  "/toc/pageBreak",
  "/pdf/content-langs",
  "/cover/enabled",
  "/cover/style",
  "/cover/fields/title",
  "/cover/fields/subtitle",
  "/cover/fields/author",
  "/cover/fields/company",
  "/cover/fields/date",
  "/header/left",
  "/header/center",
  "/header/right",
  "/footer/left",
  "/footer/center",
  "/footer/right",
  "/pageNumbers/enabled",
  "/pageNumbers/position",
  "/pageNumbers/format",
  "/pageNumbers/scope",
  "/code/highlight",
  "/code/theme",
  "/code/lineNumbers",
  "/code/transformerNotation",
] as const;

export type MarkdownPdfCodexPatchPath = (typeof MARKDOWN_PDF_CODEX_PATCH_PATHS)[number];
export type MarkdownPdfCodexPatchValue = string | number | boolean | string[];

export interface MarkdownPdfCodexProfilePatch {
  op: "replace";
  path: MarkdownPdfCodexPatchPath;
  value: MarkdownPdfCodexPatchValue;
}

export const MARKDOWN_PDF_CODEX_FONT_PATCH_ROLES = [
  "body",
  "heading",
  "code",
  "pageChrome",
] as const;

export type MarkdownPdfCodexFontPatchRole = (typeof MARKDOWN_PDF_CODEX_FONT_PATCH_ROLES)[number];

export interface MarkdownPdfCodexProfileFontPatch {
  op: "replace-font";
  role: MarkdownPdfCodexFontPatchRole;
  key: string;
  value: string;
}

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
  acceptedFontPatches: MarkdownPdfCodexProfileFontPatch[];
  acceptedPatches: MarkdownPdfCodexProfilePatch[];
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
