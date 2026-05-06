import type { NormalizedMarkdownPdfOptions } from "./validation";

export interface MarkdownPdfRecipe {
  templateHtml: string;
  styleCss: string;
}

const PRESET_CSS: Record<NormalizedMarkdownPdfOptions["preset"], string> = {
  article: `
body {
  font: 11pt/1.55 "Noto Serif", "Georgia", serif;
}
`,
  report: `
body {
  font: 10.5pt/1.5 "Noto Serif", "Georgia", serif;
}
h1, h2, h3 {
  page-break-after: avoid;
}
`,
  "wide-table": `
body {
  font: 9.5pt/1.45 "Noto Sans", "Arial", sans-serif;
}
table, pre, code {
  font-size: 8.5pt;
}
`,
  compact: `
body {
  font: 9.5pt/1.4 "Noto Sans", "Arial", sans-serif;
}
p, ul, ol, table, pre {
  margin-top: 0.35rem;
  margin-bottom: 0.35rem;
}
`,
  reader: `
body {
  font: 12pt/1.65 "Noto Serif", "Georgia", serif;
}
`,
};

export function createMarkdownPdfTemplate(): string {
  return `<!doctype html>
<html lang="$if(lang)$$lang$$else$en$endif$">
<head>
  <meta charset="utf-8">
  <meta name="generator" content="cdx-chores md to-pdf">
  <title>$if(title)$$title$$else$Markdown PDF$endif$</title>
</head>
<body>
$if(title)$
<header class="document-title">
  <h1 class="title">$title$</h1>
$if(author)$
  <p class="author">$for(author)$$author$$sep$, $endfor$</p>
$endif$
$if(date)$
  <p class="date">$date$</p>
$endif$
</header>
$endif$
$if(toc)$
<nav id="TOC" role="doc-toc">
$toc$
</nav>
$endif$
<main>
$body$
</main>
</body>
</html>
`;
}

function tocPageBreakCss(options: NormalizedMarkdownPdfOptions): string {
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

export function createMarkdownPdfCss(options: NormalizedMarkdownPdfOptions): string {
  const { top, right, bottom, left } = options.margins;

  return `@page {
  size: ${options.pageSize} ${options.orientation};
  margin: ${top} ${right} ${bottom} ${left};
}

:root {
  color: #171717;
  background: #ffffff;
}

body {
  margin: 0;
  overflow-wrap: anywhere;
}

.document-title {
  margin-bottom: 1.4rem;
}

.document-title .author,
.document-title .date {
  color: #555555;
  margin: 0.15rem 0;
}

h1, h2, h3, h4, h5, h6 {
  font-family: "Noto Sans", "Arial", sans-serif;
  line-height: 1.25;
  margin: 1.25rem 0 0.55rem;
}

p {
  margin: 0.55rem 0;
}

a {
  color: #1f5f8b;
  text-decoration: none;
}

img, svg {
  max-width: 100%;
  height: auto;
}

table {
  border-collapse: collapse;
  margin: 0.9rem 0;
  width: 100%;
}

thead {
  display: table-header-group;
}

th, td {
  border: 0.6pt solid #d8d8d8;
  padding: 0.28rem 0.35rem;
  vertical-align: top;
}

th {
  background: #f3f5f7;
  font-weight: 700;
}

pre {
  background: #f5f5f5;
  border: 0.6pt solid #e0e0e0;
  padding: 0.7rem;
  white-space: pre-wrap;
}

code {
  font-family: "Noto Sans Mono", "SFMono-Regular", "Consolas", monospace;
}

blockquote {
  border-left: 3pt solid #d0d7de;
  color: #555555;
  margin-left: 0;
  padding-left: 0.8rem;
}

#TOC {
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
${tocPageBreakCss(options)}
${PRESET_CSS[options.preset]}
`;
}

export function createMarkdownPdfRecipe(options: NormalizedMarkdownPdfOptions): MarkdownPdfRecipe {
  return {
    templateHtml: createMarkdownPdfTemplate(),
    styleCss: createMarkdownPdfCss(options),
  };
}
