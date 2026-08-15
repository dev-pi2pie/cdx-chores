import type { ProductRendererScenario } from "./types";
import { PORTRAIT_SIZE } from "./shared-content";

const productDocumentOriginMarkdown = `---
title: PRODUCTACOVER
author: Renderer evidence
---

# PRODUCT-A-BODY-1

Product document-origin body page one.

<div style="break-after: page"></div>

# PRODUCT-A-BODY-2

Product document-origin body page two.

<div style="break-after: page"></div>

# PRODUCT-A-BODY-3

Product document-origin body page three.
`;

const productDocumentOriginProfile = `page:
  size: A5
  orientation: portrait
  margin: 18mm

toc:
  enabled: true
  depth: 1
  pageBreak: after

cover:
  enabled: true
  style: plain

titleBlock:
  metadataTitle: auto

header:
  left: "PRODUCT-A-HEADER"

footer:
  center: "PRODUCT-A-REPLACED-SLOT"

pageNumbers:
  enabled: true
  position: bottom-center
  format: "PRODUCT-A-L{page}/{pages}-P{pdfPage}/{pdfPages}"
  scope: body
  countFrom: document
  start: 0
  increment: 2
`;

const productBodyOriginMarkdown = `# PRODUCT-B-BODY-1

Product body-origin page one.

<div style="break-after: page"></div>

# PRODUCT-B-BODY-2

Product body-origin page two.

<div style="break-after: page"></div>

# PRODUCT-B-BODY-3

Product body-origin page three.
`;

const productBodyOriginProfile = `page:
  size: A5
  orientation: portrait
  margin: 18mm

toc:
  enabled: true
  depth: 1
  pageBreak: none

fonts:
  pageChrome:
    default: "DejaVu Sans"

titleBlock:
  metadataTitle: hide

header:
  left: "PRODUCT-B-HEADER"
  right: "PRODUCT-B-REPLACED-SLOT"
  style:
    fontSize: 9pt
    fontWeight: 700
    lineHeight: 1.5
    color: "#2457a6"
    separator:
      width: 1pt
      style: solid
      color: "#2457a6"
      gap: 2mm

pageNumbers:
  enabled: true
  position: top-right
  format: "PRODUCT-B-L{page}/{pages}-P{pdfPage}/{pdfPages}"
  scope: body
  countFrom: body
  start: 5
  increment: 2
`;

const productBodyOriginTemplate = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Product body-origin renderer evidence</title>
  </head>
  <body>
$if(toc)$
    <nav id="TOC" role="doc-toc">
      <p>PRODUCT-B-PREBODY</p>
$toc$
    </nav>
$endif$
    <main class="document-body">
$body$
    </main>
  </body>
</html>
`;

const productStylesheetPrecedenceMarkdown = `# PRODUCT-C-BODY-1

Product stylesheet-precedence page one.

# PRODUCT-C-BODY-2 {.product-c-right-page}

Product stylesheet-precedence page two.
`;

const productStylesheetPrecedenceProfile = `page:
  size: A5
  orientation: portrait
  margin: 18mm

fonts:
  pageChrome:
    default: "DejaVu Sans"

titleBlock:
  metadataTitle: hide

footer:
  right: "PRODUCT-C-REPLACED-SLOT"
  style:
    fontSize: 7pt
    fontWeight: 400
    lineHeight: 1.1
    color: "#aa2200"
    separator:
      width: 0.5pt
      style: solid
      color: "#aa2200"
      gap: 1mm

pageNumbers:
  enabled: true
  position: bottom-right
  format: "PRODUCT-C-P{pdfPage}/{pdfPages}"
  scope: document
  countFrom: document
  start: 1
  increment: 1
`;

const productStylesheetPrecedenceCss = `@page body {
  @bottom-right {
    font-size: 15pt;
    font-weight: 700;
    line-height: 1.8;
    color: #0055aa;
    border-top-color: #0055aa;
  }
}

.product-c-right-page {
  break-before: right;
}
`;

const productAutomaticMetadataTitleMarkdown = `---
title: PRODUCT-D-METADATA-TITLE
author: Renderer evidence
---

