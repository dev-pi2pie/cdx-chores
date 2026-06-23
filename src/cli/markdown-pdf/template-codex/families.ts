import type {
  MarkdownPdfTemplateCodexFamilySpec,
  MarkdownPdfTemplateCodexTemplateFamily,
  MdPdfTemplateCodexSignalCollection,
} from "./types";

export const MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT = {
  html: {
    bodyPlaceholder: "$body$",
    coverMediaClass: "pdf-cover-media",
    titleConditional: "$if(title)$",
    tocConditional: "$if(toc)$",
    tocId: "TOC",
    tocPlaceholder: "$toc$",
  },
  css: {
    codeLineSelector: ".cdx-code-line",
    coverMediaSelector: ".pdf-cover-media",
    tocSelector: "#TOC",
  },
} as const;

const REQUIRED_DOCUMENT_TEMPLATE_HOOKS = [
  MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.html.bodyPlaceholder,
  MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.html.titleConditional,
  MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.html.tocConditional,
  MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.html.tocPlaceholder,
  `id="${MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.html.tocId}"`,
];

const REQUIRED_DOCUMENT_CSS_HOOKS = [
  MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.css.tocSelector,
  MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.css.codeLineSelector,
];

export const MARKDOWN_PDF_TEMPLATE_CODEX_FAMILIES: Record<
  MarkdownPdfTemplateCodexTemplateFamily,
  MarkdownPdfTemplateCodexFamilySpec
> = {
  "document-layered": {
    id: "document-layered",
    label: "Document layered",
    description: "A document-first template with metadata, ToC, page chrome, tables, and code.",
    requiresCoverImage: false,
    requiredTemplateHooks: REQUIRED_DOCUMENT_TEMPLATE_HOOKS,
    requiredCssHooks: REQUIRED_DOCUMENT_CSS_HOOKS,
    defaultCoverLayout: "none",
    defaultCoverTitlePlacement: "document-title",
  },
  "cover-media-layered": {
    id: "cover-media-layered",
    label: "Cover media layered",
    description: "A cover-media template that places one managed local image on a cover page.",
    requiresCoverImage: true,
    requiredTemplateHooks: [
      ...REQUIRED_DOCUMENT_TEMPLATE_HOOKS,
      `class="${MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.html.coverMediaClass}"`,
    ],
    requiredCssHooks: [
      ...REQUIRED_DOCUMENT_CSS_HOOKS,
      MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.css.coverMediaSelector,
    ],
    defaultCoverLayout: "contained-media",
    defaultCoverTitlePlacement: "below-media",
  },
};

export function resolveMdPdfTemplateCodexFamily(
  signals: MdPdfTemplateCodexSignalCollection,
): MarkdownPdfTemplateCodexTemplateFamily {
  return signals.coverImage.available ? "cover-media-layered" : "document-layered";
}
