export const MARKDOWN_PDF_RENDERER_CAPABILITY_IDS = {
  pageNumberStart: "pageNumbers.start",
  pageNumberIncrement: "pageNumbers.increment",
  pageNumberDocumentScope: "pageNumbers.scope.document",
  pageNumberBodyOrigin: "pageNumbers.countFrom.body",
  pageChromeFontSize: "pageChrome.fontSize",
  pageChromeFontWeight: "pageChrome.fontWeight",
  pageChromeLineHeight: "pageChrome.lineHeight",
  pageChromeColor: "pageChrome.color",
  pageChromeSeparatorWidth: "pageChrome.separator.width",
  pageChromeSeparatorStyle: "pageChrome.separator.style",
  pageChromeSeparatorColor: "pageChrome.separator.color",
  pageChromeSeparatorGap: "pageChrome.separator.gap",
} as const;

export type MarkdownPdfRendererCapabilityId =
  (typeof MARKDOWN_PDF_RENDERER_CAPABILITY_IDS)[keyof typeof MARKDOWN_PDF_RENDERER_CAPABILITY_IDS];

const RENDERER_CAPABILITY_ID_SET = new Set<string>(
  Object.values(MARKDOWN_PDF_RENDERER_CAPABILITY_IDS),
);

export function isMarkdownPdfRendererCapabilityId(
  value: string,
): value is MarkdownPdfRendererCapabilityId {
  return RENDERER_CAPABILITY_ID_SET.has(value);
}

export const MARKDOWN_PDF_RENDERER_CAPABILITY_FIELDS = [
  "pageNumbers.start",
  "pageNumbers.increment",
  "pageNumbers.scope",
  "pageNumbers.countFrom",
  "header.style.fontSize",
  "header.style.fontWeight",
  "header.style.lineHeight",
  "header.style.color",
  "footer.style.fontSize",
  "footer.style.fontWeight",
  "footer.style.lineHeight",
  "footer.style.color",
  "header.style.separator.width",
  "header.style.separator.style",
  "header.style.separator.color",
  "header.style.separator.gap",
  "footer.style.separator.width",
  "footer.style.separator.style",
  "footer.style.separator.color",
  "footer.style.separator.gap",
] as const;

export type MarkdownPdfRendererCapabilityField =
  (typeof MARKDOWN_PDF_RENDERER_CAPABILITY_FIELDS)[number];

const RENDERER_CAPABILITY_FIELD_SET = new Set<string>(MARKDOWN_PDF_RENDERER_CAPABILITY_FIELDS);

export function isMarkdownPdfRendererCapabilityField(
  path: string,
): path is MarkdownPdfRendererCapabilityField {
  return RENDERER_CAPABILITY_FIELD_SET.has(path);
}
