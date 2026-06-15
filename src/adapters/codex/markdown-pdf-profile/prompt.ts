import type { MarkdownPdfCodexProfileRequest } from "./types";
import { MARKDOWN_PDF_CODEX_PATCH_VALUE_DOMAINS } from "./value-domains";

const MARKDOWN_PDF_CODEX_STYLE_DECISION_POLICY = {
  stylePolicy: [
    "Treat the profile as reusable rendering settings, not a one-off design.",
    "Do not add report chrome only because intent says clean, proper, polished, or professional.",
    "Enable cover, ToC, headers, footers, or page numbers only when document signals or explicit intent justify them.",
    "For README-like or short technical docs, prefer conservative defaults plus code and font improvements.",
  ],
  featureTriggers: {
    cover: [
      "Enable only when explicitly requested or when metadata/title signals make a cover useful.",
      "Prefer plain cover unless report styling is explicitly requested or the selected candidate is clearly report-like.",
    ],
    toc: [
      "Enable when heading count and depth suggest navigation value.",
      "Do not enable for shallow or short documents.",
    ],
    pageNumbers: [
      "Enable for long-form reports, manuals, specifications, or explicit page-number intent.",
      "Do not enable page numbers by default for README-like documents.",
      "Avoid total-page formats unless total-page semantics are deterministic and documented.",
    ],
    code: [
      "Enable highlighting when code fences are present.",
      "Enable line numbers only for code-heavy reference material, not ordinary READMEs.",
    ],
  },
  rendererCompatibility: [
    "Return only profile fields; never raw CSS or HTML.",
    "Do not choose settings known to produce renderer warnings.",
    "If a requested style depends on unsupported renderer behavior, choose the closest warning-free profile and explain the mismatch in warnings.",
  ],
};

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
    styleDecisionPolicy: MARKDOWN_PDF_CODEX_STYLE_DECISION_POLICY,
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
    "- Follow styleDecisionPolicy when deciding cover, ToC, page-number, code, and renderer-compatible changes.",
    "- Use conservative-fallback when facts are weak but a safe default profile can be written.",
    "- Use no-usable-profile only when no profile should be written; set selected_candidate_id to none and accepted_patches to [].",
    "- Always include fallback_reason; use an empty string when no fallback reason applies.",
    "- Keep reasoning short and grounded in the facts.",
    "",
    "Deterministic facts:",
    JSON.stringify(facts, null, 2),
  ].join("\n");
}
