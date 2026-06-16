import type { MarkdownPdfCodexProfileRequest } from "./types";
import { MARKDOWN_PDF_CODEX_PATCH_VALUE_DOMAINS } from "./value-domains";

type MarkdownPdfTableLayoutRiskLevel = "none" | "weak" | "strong";

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
      "When titleDecisionSignal.duplicateVisibleTitleRisk is true and explicit cover intent is false, keep cover disabled and avoid extra title treatment.",
      "When explicit cover intent is true and duplicateVisibleTitleRisk is true, cover may be enabled only with a warning that profile settings cannot suppress a duplicate body H1.",
      "When explicit no-cover or no-title-page intent is true, keep cover disabled and avoid extra title chrome.",
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
    tableLayout: [
      "Strong tableLayoutSignal should prefer the wide-table candidate or landscape/table-friendly accepted patches unless intent explicitly requires portrait.",
      "Weak tableLayoutSignal should not force landscape by itself.",
      "Table overflow rows and high max line width are stronger table-fit evidence than column count alone.",
      "Let table-fit evidence outweigh generic clean, proper, polished, or professional wording.",
    ],
  },
  rendererCompatibility: [
    "Return only profile fields; never raw CSS or HTML.",
    "Do not choose settings known to produce renderer warnings.",
    "Do not remove body headings, mutate frontmatter, or invent unsupported title-suppression fields.",
    "Do not invent profile fields for local cover images, arbitrary CSS, custom HTML, or template-only layout.",
    "If a requested style depends on unsupported renderer behavior, choose the closest warning-free profile and explain the mismatch in warnings.",
    "Report unsupported profile directions such as local cover images, arbitrary CSS, custom HTML, or template-only layout in unmatched_directions.",
  ],
};

const MARKDOWN_PDF_CODEX_FONT_PATCH_CONTRACT = {
  field: "accepted_font_patches",
  rules: [
    "Use accepted_font_patches for all profile font writes.",
    "Do not use accepted_patches for /fonts/... paths.",
    "Use --font-hint evidence only as a font preference signal; do not invent additional dedicated hint fields.",
    "If a font request cannot be represented by body, heading, code, or pageChrome font maps, report it in warnings or unmatched_directions.",
  ],
  examples: [
    { op: "replace-font", role: "body", key: "ja", value: "Noto Serif JP" },
    { op: "replace-font", role: "code", key: "symbols", value: "Noto Sans Symbols 2" },
  ],
};

function tableLayoutRiskLevel(
  tables: MarkdownPdfCodexProfileRequest["documentSignals"]["tables"],
): MarkdownPdfTableLayoutRiskLevel {
  if (tables.overflowRows > 0 || tables.maxLineWidth >= 100 || tables.maxColumns >= 8) {
    return "strong";
  }
  if (tables.scannedRows > 0 || tables.maxLineWidth >= 80 || tables.maxColumns >= 5) {
    return "weak";
  }
  return "none";
}

function buildTableLayoutSignal(
  tables: MarkdownPdfCodexProfileRequest["documentSignals"]["tables"],
) {
  const level = tableLayoutRiskLevel(tables);
  const reasons: string[] = [];
  if (tables.overflowRows > 0) {
    reasons.push("table rows exceeded the bounded scan limit");
  }
  if (tables.maxLineWidth >= 100) {
    reasons.push("table rows have high line width");
  } else if (tables.maxLineWidth >= 80) {
    reasons.push("table rows have moderate line width");
  }
  if (tables.maxColumns >= 8) {
    reasons.push("table rows have many columns");
  } else if (tables.maxColumns >= 5) {
    reasons.push("table rows have moderately many columns");
  }
  if (tables.scannedRows > 0 && reasons.length === 0) {
    reasons.push("tables are present but table-fit risk is weak");
  }

  return {
    level,
    reasons,
    recommendation:
      level === "strong"
        ? "Prefer wide-table or landscape/table-friendly profile settings unless intent explicitly requires portrait."
        : level === "weak"
          ? "Treat table presence as supporting evidence only; do not force landscape by itself."
          : "No table layout signal.",
    signalLadder: ["overflowRows", "maxLineWidth", "maxColumns", "scannedRows"],
    templateOnlyDirections: [
      "custom table column widths",
      "arbitrary table CSS",
      "rotated individual pages",
      "exact table beautification",
    ],
  };
}

