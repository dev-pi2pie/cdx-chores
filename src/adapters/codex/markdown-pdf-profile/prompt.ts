import type { MarkdownPdfCodexProfileRequest } from "./types";
import { MARKDOWN_PDF_CODEX_PATCH_VALUE_DOMAINS } from "./value-domains";
import { buildMarkdownPdfTableLayoutSignal } from "../../../cli/markdown-pdf/profile/layout-policy";
import {
  hasExplicitHideMetadataTitleIntent,
  hasExplicitKeepMetadataTitleIntent,
} from "../../../cli/markdown-pdf/profile/title-intent";

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
      "When duplicateVisibleTitleRisk is true, use titleBlock.metadataTitle to control renderer-owned metadata title output instead of inventing fields or rewriting Markdown.",
      "When explicit cover intent is true and duplicateVisibleTitleRisk is true, cover may be enabled with titleBlock.metadataTitle set to auto unless the user explicitly asks to keep duplicate title output.",
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
    "Do not remove body headings or mutate frontmatter; use titleBlock.metadataTitle for supported metadata title-block behavior.",
    "Do not invent profile fields for local cover images, arbitrary CSS, custom HTML, or template-only layout.",
    "If a requested style depends on unsupported renderer behavior, choose the closest warning-free profile and explain the mismatch in warnings.",
    "Report unsupported profile directions such as local cover images, arbitrary CSS, custom HTML, or template-only layout in unmatched_directions.",
  ],
};

const MARKDOWN_PDF_CODEX_FONT_PATCH_CONTRACT = {
  field: "accepted_font_patches",
  roleKeyMatrix: [
    {
      role: "body",
      allowedKeys: ["default", "language tags such as ja or zh-Hant"],
      useFor: "body text, including language-specific body font fallback",
    },
    {
      role: "code",
      allowedKeys: ["default", "symbols"],
      useFor: "code text and code-symbol fallback",
    },
    {
      role: "heading",
      allowedKeys: ["default"],
      useFor: "one reusable heading font only; language-specific heading keys are unsupported",
    },
    {
      role: "pageChrome",
      allowedKeys: ["default"],
      useFor: "one reusable header, footer, and page-number font only",
    },
  ],
  rules: [
    "Use accepted_font_patches for all profile font writes.",
    "Do not use accepted_patches for /fonts/... paths.",
    "Use only the role/key combinations listed in roleKeyMatrix.",
    "Never use language-tag keys with heading or pageChrome; use heading.default or pageChrome.default only when a single reusable family is appropriate.",
    "Map language-specific CJK body font requests to body language keys such as ja or zh-Hant, not to heading or pageChrome.",
    "Map readable code symbol requests to code.symbols.",
    "Use --font-hint evidence only as a font preference signal; do not invent additional dedicated hint fields.",
    "If a font request cannot be represented by body, heading, code, or pageChrome font maps, report it in warnings or unmatched_directions.",
  ],
  examples: [
    { op: "replace-font", role: "body", key: "default", value: "Source Serif 4" },
    { op: "replace-font", role: "body", key: "ja", value: "Noto Serif JP" },
    { op: "replace-font", role: "body", key: "zh-Hant", value: "Noto Serif TC" },
    { op: "replace-font", role: "code", key: "default", value: "JetBrains Mono" },
    { op: "replace-font", role: "code", key: "symbols", value: "Noto Sans Symbols 2" },
  ],
};

const MARKDOWN_PDF_CODEX_TITLE_BLOCK_CONTRACT = {
  field: "titleBlock.metadataTitle",
  allowedValues: ["auto", "show", "hide"],
  rules: [
    "Use accepted_patches path /titleBlock/metadataTitle to control renderer-owned metadata title output.",
    "Use auto when duplicateVisibleTitleRisk is true and the user did not explicitly ask to preserve duplicate title output.",
    "Use show only when the user explicitly asks to keep the metadata title block, title page output, or duplicate title output.",
    "Use hide only when the user explicitly asks to suppress metadata title output regardless of first-H1 duplication.",
    "Do not rewrite Markdown H1 content or mutate frontmatter title.",
  ],
};

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
  const explicitKeepMetadataTitleIntent = hasExplicitKeepMetadataTitleIntent(intent);
  const explicitHideMetadataTitleIntent = hasExplicitHideMetadataTitleIntent(intent);
  const duplicateVisibleTitleRisk = request.documentSignals.title.duplicateVisibleTitleRisk;

  return {
    ...request.documentSignals.title,
    explicitCoverIntent,
    explicitHideMetadataTitleIntent,
    explicitKeepMetadataTitleIntent,
    explicitNoCoverIntent,
    supportedPatch: "/titleBlock/metadataTitle",
    recommendation: explicitNoCoverIntent
      ? "Keep cover disabled and avoid extra title chrome."
      : explicitHideMetadataTitleIntent
        ? "Set titleBlock.metadataTitle to hide; do not rewrite Markdown or frontmatter."
        : explicitKeepMetadataTitleIntent
          ? "Set titleBlock.metadataTitle to show when preserving metadata title output is the user's explicit request."
          : explicitCoverIntent
            ? duplicateVisibleTitleRisk
              ? "Cover may be enabled because the user asked for it; use titleBlock.metadataTitle auto unless duplicate metadata title output is explicitly requested."
              : "Cover may be enabled when supported profile fields fit the request."
            : duplicateVisibleTitleRisk
              ? "Set titleBlock.metadataTitle to auto so the renderer suppresses duplicate metadata title output while preserving the Markdown H1."
              : "Use conservative title treatment unless other document signals justify cover.",
    profileBoundary: [
      "Do not rewrite Markdown.",
      "Do not mutate frontmatter.",
      "Use titleBlock.metadataTitle for supported metadata title-block behavior.",
      "Report unsupported title media, custom cover layout, or template-only behavior in warnings or unmatched_directions.",
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
    tableLayoutSignal: buildMarkdownPdfTableLayoutSignal(request.documentSignals.tables),
    titleBlockContract: MARKDOWN_PDF_CODEX_TITLE_BLOCK_CONTRACT,
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
    "- If titleDecisionSignal says duplicate visible title risk exists, prefer accepted_patches path /titleBlock/metadataTitle with value auto unless the user explicitly asks to keep duplicate title output.",
    "- If explicit cover intent exists, cover may be enabled, but still use titleBlock.metadataTitle for metadata-title duplication instead of warning that no profile field exists.",
    "- Use conservative-fallback when facts are weak but a safe default profile can be written.",
    "- Use no-usable-profile only when no profile should be written; set selected_candidate_id to none, accepted_patches to [], and accepted_font_patches to [].",
    "- Always include fallback_reason; use an empty string when no fallback reason applies.",
    "- Keep reasoning short and grounded in the facts.",
    "",
    "Deterministic facts:",
    JSON.stringify(facts, null, 2),
  ].join("\n");
}
