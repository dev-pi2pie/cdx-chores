import { resolveMarkdownPdfPlaceholderText } from "./placeholders";
import { createMarkdownPdfEmptyMarginBoxesCss } from "./page-chrome";
import type { MarkdownPdfOrientation, MarkdownPdfPageSize } from "../validation";
import type { NormalizedMarkdownPdfProfile } from "./types";

export const MARKDOWN_PDF_COVER_HOOK_CLASS = "pdf-cover";

export interface ResolvedMarkdownPdfCoverFields {
  title: string;
  subtitle: string;
  author: string;
  company: string;
  date: string;
}

export interface MarkdownPdfCoverVisibilityAssessment {
  fields: ResolvedMarkdownPdfCoverFields;
  hasVisibleMetadata: boolean;
  visibleFields: Array<keyof ResolvedMarkdownPdfCoverFields>;
}

export interface MarkdownPdfCoverCssInput {
  orientation?: MarkdownPdfOrientation;
  pageSize?: MarkdownPdfPageSize;
}

const COVER_PAGE_DIMENSIONS: Record<MarkdownPdfPageSize, { height: string; width: string }> = {
  A3: { width: "297mm", height: "420mm" },
  A4: { width: "210mm", height: "297mm" },
  A5: { width: "148mm", height: "210mm" },
  Letter: { width: "8.5in", height: "11in" },
  Legal: { width: "8.5in", height: "14in" },
  Tabloid: { width: "11in", height: "17in" },
};

function coverPageHeight(input: MarkdownPdfCoverCssInput): string {
  const dimensions = COVER_PAGE_DIMENSIONS[input.pageSize ?? "A4"];
  return input.orientation === "landscape" ? dimensions.width : dimensions.height;
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function coverField(value: string, profile: NormalizedMarkdownPdfProfile): string {
  return htmlEscape(resolveMarkdownPdfPlaceholderText(value, profile.metadata));
}

export function resolveMarkdownPdfCoverFields(
  profile: NormalizedMarkdownPdfProfile,
): ResolvedMarkdownPdfCoverFields {
  return {
    title: resolveMarkdownPdfPlaceholderText(profile.cover.fields.title, profile.metadata),
    subtitle: resolveMarkdownPdfPlaceholderText(profile.cover.fields.subtitle, profile.metadata),
    author: resolveMarkdownPdfPlaceholderText(profile.cover.fields.author, profile.metadata),
    company: resolveMarkdownPdfPlaceholderText(profile.cover.fields.company, profile.metadata),
    date: resolveMarkdownPdfPlaceholderText(profile.cover.fields.date, profile.metadata),
  };
}

/** Resolves configured cover fields after effective metadata precedence. */
export function assessMarkdownPdfCoverVisibility(
  profile: NormalizedMarkdownPdfProfile,
): MarkdownPdfCoverVisibilityAssessment {
  const fields = resolveMarkdownPdfCoverFields(profile);
  const visibleFields = (
    Object.entries(fields) as Array<[keyof ResolvedMarkdownPdfCoverFields, string]>
  )
    .filter(([, value]) => value.trim().length > 0)
    .map(([field]) => field);
  return {
    fields,
    hasVisibleMetadata: visibleFields.length > 0,
    visibleFields,
  };
}

export function createMarkdownPdfCoverHtml(
  profile: NormalizedMarkdownPdfProfile | undefined,
): string {
  if (!profile?.cover.enabled) {
    return "";
  }

  const title = coverField(profile.cover.fields.title, profile);
  const subtitle = coverField(profile.cover.fields.subtitle, profile);
  const author = coverField(profile.cover.fields.author, profile);
  const company = coverField(profile.cover.fields.company, profile);
  const date = coverField(profile.cover.fields.date, profile);
  const metaParts = [author, date].filter((value) => value.length > 0);

  return `<section class="${MARKDOWN_PDF_COVER_HOOK_CLASS} ${MARKDOWN_PDF_COVER_HOOK_CLASS}--${profile.cover.style}">
  <div class="${MARKDOWN_PDF_COVER_HOOK_CLASS}__content">
${company ? `    <p class="${MARKDOWN_PDF_COVER_HOOK_CLASS}__company">${company}</p>\n` : ""}    <h1 class="${MARKDOWN_PDF_COVER_HOOK_CLASS}__title">${title}</h1>
${subtitle ? `    <p class="${MARKDOWN_PDF_COVER_HOOK_CLASS}__subtitle">${subtitle}</p>\n` : ""}${metaParts.length > 0 ? `    <p class="${MARKDOWN_PDF_COVER_HOOK_CLASS}__meta">${metaParts.join(" | ")}</p>\n` : ""}  </div>
</section>
`;
}

export function createMarkdownPdfCoverCss(
  profile: NormalizedMarkdownPdfProfile | undefined,
  input: MarkdownPdfCoverCssInput = {},
): string {
  if (!profile?.cover.enabled) {
    return "";
  }
  const pageHeight = coverPageHeight(input);

  return `
@page cover {
  margin: 0;

${createMarkdownPdfEmptyMarginBoxesCss()}
}

.${MARKDOWN_PDF_COVER_HOOK_CLASS} {
  break-after: page;
  box-sizing: border-box;
  min-height: ${pageHeight};
  page: cover;
}

.${MARKDOWN_PDF_COVER_HOOK_CLASS}__content {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: ${pageHeight};
  padding: 28mm;
}

.${MARKDOWN_PDF_COVER_HOOK_CLASS}__company {
  color: #555555;
  font-size: 10pt;
  letter-spacing: 0.08em;
  margin: 0 0 18mm;
  text-transform: uppercase;
}

.${MARKDOWN_PDF_COVER_HOOK_CLASS}__title {
  font-size: 28pt;
  line-height: 1.15;
  margin: 0;
}

.${MARKDOWN_PDF_COVER_HOOK_CLASS}__subtitle {
  color: #555555;
  font-size: 14pt;
  line-height: 1.35;
  margin: 8mm 0 0;
}

.${MARKDOWN_PDF_COVER_HOOK_CLASS}__meta {
  color: #555555;
  font-size: 10pt;
  margin: 18mm 0 0;
}

.${MARKDOWN_PDF_COVER_HOOK_CLASS}--report .${MARKDOWN_PDF_COVER_HOOK_CLASS}__content {
  border-left: 8mm solid #1f5f8b;
  padding-left: 22mm;
}
`;
}
