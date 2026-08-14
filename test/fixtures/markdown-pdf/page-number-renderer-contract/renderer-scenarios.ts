import type { RendererContractScenario } from "./types";
import { baseCss, fixtureHtml, LANDSCAPE_SIZE, PORTRAIT_SIZE } from "./shared-content";

export const PAGE_NUMBER_RENDERER_SCENARIOS: readonly RendererContractScenario[] = [
  {
    id: "document-origin-visibility",
    purpose:
      "Prove hidden-but-counted covers plus document-scope front matter, ToC, and body labels.",
    required: true,
    capabilities: ["document-visibility"],
    html: fixtureHtml([
      { marker: "PAGE-COVER-1", pageName: "cover" },
      { marker: "PAGE-COVER-2", pageName: "cover" },
      { marker: "PAGE-FRONT-1", pageName: "front" },
      { marker: "PAGE-TOC-1", pageName: "toc" },
      { marker: "PAGE-TOC-2", pageName: "toc" },
      { marker: "PAGE-BODY-1", pageName: "body-page" },
      { marker: "PAGE-BODY-2", pageName: "body-page" },
    ]),
    css: `${baseCss}
@page {
  size: 148mm 210mm;
  margin: 15mm;
  @bottom-center { content: "PN-DOC-" counter(page) "/" counter(pages); }
}
@page cover { @bottom-center { content: none; } }
.cover { page: cover; }
.front { page: front; }
.toc { page: toc; }
.body-page { page: body; }
`,
    expected: {
      pageCount: 7,
      sizeMillimeters: PORTRAIT_SIZE,
      orientation: "portrait",
      pages: [
        { marker: "PAGE-COVER-1", pageNumberLabels: [] },
        { marker: "PAGE-COVER-2", pageNumberLabels: [] },
        { marker: "PAGE-FRONT-1", pageNumberLabels: ["PN-DOC-3/7"] },
        { marker: "PAGE-TOC-1", pageNumberLabels: ["PN-DOC-4/7"] },
        { marker: "PAGE-TOC-2", pageNumberLabels: ["PN-DOC-5/7"] },
        { marker: "PAGE-BODY-1", pageNumberLabels: ["PN-DOC-6/7"] },
        { marker: "PAGE-BODY-2", pageNumberLabels: ["PN-DOC-7/7"] },
      ],
      pngPages: [1, 3, 5, 6, 7],
    },
  },
  {
    id: "document-origin-start-zero-increment-two",
    purpose: "Prove the first-physical-page reset boundary, start zero, and increment two.",
    required: true,
    capabilities: ["reset", "increment"],
    html: fixtureHtml([
      { marker: "PAGE-DOC-RESET-1", pageName: "ordinary" },
      { marker: "PAGE-DOC-RESET-2", pageName: "ordinary" },
      { marker: "PAGE-DOC-RESET-3", pageName: "ordinary" },
    ]),
    css: `${baseCss}
@page {
  size: 148mm 210mm;
  margin: 15mm;
  counter-increment: page 2;
  @bottom-center { content: "PN-DOC-RESET-" counter(page) "/" counter(pages); }
}
@page:nth(1) { counter-reset: page -2; }
`,
    expected: {
      pageCount: 3,
      sizeMillimeters: PORTRAIT_SIZE,
      orientation: "portrait",
      pages: [
        { marker: "PAGE-DOC-RESET-1", pageNumberLabels: ["PN-DOC-RESET-0/3"] },
        { marker: "PAGE-DOC-RESET-2", pageNumberLabels: ["PN-DOC-RESET-2/3"] },
        { marker: "PAGE-DOC-RESET-3", pageNumberLabels: ["PN-DOC-RESET-4/3"] },
      ],
      pngPages: [1, 2, 3],
    },
  },
  {
    id: "separator-area-span",
    purpose:
      "Compare omitted separators, occupied-box separators, and styled empty side boxes in headers and footers.",
    required: true,
    capabilities: ["separator"],
    html: fixtureHtml([
      { marker: "PAGE-SEP-OMITTED", pageName: "separator-omitted" },
      { marker: "PAGE-SEP-PARTIAL", pageName: "separator-partial" },
      { marker: "PAGE-SEP-EMPTY", pageName: "separator-empty" },
    ]),
    css: `${baseCss}
@page {
  size: 148mm 210mm;
  margin: 15mm;
}
@page separator-omitted {
  @top-center { content: "SEP-HEADER-OMITTED"; }
  @bottom-center { content: "SEP-FOOTER-OMITTED"; }
}
@page separator-partial {
  @top-center { content: "SEP-HEADER-PARTIAL"; border-bottom: 1pt solid #2457a6; padding-bottom: 2mm; }
  @bottom-center { content: "SEP-FOOTER-PARTIAL"; border-top: 1pt solid #2457a6; padding-top: 2mm; }
}
@page separator-empty {
  @top-left { content: ""; border-bottom: 1pt solid #2457a6; padding-bottom: 2mm; }
  @top-center { content: "SEP-HEADER-EMPTY"; border-bottom: 1pt solid #2457a6; padding-bottom: 2mm; }
  @top-right { content: ""; border-bottom: 1pt solid #2457a6; padding-bottom: 2mm; }
  @bottom-left { content: ""; border-top: 1pt solid #2457a6; padding-top: 2mm; }
  @bottom-center { content: "SEP-FOOTER-EMPTY"; border-top: 1pt solid #2457a6; padding-top: 2mm; }
  @bottom-right { content: ""; border-top: 1pt solid #2457a6; padding-top: 2mm; }
}
.separator-omitted { page: separator-omitted; }
.separator-partial { page: separator-partial; }
.separator-empty { page: separator-empty; }
`,
    expected: {
      pageCount: 3,
      sizeMillimeters: PORTRAIT_SIZE,
      orientation: "portrait",
      pages: [
        {
          marker: "PAGE-SEP-OMITTED",
          pageNumberLabels: ["SEP-HEADER-OMITTED", "SEP-FOOTER-OMITTED"],
        },
        {
          marker: "PAGE-SEP-PARTIAL",
          pageNumberLabels: ["SEP-HEADER-PARTIAL", "SEP-FOOTER-PARTIAL"],
        },
        {
          marker: "PAGE-SEP-EMPTY",
          pageNumberLabels: ["SEP-HEADER-EMPTY", "SEP-FOOTER-EMPTY"],
        },
      ],
      pngPages: [1, 2, 3],
    },
  },
  {
    id: "body-origin-start-zero-increment-two",
    purpose:
      "Prove the first-body reset boundary, start zero, increment two, and body-only visibility.",
    required: true,
    capabilities: ["body-origin", "reset", "increment"],
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <link rel="stylesheet" href="style.css">
  </head>
  <body>
    <section class="fixture-page cover"><p class="page-marker">PAGE-COVER-1</p></section>
    <section class="fixture-page toc"><p class="page-marker">PAGE-TOC-1</p></section>
    <main class="document-body">
      <section class="fixture-page"><p class="page-marker">PAGE-BODY-1</p></section>
      <section class="fixture-page"><p class="page-marker">PAGE-BODY-2</p></section>
      <section class="fixture-page"><p class="page-marker">PAGE-BODY-3</p></section>
    </main>
  </body>
</html>
`,
    css: `${baseCss}
@page {
  size: 148mm 210mm;
  margin: 15mm;
}
@page cover { @bottom-center { content: none; } }
@page toc { @bottom-center { content: none; } }
@page body {
  counter-increment: page 2;
  @bottom-center { content: "PN-BODY-" counter(page) "/" counter(pages); }
}
@page body:nth(1 of body) { counter-reset: page -2; }
.cover { page: cover; }
.toc { page: toc; }
.document-body { page: body; }
`,
    expected: {
      pageCount: 5,
      sizeMillimeters: PORTRAIT_SIZE,
      orientation: "portrait",
      pages: [
        { marker: "PAGE-COVER-1", pageNumberLabels: [] },
        { marker: "PAGE-TOC-1", pageNumberLabels: [] },
        { marker: "PAGE-BODY-1", pageNumberLabels: ["PN-BODY-0/5"] },
        { marker: "PAGE-BODY-2", pageNumberLabels: ["PN-BODY-2/5"] },
        { marker: "PAGE-BODY-3", pageNumberLabels: ["PN-BODY-4/5"] },
      ],
      pngPages: [2, 3, 4, 5],
    },
  },
  {
    id: "six-positions-landscape-style",
    purpose:
      "Prove all margin-box positions, landscape dimensions, narrow margins, typography, and separators.",
    required: true,
    capabilities: ["positions", "landscape", "narrow-margins", "typography", "separator"],
    html: fixtureHtml([
      { marker: "PAGE-POS-TOP-LEFT", pageName: "position-top-left" },
      { marker: "PAGE-POS-TOP-CENTER", pageName: "position-top-center" },
      { marker: "PAGE-POS-TOP-RIGHT", pageName: "position-top-right" },
      { marker: "PAGE-POS-BOTTOM-LEFT", pageName: "position-bottom-left" },
      { marker: "PAGE-POS-BOTTOM-CENTER", pageName: "position-bottom-center" },
      { marker: "PAGE-POS-BOTTOM-RIGHT", pageName: "position-bottom-right" },
    ]),
    css: `${baseCss}
@page {
  size: 210mm 148mm;
  margin: 9mm;
}
@page position-top-left {
  @top-left { content: "PN-POS-TL-1"; font: 400 6pt/1 sans-serif; color: #2457a6; border-bottom: 0.25pt solid #2457a6; padding-bottom: 0; }
}
@page position-top-center {
  @top-center { content: "PN-POS-TC-2"; font: 500 8.5pt/1.2 sans-serif; color: #667085; border-bottom: 0.5pt solid #d0d5dd; padding-bottom: 2mm; }
}
@page position-top-right {
  @top-right { content: "PN-POS-TR-3"; font: 600 10pt/1.5 sans-serif; color: #344054; border-bottom: 1pt solid #98a2b3; padding-bottom: 3mm; }
}
@page position-bottom-left {
  @bottom-left { content: "PN-POS-BL-4"; font: 700 12pt/2 sans-serif; color: #101828; border-top: 2pt solid #475467; padding-top: 4mm; }
}
@page position-bottom-center {
  @bottom-center { content: "PN-POS-BC-5"; font: 400 7pt/1.1 sans-serif; color: #1d2939; border-top: 0.75pt solid #667085; padding-top: 1mm; }
}
@page position-bottom-right {
  @bottom-right { content: "PN-POS-BR-6"; font: 700 11pt/1.8 sans-serif; color: #2457a6; border-top: 1.5pt solid #2457a6; padding-top: 3.5mm; }
}
.position-top-left { page: position-top-left; }
.position-top-center { page: position-top-center; }
.position-top-right { page: position-top-right; }
.position-bottom-left { page: position-bottom-left; }
.position-bottom-center { page: position-bottom-center; }
.position-bottom-right { page: position-bottom-right; }
`,
    expected: {
      pageCount: 6,
      sizeMillimeters: LANDSCAPE_SIZE,
      orientation: "landscape",
      pages: [
        { marker: "PAGE-POS-TOP-LEFT", pageNumberLabels: ["PN-POS-TL-1"] },
        { marker: "PAGE-POS-TOP-CENTER", pageNumberLabels: ["PN-POS-TC-2"] },
        { marker: "PAGE-POS-TOP-RIGHT", pageNumberLabels: ["PN-POS-TR-3"] },
        { marker: "PAGE-POS-BOTTOM-LEFT", pageNumberLabels: ["PN-POS-BL-4"] },
        { marker: "PAGE-POS-BOTTOM-CENTER", pageNumberLabels: ["PN-POS-BC-5"] },
        { marker: "PAGE-POS-BOTTOM-RIGHT", pageNumberLabels: ["PN-POS-BR-6"] },
      ],
      pngPages: [1, 2, 3, 4, 5, 6],
    },
  },
  {
    id: "inserted-blank-page",
    purpose: "Prove that an inserted blank page remains physical and counted.",
    required: true,
    capabilities: ["blank-pages", "document-visibility"],
    html: fixtureHtml([
      { marker: "PAGE-BLANK-LEAD", pageName: "ordinary" },
      { marker: "PAGE-BLANK-RIGHT", pageName: "right-hand" },
    ]),
    css: `${baseCss}
@page {
  size: 148mm 210mm;
  margin: 15mm;
  @bottom-center { content: "PN-BLANK-" counter(page) "/" counter(pages); }
}
.right-hand { break-before: right; }
`,
    expected: {
      pageCount: 3,
      sizeMillimeters: PORTRAIT_SIZE,
      orientation: "portrait",
      pages: [
        { marker: "PAGE-BLANK-LEAD", pageNumberLabels: ["PN-BLANK-1/3"] },
        { marker: "", pageNumberLabels: ["PN-BLANK-2/3"] },
        { marker: "PAGE-BLANK-RIGHT", pageNumberLabels: ["PN-BLANK-3/3"] },
      ],
      pngPages: [1, 2, 3],
    },
  },
  {
    id: "page-group-repagination-sentinel",
    purpose:
      "Keep the page-group-relative first-page selector observable without selecting a required baseline.",
    required: false,
    capabilities: ["repagination"],
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <link rel="stylesheet" href="style.css">
  </head>
  <body>
    <section class="fixture-page front"><p class="page-marker">PAGE-SENTINEL-PRE</p></section>
    <main class="document-body">
      <section class="sentinel-chunk"><p class="page-marker">PAGE-SENTINEL-BODY-1</p><p>${"Repagination evidence. ".repeat(80)}</p></section>
      <section class="sentinel-chunk"><p class="page-marker">PAGE-SENTINEL-BODY-2</p><p>${"Repagination evidence. ".repeat(80)}</p></section>
      <section class="sentinel-chunk"><p class="page-marker">PAGE-SENTINEL-BODY-3</p><p>${"Repagination evidence. ".repeat(80)}</p></section>
    </main>
  </body>
</html>
`,
    css: `${baseCss}
@page { size: 148mm 210mm; margin: 15mm; }
@page front { @bottom-center { content: none; } }
@page body {
  @bottom-center { content: "PN-SENTINEL-" counter(page); }
}
@page body:nth(1 of body) { counter-reset: page 20; }
.front { page: front; }
.document-body { page: body; }
.sentinel-chunk { box-sizing: border-box; break-after: page; height: 180mm; }
.sentinel-chunk:last-child { break-after: auto; }
`,
    expected: {
      pageCount: 4,
      sizeMillimeters: PORTRAIT_SIZE,
      orientation: "portrait",
      pages: [
        { marker: "PAGE-SENTINEL-PRE", pageNumberLabels: [] },
        { marker: "PAGE-SENTINEL-BODY-1", pageNumberLabels: ["PN-SENTINEL-20"] },
        { marker: "PAGE-SENTINEL-BODY-2", pageNumberLabels: ["PN-SENTINEL-21"] },
        { marker: "PAGE-SENTINEL-BODY-3", pageNumberLabels: ["PN-SENTINEL-22"] },
      ],
      pngPages: [2, 4],
    },
  },
];