function hasExplicitNoCoverIntent(intent: string): boolean {
  return /\b(no|without|skip|disable|avoid)\s+(a\s+)?(cover|cover page|title page|title-page)\b/i.test(
    intent,
  );
}

function hasExplicitCoverIntent(intent: string): boolean {
  if (hasExplicitNoCoverIntent(intent)) {
    return false;
  }
  return /\b(cover|cover page|title page|title-page)\b/i.test(intent);
}

function buildTitleDecisionSignal(request: MarkdownPdfCodexProfileRequest) {
  const intent = request.intent ?? "";
  const explicitCoverIntent = hasExplicitCoverIntent(intent);
  const explicitNoCoverIntent = hasExplicitNoCoverIntent(intent);
  const duplicateVisibleTitleRisk = request.documentSignals.title.duplicateVisibleTitleRisk;

  return {
    ...request.documentSignals.title,
    explicitCoverIntent,
    explicitNoCoverIntent,
    recommendation: explicitNoCoverIntent
      ? "Keep cover disabled and avoid extra title chrome."
      : explicitCoverIntent
        ? duplicateVisibleTitleRisk
          ? "Cover may be enabled because the user asked for it, but warn that profile settings cannot suppress a duplicate body H1."
          : "Cover may be enabled when supported profile fields fit the request."
        : duplicateVisibleTitleRisk
          ? "Treat the first H1 as the visible document title; do not enable cover or extra title treatment."
          : "Use conservative title treatment unless other document signals justify cover.",
    profileBoundary: [
      "Do not rewrite Markdown.",
      "Do not mutate frontmatter.",
      "Do not invent title-suppression profile fields.",
      "Report unsupported title or cover behavior in warnings or unmatched_directions.",
    ],
  };
}

export function buildMarkdownPdfProfileCodexPrompt(
  request: MarkdownPdfCodexProfileRequest,
): string {
  const facts = {
    candidateSummaries: request.candidates.map((candidate) => candidate.summary),
    documentSignals: request.documentSignals,
    fontHints: request.fontHints,
    fontPatchContract: MARKDOWN_PDF_CODEX_FONT_PATCH_CONTRACT,
    fontSignals: request.fontSignals,
    intent: request.intent ?? "",
    selectedBaseProfileSummary: request.selectedBaseProfileSummary,
    patchValueDomains: MARKDOWN_PDF_CODEX_PATCH_VALUE_DOMAINS,
    signalMode: request.signalMode,
    styleDecisionPolicy: MARKDOWN_PDF_CODEX_STYLE_DECISION_POLICY,
    supportedSchemaSummary: request.supportedSchemaSummary,
    tableLayoutSignal: buildTableLayoutSignal(request.documentSignals.tables),
    titleDecisionSignal: buildTitleDecisionSignal(request),
  };

  return [
    "Review bounded Markdown PDF facts and recommend a reusable profile adaptation.",
    "Return JSON only following the provided schema.",
    "",
    "Rules:",
    "- Select one candidate by id.",
    "- Do not write YAML, CSS, HTML, file paths, or raw Markdown snippets.",
    "- Use accepted_patches for small replace patches against allowed Markdown PDF profile paths.",
    "- Use accepted_font_patches for all font writes; never put /fonts/... paths in accepted_patches.",
    "- For paths listed in patchValueDomains, use only those exact values.",
    "- Do not return profile objects or arbitrary nested fields.",
    "- Prefer small adaptations over broad rewrites.",
    "- Follow styleDecisionPolicy when deciding cover, ToC, page-number, code, and renderer-compatible changes.",
    "- Follow titleDecisionSignal before adding cover or title treatment.",
    "- If titleDecisionSignal says duplicate visible title risk exists without explicit cover intent, do not enable cover or extra title chrome.",
    "- If explicit cover intent exists but profile settings cannot suppress duplicate H1 content, include a warning instead of inventing unsupported fields.",
    "- Use conservative-fallback when facts are weak but a safe default profile can be written.",
    "- Use no-usable-profile only when no profile should be written; set selected_candidate_id to none, accepted_patches to [], and accepted_font_patches to [].",
    "- Always include fallback_reason; use an empty string when no fallback reason applies.",
    "- Keep reasoning short and grounded in the facts.",
    "",
    "Deterministic facts:",
    JSON.stringify(facts, null, 2),
  ].join("\n");
}
