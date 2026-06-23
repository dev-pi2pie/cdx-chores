import type {
  MarkdownPdfTemplateCodexFamilySpec,
  MarkdownPdfTemplateCodexTemplateFamily,
  MdPdfTemplateCodexSignalCollection,
} from "./types";

export const MARKDOWN_PDF_TEMPLATE_CODEX_FAMILIES: Record<
  MarkdownPdfTemplateCodexTemplateFamily,
  MarkdownPdfTemplateCodexFamilySpec
> = {
  "document-layered": {
    id: "document-layered",
    label: "Document layered",
    description: "A document-first template with metadata, ToC, page chrome, tables, and code.",
    requiresCoverImage: false,
    requiredHooks: ["$body$", "$if(title)$", "$if(toc)$", "$toc$", "#TOC", ".cdx-code-line"],
    defaultCoverLayout: "none",
    defaultCoverTitlePlacement: "document-title",
  },
  "cover-media-layered": {
    id: "cover-media-layered",
    label: "Cover media layered",
    description: "A cover-media template that places one managed local image on a cover page.",
    requiresCoverImage: true,
    requiredHooks: ["$body$", "$if(title)$", "$if(toc)$", "$toc$", "#TOC", ".pdf-cover-media"],
    defaultCoverLayout: "contained-media",
    defaultCoverTitlePlacement: "below-media",
  },
};

export function resolveMdPdfTemplateCodexFamily(
  signals: MdPdfTemplateCodexSignalCollection,
): MarkdownPdfTemplateCodexTemplateFamily {
  return signals.coverImage.available ? "cover-media-layered" : "document-layered";
}