# PRODUCT-D-BODY-1

The automatic metadata title remains inside the body after the table of contents.
`;

const productAutomaticMetadataTitleProfile = `page:
  size: A5
  orientation: portrait
  margin: 18mm

toc:
  enabled: true
  depth: 1
  pageBreak: after

titleBlock:
  metadataTitle: auto

header:
  left: "PRODUCT-D-HEADER"

footer:
  left: "PRODUCT-D-FOOTER"

pageNumbers:
  enabled: true
  position: bottom-center
  format: "PRODUCT-D-L{page}/{pages}-P{pdfPage}/{pdfPages}"
  scope: document
  countFrom: document
  start: 1
  increment: 1
`;

export const PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS: readonly ProductRendererScenario[] = [
  {
    id: "product-built-in-document-origin",
    purpose:
      "Automate the built-in Profile path through automatic-title suppression, unreserved repeating content, selected-slot replacement, body-only visibility, document-origin arithmetic, and bottom-center placement across cover, ToC, and body roles.",
    required: true,
    markdown: productDocumentOriginMarkdown,
    profile: productDocumentOriginProfile,
    expected: {
      pageCount: 5,
      sizeMillimeters: PORTRAIT_SIZE,
      orientation: "portrait",
      pages: [
        {
          role: "cover",
          marker: "PRODUCTACOVER",
          pageNumberLabels: [],
          forbiddenText: ["PRODUCT-A-HEADER", "PRODUCT-A-REPLACED-SLOT"],
        },
        {
          role: "table-of-contents",
          marker: "PRODUCT-A-BODY-1",
          pageNumberLabels: [],
          requiredText: ["PRODUCT-A-HEADER"],
          forbiddenText: ["PRODUCTACOVER", "PRODUCT-A-REPLACED-SLOT"],
        },
        {
          role: "document-body",
          marker: "PRODUCT-A-BODY-1",
          pageNumberLabels: ["PRODUCT-A-L4/8-P3/5"],
          pageNumberRegion: "bottom-center",
          requiredText: ["PRODUCT-A-HEADER"],
          forbiddenText: ["PRODUCT-A-REPLACED-SLOT"],
        },
        {
          role: "document-body",
          marker: "PRODUCT-A-BODY-2",
          pageNumberLabels: ["PRODUCT-A-L6/8-P4/5"],
          pageNumberRegion: "bottom-center",
          requiredText: ["PRODUCT-A-HEADER"],
          forbiddenText: ["PRODUCT-A-REPLACED-SLOT"],
        },
        {
          role: "document-body",
          marker: "PRODUCT-A-BODY-3",
          pageNumberLabels: ["PRODUCT-A-L8/8-P5/5"],
          pageNumberRegion: "bottom-center",
          requiredText: ["PRODUCT-A-HEADER"],
          forbiddenText: ["PRODUCT-A-REPLACED-SLOT"],
        },
      ],
      pngPages: [1, 2, 5],
    },
    visualReviewRequired: [],
  },
  {
    id: "product-explicit-body-origin",
    purpose:
      "Automate a selected Template body boundary with a named ToC transition despite pageBreak none, unreserved repeating content, body-only visibility, top-right placement, and body-origin arithmetic; visual review covers the configured presentation.",
    required: true,
    markdown: productBodyOriginMarkdown,
    profile: productBodyOriginProfile,
    template: productBodyOriginTemplate,
    expected: {
      pageCount: 4,
      sizeMillimeters: PORTRAIT_SIZE,
      orientation: "portrait",
      pages: [
        {
          role: "table-of-contents",
          marker: "PRODUCT-B-PREBODY",
          pageNumberLabels: [],
          requiredText: ["PRODUCT-B-HEADER"],
          forbiddenText: ["PRODUCT-B-REPLACED-SLOT"],
        },
        {
          role: "document-body",
          marker: "PRODUCT-B-BODY-1",
          pageNumberLabels: ["PRODUCT-B-L5/9-P2/4"],
          pageNumberRegion: "top-right",
          requiredText: ["PRODUCT-B-HEADER"],
          forbiddenText: ["PRODUCT-B-REPLACED-SLOT"],
        },
        {
          role: "document-body",
          marker: "PRODUCT-B-BODY-2",
          pageNumberLabels: ["PRODUCT-B-L7/9-P3/4"],
          pageNumberRegion: "top-right",
          requiredText: ["PRODUCT-B-HEADER"],
          forbiddenText: ["PRODUCT-B-REPLACED-SLOT"],
        },
        {
          role: "document-body",
          marker: "PRODUCT-B-BODY-3",
          pageNumberLabels: ["PRODUCT-B-L9/9-P4/4"],
          pageNumberRegion: "top-right",
          requiredText: ["PRODUCT-B-HEADER"],
          forbiddenText: ["PRODUCT-B-REPLACED-SLOT"],
        },
      ],
      pngPages: [1, 2, 4],
    },
    visualReviewRequired: ["font-family", "typography", "color", "separator"],
  },
  {
    id: "product-custom-stylesheet-precedence",
    purpose:
      "Automate later-stylesheet launch, an inserted blank page, physical-only Profile-owned content without a logical-final target, and bottom-right placement; visual review covers font ownership and the presentation cascade.",
    required: true,
    markdown: productStylesheetPrecedenceMarkdown,
    profile: productStylesheetPrecedenceProfile,
    css: productStylesheetPrecedenceCss,
    expected: {
      pageCount: 3,
      sizeMillimeters: PORTRAIT_SIZE,
      orientation: "portrait",
      pages: [
        {
          role: "document-body",
          marker: "PRODUCT-C-BODY-1",
          pageNumberLabels: ["PRODUCT-C-P1/3"],
          pageNumberRegion: "bottom-right",
          forbiddenText: ["PRODUCT-C-REPLACED-SLOT"],
        },
        {
          role: "inserted-blank",
          marker: "",
          pageNumberLabels: ["PRODUCT-C-P2/3"],
          pageNumberRegion: "bottom-right",
          forbiddenText: ["PRODUCT-C-REPLACED-SLOT"],
        },
        {
          role: "document-body",
          marker: "PRODUCT-C-BODY-2",
          pageNumberLabels: ["PRODUCT-C-P3/3"],
          pageNumberRegion: "bottom-right",
          forbiddenText: ["PRODUCT-C-REPLACED-SLOT"],
        },
      ],
      pngPages: [1, 2, 3],
    },
    visualReviewRequired: ["font-family", "typography", "color", "separator", "stylesheet-cascade"],
  },
  {
    id: "product-built-in-automatic-metadata-title",
    purpose:
      "Prove the built-in no-cover path keeps the automatic metadata title inside the body after the ToC while repeating configured header, footer, and four-token numbering on both page roles.",
    required: true,
    markdown: productAutomaticMetadataTitleMarkdown,
    profile: productAutomaticMetadataTitleProfile,
    expected: {
      pageCount: 2,
      sizeMillimeters: PORTRAIT_SIZE,
      orientation: "portrait",
      pages: [
        {
          role: "table-of-contents",
          marker: "PRODUCT-D-BODY-1",
          pageNumberLabels: ["PRODUCT-D-L1/2-P1/2"],
          pageNumberRegion: "bottom-center",
          requiredText: ["PRODUCT-D-HEADER", "PRODUCT-D-FOOTER"],
          forbiddenText: ["PRODUCT-D-METADATA-TITLE"],
        },
        {
          role: "document-body",
          marker: "PRODUCT-D-BODY-1",
          pageNumberLabels: ["PRODUCT-D-L2/2-P2/2"],
          pageNumberRegion: "bottom-center",
          requiredText: ["PRODUCT-D-METADATA-TITLE", "PRODUCT-D-HEADER", "PRODUCT-D-FOOTER"],
        },
      ],
      pngPages: [1, 2],
    },
    visualReviewRequired: ["typography"],
  },
];
