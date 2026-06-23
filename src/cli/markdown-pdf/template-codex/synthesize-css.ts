import { createMarkdownPdfCodeCss } from "../code-style";
import type {
  MarkdownPdfTemplateCodexOutputPlan,
  MarkdownPdfTemplateCodexResolvedSlots,
  MarkdownPdfTemplateCodexTemplateFamily,
  MarkdownPdfTemplateCodexThemeTokens,
  MdPdfTemplateCodexSignalCollection,
} from "./types";

function identityComment(input: {
  family: MarkdownPdfTemplateCodexTemplateFamily;
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  signals: MdPdfTemplateCodexSignalCollection;
  slots: MarkdownPdfTemplateCodexResolvedSlots;
}): string {
  return `/* cdx-chores md pdf-template codex | bundle=${input.outputPlan.bundleId} | family=${input.family} | signal_mode=${input.signals.signalMode} | recipe_preset=${input.slots.recipePreset.preset} | recipe_source=${input.slots.recipePreset.source} */`;
}

function tocPageBreakCss(signals: MdPdfTemplateCodexSignalCollection): string {
  const options = signals.recipe.effectiveOptions;
  if (!options.toc) {
    return "";
  }
  const pageBreak =
    options.tocPageBreak === "auto"
      ? options.preset === "report"
        ? "after"
        : "none"
      : options.tocPageBreak;
  if (pageBreak === "none") {
    return "";
  }
  const before = pageBreak === "before" || pageBreak === "both" ? "break-before: page;" : "";
  const after = pageBreak === "after" || pageBreak === "both" ? "break-after: page;" : "";
  return `
#TOC {
  ${before}
  ${after}
}
`;
}

function coverCss(slots: MarkdownPdfTemplateCodexResolvedSlots): string {
  if (!slots.cover.enabled) {
    return "";
  }
  const fit = slots.cover.imageFit ?? "contain";
  const imageHeight =
    slots.cover.layout === "full-bleed-media" || fit === "cover" ? "76vh" : "68vh";
  const coverPadding = slots.cover.layout === "full-bleed-media" ? "0" : "18mm";

  return `
@page cover {
  margin: 0;
}

.pdf-cover {
  break-after: page;
  box-sizing: border-box;
  min-height: 100vh;
  page: cover;
}

.pdf-cover-media {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin: 0;
  min-height: 100vh;
  padding: ${coverPadding};
}

.pdf-cover-media__image {
  display: block;
  height: ${imageHeight};
  max-height: ${imageHeight};
  max-width: 100%;
  object-fit: ${fit};
  object-position: center;
  width: 100%;
}

.pdf-cover-media__caption {
  color: var(--template-muted);
  display: flex;
  flex-direction: column;
  gap: 2mm;
  margin-top: 8mm;
}

.pdf-cover-media__title {
  color: var(--template-text);
  font: 700 22pt/1.15 var(--template-heading-font);
}

.pdf-cover-media__subtitle {
  font: 12pt/1.35 var(--template-body-font);
}
`;
}

export function synthesizeMdPdfTemplateCodexCss(input: {
  family: MarkdownPdfTemplateCodexTemplateFamily;
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  signals: MdPdfTemplateCodexSignalCollection;
  slots: MarkdownPdfTemplateCodexResolvedSlots;
  themeTokens: MarkdownPdfTemplateCodexThemeTokens;
}): string {
  const { top, right, bottom, left } = input.signals.recipe.effectiveOptions.margins;
  const slots = input.slots;
  const theme = input.themeTokens;

  return `${identityComment(input)}
@page {
  size: ${input.signals.recipe.effectiveOptions.pageSize} ${input.signals.recipe.effectiveOptions.orientation};
  margin: ${top} ${right} ${bottom} ${left};
}

:root {
  --template-text: ${theme.text};
  --template-background: ${theme.background};
  --template-muted: ${theme.muted};
  --template-accent: ${theme.accent};
  --template-border: ${theme.border};
  --template-code-background: ${theme.codeBackground};
  --template-body-font: ${theme.bodyFont};
  --template-heading-font: ${theme.headingFont};
  --template-monospace-font: ${theme.monospaceFont};
}

body {
  background: var(--template-background);
  color: var(--template-text);
  font: ${theme.bodySize}/${theme.lineHeight} var(--template-body-font);
  margin: 0;
  overflow-wrap: anywhere;
}

.document-title {
  margin-bottom: 1.4rem;
}

.document-title .author,
.document-title .date {
  color: var(--template-muted);
  margin: 0.15rem 0;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--template-heading-font);
  line-height: 1.25;
  margin: 1.25rem 0 ${theme.blockGap};
}

p {
  margin: ${theme.blockGap} 0;
}

a {
  color: var(--template-accent);
  text-decoration: none;
}

img, svg {
  max-width: 100%;
  height: auto;
}

table {
  border-collapse: collapse;
  margin: 0.9rem 0;
  width: ${slots.tables.width === "full" ? "100%" : "auto"};
}

thead {
  display: ${slots.tables.repeatHeader ? "table-header-group" : "table-row-group"};
}

th, td {
  border: 0.6pt solid var(--template-border);
  padding: ${slots.tables.density === "compact" ? "0.18rem 0.25rem" : "0.28rem 0.35rem"};
  vertical-align: top;
}

th {
  background: #f3f5f7;
  font-weight: 700;
}

pre {
  background: var(--template-code-background);
  border: 0.6pt solid #e0e0e0;
  padding: 0.7rem;
  white-space: pre-wrap;
}

code {
  font-family: var(--template-monospace-font);
}

${createMarkdownPdfCodeCss()}

blockquote {
  border-left: 3pt solid #d0d7de;
  color: var(--template-muted);
  margin-left: 0;
  padding-left: 0.8rem;
}

#TOC {
  page: toc;
  margin: 1rem 0 1.5rem;
}

#TOC ul {
  list-style: none;
  margin: 0.25rem 0 0.25rem 1rem;
  padding: 0;
}

#TOC a {
  overflow-wrap: anywhere;
}
${tocPageBreakCss(input.signals)}
${coverCss(slots)}
`;
}
