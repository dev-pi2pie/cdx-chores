import { resolveMarkdownPdfPlaceholderText } from "./placeholders";
import { createMarkdownPdfEmptyMarginBoxesCss } from "./page-chrome";
import type { NormalizedMarkdownPdfProfile } from "./types";

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
  const metaParts = [author, company, date].filter((value) => value.length > 0);

  return `<section class="pdf-cover pdf-cover--${profile.cover.style}">
  <div class="pdf-cover__content">
${company ? `    <p class="pdf-cover__company">${company}</p>\n` : ""}    <h1 class="pdf-cover__title">${title}</h1>
${subtitle ? `    <p class="pdf-cover__subtitle">${subtitle}</p>\n` : ""}${metaParts.length > 0 ? `    <p class="pdf-cover__meta">${metaParts.join(" | ")}</p>\n` : ""}  </div>
</section>
`;
}

export function createMarkdownPdfCoverCss(
  profile: NormalizedMarkdownPdfProfile | undefined,
): string {
  if (!profile?.cover.enabled) {
    return "";
  }

  return `
@page cover {
  margin: 0;

${createMarkdownPdfEmptyMarginBoxesCss()}
}

.pdf-cover {
  break-after: page;
  box-sizing: border-box;
  min-height: 100vh;
  page: cover;
}

.pdf-cover__content {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 100vh;
  padding: 28mm;
}

.pdf-cover__company {
  color: #555555;
  font-size: 10pt;
  letter-spacing: 0.08em;
  margin: 0 0 18mm;
  text-transform: uppercase;
}

.pdf-cover__title {
  font-size: 28pt;
  line-height: 1.15;
  margin: 0;
}

.pdf-cover__subtitle {
  color: #555555;
  font-size: 14pt;
  line-height: 1.35;
  margin: 8mm 0 0;
}

.pdf-cover__meta {
  color: #555555;
  font-size: 10pt;
  margin: 18mm 0 0;
}

.pdf-cover--report .pdf-cover__content {
  border-left: 8mm solid #1f5f8b;
  padding-left: 22mm;
}
`;
}
