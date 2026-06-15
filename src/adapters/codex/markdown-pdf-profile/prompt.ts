import type { MarkdownPdfCodexProfileRequest } from "./types";
import { MARKDOWN_PDF_CODEX_PATCH_VALUE_DOMAINS } from "./value-domains";

export function buildMarkdownPdfProfileCodexPrompt(
  request: MarkdownPdfCodexProfileRequest,
): string {
  const facts = {
    candidateSummaries: request.candidates.map((candidate) => candidate.summary),
    documentSignals: request.documentSignals,
    fontHints: request.fontHints,
    fontSignals: request.fontSignals,
    intent: request.intent ?? "",
    selectedBaseProfileSummary: request.selectedBaseProfileSummary,
    patchValueDomains: MARKDOWN_PDF_CODEX_PATCH_VALUE_DOMAINS,
    signalMode: request.signalMode,
    supportedSchemaSummary: request.supportedSchemaSummary,
  };

  return [
    "Review bounded Markdown PDF facts and recommend a reusable profile adaptation.",
    "Return JSON only following the provided schema.",
    "",
    "Rules:",
    "- Select one candidate by id.",
    "- Do not write YAML, CSS, HTML, file paths, or raw Markdown snippets.",
    "- Use accepted_patches for small replace patches against allowed Markdown PDF profile paths.",
    "- For paths listed in patchValueDomains, use only those exact values.",
    "- Do not return profile objects or arbitrary nested fields.",
    "- Prefer small adaptations over broad rewrites.",
    "- Use conservative-fallback when facts are weak but a safe default profile can be written.",
    "- Use no-usable-profile only when no profile should be written; set selected_candidate_id to none and accepted_patches to [].",
    "- Always include fallback_reason; use an empty string when no fallback reason applies.",
    "- Keep reasoning short and grounded in the facts.",
    "",
    "Deterministic facts:",
    JSON.stringify(facts, null, 2),
  ].join("\n");
}
