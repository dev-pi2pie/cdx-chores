import type {
  MarkdownPdfTemplateCodexFamilySpec,
  MarkdownPdfTemplateCodexRequiredHook,
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

function requiredHook(id: string, marker: string): MarkdownPdfTemplateCodexRequiredHook {
  return { id, marker };
}

const REQUIRED_DOCUMENT_TEMPLATE_HOOKS = [
  requiredHook("body-placeholder", MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.html.bodyPlaceholder),
  requiredHook("title-conditional", MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.html.titleConditional),
  requiredHook("toc-conditional", MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.html.tocConditional),
  requiredHook("toc-placeholder", MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.html.tocPlaceholder),
  requiredHook("toc-nav", `id="${MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.html.tocId}"`),
];

const REQUIRED_DOCUMENT_CSS_HOOKS = [
  requiredHook("toc-selector", MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.css.tocSelector),
  requiredHook("code-line-selector", MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.css.codeLineSelector),
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
      requiredHook(
        "cover-media-class",
        `class="${MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.html.coverMediaClass}"`,
      ),
    ],
    requiredCssHooks: [
      ...REQUIRED_DOCUMENT_CSS_HOOKS,
      requiredHook(
        "cover-media-selector",
        MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.css.coverMediaSelector,
      ),
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

export function assertMarkdownPdfTemplateCodexFamilyHooksPresent(input: {
  family: MarkdownPdfTemplateCodexFamilySpec;
  styleCss: string;
  templateHtml: string;
}): void {
  const missingTemplateHooks = input.family.requiredTemplateHooks.filter(
    (hook) => !input.templateHtml.includes(hook.marker),
  );
  const missingCssHooks = input.family.requiredCssHooks.filter(
    (hook) => !input.styleCss.includes(hook.marker),
  );
  const missingHooks = [
    ...missingTemplateHooks.map((hook) => `template:${hook.id}`),
    ...missingCssHooks.map((hook) => `css:${hook.id}`),
  ];
  if (missingHooks.length > 0) {
    throw new Error(
      `Generated ${input.family.id} template is missing required hooks: ${missingHooks.join(", ")}`,
    );
  }
}
