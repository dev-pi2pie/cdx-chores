import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PAGE_NUMBER_RENDERER_CONTRACT_VERSION = 4;
export const PAGE_NUMBER_LAB_MARKER_NAME = ".cdx-chores-page-number-renderer-evidence";
export const PAGE_NUMBER_LAB_MARKER_CONTENT =
  "cdx-chores markdown-pdf page-number renderer evidence v4\n";

export type RendererCapability =
  | "blank-pages"
  | "body-origin"
  | "document-visibility"
  | "increment"
  | "landscape"
  | "narrow-margins"
  | "positions"
  | "repagination"
  | "reset"
  | "separator"
  | "typography";

export type PageOrientation = "landscape" | "portrait";
export type PageNumberRegion = "bottom-center" | "bottom-right" | "top-right";

export const PAGE_NUMBER_AUTOMATED_EVIDENCE = [
  "candidate-selected CLI launch",
  "physical page count and order",
  "page-number text and visibility",
  "page dimensions and orientation",
  "page-number margin-box region",
  "complete decodable PNG production",
] as const;

export type VisualReviewAssertion =
  | "color"
  | "cover-transition"
  | "font-family"
  | "separator"
  | "stylesheet-cascade"
  | "typography";

export interface WeasyPrintCandidate {
  id: "wp-65-1" | "wp-68-0" | "wp-69-0";
  weasyPrintVersion: "65.1" | "68.0" | "69.0";
  dependencies: {
    pydyf: "0.12.1";
    fontTools: "4.63.0";
  };
}

export interface ExpectedPhysicalPage {
  marker: string;
  pageNumberLabels: readonly string[];
  pageNumberRegion?: PageNumberRegion;
  forbiddenText?: readonly string[];
}

export interface ExpectedPdfDocument {
  pageCount: number;
  sizeMillimeters: readonly [width: number, height: number];
  orientation: PageOrientation;
  pages: readonly ExpectedPhysicalPage[];
  pngPages: readonly number[];
}

export interface RendererContractScenario {
  id: string;
  purpose: string;
  required: boolean;
  capabilities: readonly RendererCapability[];
  html: string;
  css: string;
  expected: ExpectedPdfDocument;
}

export interface ProductRendererScenario {
  id: string;
  purpose: string;
  required: true;
  markdown: string;
  profile: string;
  template?: string;
  css?: string;
  expected: ExpectedPdfDocument;
  visualReviewRequired: readonly VisualReviewAssertion[];
}

export type ProjectRendererLaunchMode = "bundle" | "explicit-roles";

export interface ProjectRendererScenario {
  id: string;
  purpose: string;
  required: true;
  candidateIds: readonly WeasyPrintCandidate["id"][];
  authoring:
    | {
        mode: "cover-image-only";
        coverImage: { fileName: string; base64: string };
        expectedProjectSignalMode: "deterministic";
        liveCodexAllowed: false;
      }
    | {
        mode: "base-profile-only";
        baseProfile: string;
        expectedProjectSignalMode: "deterministic";
        liveCodexAllowed: false;
      };
  markdown: string;
  launchModes: readonly ProjectRendererLaunchMode[];
  expected: ExpectedPdfDocument;
  visualReviewRequired: readonly VisualReviewAssertion[];
  equivalenceBoundary?: {
    compare: readonly ["bundle", "explicit-roles"];
    automated: readonly string[];
    excluded: readonly string[];
  };
}

export interface MaterializedRendererContract {
  catalogDigest: string;
  fixtureRoot: string;
  bodyHookPaths: Readonly<Record<string, string>>;
  scenarioDirectories: Readonly<Record<string, string>>;
  launch: {
    markdownPath: string;
    profilePath: string;
  };
  productLaunches: Readonly<
    Record<
      string,
      {
        markdownPath: string;
        profilePath: string;
        templatePath?: string;
        cssPath?: string;
      }
    >
  >;
  projectLaunches: Readonly<
    Record<
      string,
      {
        authoringDirectory: string;
        baseProfilePath?: string;
        coverImagePath?: string;
        markdownPath: string;
        projectDirectory: string;
        bundlePath: string;
        profilePath: string;
        templatePath: string;
        cssPath: string;
      }
    >
  >;
}

const fixtureDirectory = dirname(fileURLToPath(import.meta.url));
const launchMarkdownName = "page-number-launch.md";
const launchProfileName = "page-number-launch-profile.yml";

const baseCss = String.raw`
html {
  font-family: sans-serif;
  font-size: 10pt;
}

body {
  margin: 0;
}

.fixture-page {
  break-after: page;
}

.fixture-page:last-child {
  break-after: auto;
}

.page-marker {
  font: 700 12pt monospace;
}
`;

function fixtureHtml(
  pages: readonly { marker: string; pageName: string; content?: string }[],
): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <link rel="stylesheet" href="style.css">
  </head>
  <body>
${pages
  .map(
    (page) => `    <section class="fixture-page ${page.pageName}">
      <p class="page-marker">${page.marker}</p>
      ${page.content ?? "<p>Deterministic renderer-contract content.</p>"}
    </section>`,
  )
  .join("\n")}
  </body>
</html>
`;
}

const portraitSize = [148, 210] as const;
const landscapeSize = [210, 148] as const;

export const WEASYPRINT_CANDIDATES: readonly WeasyPrintCandidate[] = [
  {
    id: "wp-65-1",
    weasyPrintVersion: "65.1",
    dependencies: { pydyf: "0.12.1", fontTools: "4.63.0" },
  },
  {
    id: "wp-68-0",
    weasyPrintVersion: "68.0",
    dependencies: { pydyf: "0.12.1", fontTools: "4.63.0" },
  },
  {
    id: "wp-69-0",
    weasyPrintVersion: "69.0",
    dependencies: { pydyf: "0.12.1", fontTools: "4.63.0" },
  },
];

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
      sizeMillimeters: portraitSize,
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
      sizeMillimeters: portraitSize,
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
      sizeMillimeters: portraitSize,
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
      sizeMillimeters: portraitSize,
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
      sizeMillimeters: landscapeSize,
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
      sizeMillimeters: portraitSize,
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
      sizeMillimeters: portraitSize,
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
  metadataTitle: hide

footer:
  center: "PRODUCT-A-REPLACED-SLOT"

pageNumbers:
  enabled: true
  position: bottom-center
  format: "PRODUCT-A-{page}/{pages}"
  scope: document
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
  pageBreak: after

fonts:
  pageChrome:
    default: "DejaVu Sans"

titleBlock:
  metadataTitle: hide

header:
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
  format: "PRODUCT-B-{page}/{pages}"
  scope: body
  countFrom: body
  start: 0
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

<div style="break-after: page"></div>

# PRODUCT-C-BODY-2

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
  format: "PRODUCT-C-{page}/{pages}"
  scope: body
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
`;

export const PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS: readonly ProductRendererScenario[] = [
  {
    id: "product-built-in-document-origin",
    purpose:
      "Automate the built-in Profile path through cover and ToC participation, selected-slot replacement, document-origin arithmetic, and bottom-center placement.",
    required: true,
    markdown: productDocumentOriginMarkdown,
    profile: productDocumentOriginProfile,
    expected: {
      pageCount: 5,
      sizeMillimeters: portraitSize,
      orientation: "portrait",
      pages: [
        {
          marker: "PRODUCTACOVER",
          pageNumberLabels: [],
          forbiddenText: ["PRODUCT-A-REPLACED-SLOT"],
        },
        {
          marker: "PRODUCT-A-BODY-1",
          pageNumberLabels: ["PRODUCT-A-2/5"],
          pageNumberRegion: "bottom-center",
          forbiddenText: ["PRODUCT-A-REPLACED-SLOT"],
        },
        {
          marker: "PRODUCT-A-BODY-1",
          pageNumberLabels: ["PRODUCT-A-4/5"],
          pageNumberRegion: "bottom-center",
          forbiddenText: ["PRODUCT-A-REPLACED-SLOT"],
        },
        {
          marker: "PRODUCT-A-BODY-2",
          pageNumberLabels: ["PRODUCT-A-6/5"],
          pageNumberRegion: "bottom-center",
          forbiddenText: ["PRODUCT-A-REPLACED-SLOT"],
        },
        {
          marker: "PRODUCT-A-BODY-3",
          pageNumberLabels: ["PRODUCT-A-8/5"],
          pageNumberRegion: "bottom-center",
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
      "Automate a selected Template body boundary with body-only visibility, top-right placement, and body-origin arithmetic; visual review covers the configured presentation.",
    required: true,
    markdown: productBodyOriginMarkdown,
    profile: productBodyOriginProfile,
    template: productBodyOriginTemplate,
    expected: {
      pageCount: 4,
      sizeMillimeters: portraitSize,
      orientation: "portrait",
      pages: [
        {
          marker: "PRODUCT-B-PREBODY",
          pageNumberLabels: [],
          forbiddenText: ["PRODUCT-B-REPLACED-SLOT"],
        },
        {
          marker: "PRODUCT-B-BODY-1",
          pageNumberLabels: ["PRODUCT-B-0/4"],
          pageNumberRegion: "top-right",
          forbiddenText: ["PRODUCT-B-REPLACED-SLOT"],
        },
        {
          marker: "PRODUCT-B-BODY-2",
          pageNumberLabels: ["PRODUCT-B-2/4"],
          pageNumberRegion: "top-right",
          forbiddenText: ["PRODUCT-B-REPLACED-SLOT"],
        },
        {
          marker: "PRODUCT-B-BODY-3",
          pageNumberLabels: ["PRODUCT-B-4/4"],
          pageNumberRegion: "top-right",
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
      "Automate later-stylesheet launch, Profile-owned content, and bottom-right placement; visual review covers font ownership and the presentation cascade.",
    required: true,
    markdown: productStylesheetPrecedenceMarkdown,
    profile: productStylesheetPrecedenceProfile,
    css: productStylesheetPrecedenceCss,
    expected: {
      pageCount: 2,
      sizeMillimeters: portraitSize,
      orientation: "portrait",
      pages: [
        {
          marker: "PRODUCT-C-BODY-1",
          pageNumberLabels: ["PRODUCT-C-1/2"],
          pageNumberRegion: "bottom-right",
          forbiddenText: ["PRODUCT-C-REPLACED-SLOT"],
        },
        {
          marker: "PRODUCT-C-BODY-2",
          pageNumberLabels: ["PRODUCT-C-2/2"],
          pageNumberRegion: "bottom-right",
          forbiddenText: ["PRODUCT-C-REPLACED-SLOT"],
        },
      ],
      pngPages: [1, 2],
    },
    visualReviewRequired: ["font-family", "typography", "color", "separator", "stylesheet-cascade"],
  },
];

const deterministicNoBaseProjectMarkdown = `---
title: PROJECT-NO-BASE-COVER
---

# PROJECT-NO-BASE-BODY-1

The no-base deterministic Project uses its canonical bundle launch on the oldest candidate.
`;

const deterministicBaseProjectMarkdown = `# PROJECT-BASE-BODY-1

The base-profile deterministic Project uses body-origin numbering.

<div style="break-after: page"></div>

# PROJECT-BASE-BODY-2

The second page preserves the configured arithmetic.
`;

const deterministicBaseProjectProfile = `page:
  size: A5
  orientation: portrait
  margin: 18mm

titleBlock:
  metadataTitle: hide

pageNumbers:
  enabled: true
  position: bottom-center
  format: "PROJECT-BASE-{page}/{pages}"
  scope: body
  countFrom: body
  start: 0
  increment: 2
`;

export const PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS: readonly ProjectRendererScenario[] = [
  {
    id: "project-deterministic-no-base-bundle",
    purpose:
      "Materialize a no-base deterministic Project without Codex and render its canonical bundle on the 65.1 baseline.",
    required: true,
    candidateIds: ["wp-65-1"],
    authoring: {
      mode: "cover-image-only",
      coverImage: {
        fileName: "cover.png",
        base64:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+RQS4WQAAAABJRU5ErkJggg==",
      },
      expectedProjectSignalMode: "deterministic",
      liveCodexAllowed: false,
    },
    markdown: deterministicNoBaseProjectMarkdown,
    launchModes: ["bundle"],
    expected: {
      pageCount: 2,
      sizeMillimeters: [210, 297],
      orientation: "portrait",
      pages: [
        { marker: "PROJECT-NO-BASE-COVER", pageNumberLabels: [] },
        { marker: "PROJECT-NO-BASE-BODY-1", pageNumberLabels: [] },
      ],
      pngPages: [1, 2],
    },
    visualReviewRequired: ["cover-transition"],
  },
  {
    id: "project-deterministic-base-profile-equivalence",
    purpose:
      "Materialize a base-profile deterministic Project without Codex and compare bundle versus explicit-role rendering on 69.0.",
    required: true,
    candidateIds: ["wp-69-0"],
    authoring: {
      mode: "base-profile-only",
      baseProfile: deterministicBaseProjectProfile,
      expectedProjectSignalMode: "deterministic",
      liveCodexAllowed: false,
    },
    markdown: deterministicBaseProjectMarkdown,
    launchModes: ["bundle", "explicit-roles"],
    expected: {
      pageCount: 2,
      sizeMillimeters: portraitSize,
      orientation: "portrait",
      pages: [
        {
          marker: "PROJECT-BASE-BODY-1",
          pageNumberLabels: ["PROJECT-BASE-0/2"],
          pageNumberRegion: "bottom-center",
        },
        {
          marker: "PROJECT-BASE-BODY-2",
          pageNumberLabels: ["PROJECT-BASE-2/2"],
          pageNumberRegion: "bottom-center",
        },
      ],
      pngPages: [1, 2],
    },
    visualReviewRequired: [],
    equivalenceBoundary: {
      compare: ["bundle", "explicit-roles"],
      automated: [
        "command outcome and warnings",
        "physical page count and dimensions",
        "extracted marker and page-number text by physical page",
        "page-number margin-box region",
        "diagnostics and renderer-capability outcomes",
      ],
      excluded: ["PDF byte equality", "PNG byte equality", "temporary paths"],
    },
  },
];

export const PAGE_NUMBER_BODY_HOOK_CASES = [
  {
    id: "generated-hook-document-origin",
    countFrom: "document",
    expected: "supported",
    html: '<main class="document-body"><p>$body$</p></main>\n',
  },
  {
    id: "generated-hook-body-origin",
    countFrom: "body",
    expected: "supported",
    html: '<main class="document-body"><p>$body$</p></main>\n',
  },
  {
    id: "legacy-hook-document-origin",
    countFrom: "document",
    expected: "warning-fallback",
    html: "<main><p>$body$</p></main>\n",
  },
  {
    id: "legacy-hook-body-origin",
    countFrom: "body",
    expected: "hard-error",
    html: "<main><p>$body$</p></main>\n",
  },
] as const;

function stableCatalogPayload(launchMarkdown: string, launchProfile: string) {
  return JSON.stringify({
    version: PAGE_NUMBER_RENDERER_CONTRACT_VERSION,
    candidates: WEASYPRINT_CANDIDATES,
    scenarios: PAGE_NUMBER_RENDERER_SCENARIOS,
    productScenarios: PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS,
    projectScenarios: PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS,
    evidenceBoundary: {
      automated: PAGE_NUMBER_AUTOMATED_EVIDENCE,
      visualReviewRequired: PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS.map((scenario) => ({
        scenarioId: scenario.id,
        assertions: scenario.visualReviewRequired,
      })).concat(
        PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS.map((scenario) => ({
          scenarioId: scenario.id,
          assertions: scenario.visualReviewRequired,
        })),
      ),
    },
    bodyHookCases: PAGE_NUMBER_BODY_HOOK_CASES,
    launch: { markdown: launchMarkdown, profile: launchProfile },
  });
}

export async function readPageNumberLaunchFixtures(): Promise<{
  markdown: string;
  profile: string;
}> {
  const [markdown, profile] = await Promise.all([
    readFile(join(fixtureDirectory, launchMarkdownName), "utf8"),
    readFile(join(fixtureDirectory, launchProfileName), "utf8"),
  ]);
  return { markdown, profile };
}

export async function pageNumberRendererContractDigest(): Promise<string> {
  const launch = await readPageNumberLaunchFixtures();
  return createHash("sha256")
    .update(stableCatalogPayload(launch.markdown, launch.profile))
    .digest("hex");
}

export async function materializePageNumberRendererContract(
  labRoot: string,
): Promise<MaterializedRendererContract> {
  const marker = await readFile(join(labRoot, PAGE_NUMBER_LAB_MARKER_NAME), "utf8");
  if (marker !== PAGE_NUMBER_LAB_MARKER_CONTENT) {
    throw new Error("Refusing to materialize renderer fixtures in an unowned laboratory.");
  }

  const launch = await readPageNumberLaunchFixtures();
  const catalogDigest = createHash("sha256")
    .update(stableCatalogPayload(launch.markdown, launch.profile))
    .digest("hex");
  const fixtureRoot = join(labRoot, "fixtures");
  const scenarioDirectories: Record<string, string> = {};
  const bodyHookPaths: Record<string, string> = {};
  const productLaunches: Record<
    string,
    {
      markdownPath: string;
      profilePath: string;
      templatePath?: string;
      cssPath?: string;
    }
  > = {};
  const projectLaunches: Record<
    string,
    {
      authoringDirectory: string;
      baseProfilePath?: string;
      coverImagePath?: string;
      markdownPath: string;
      projectDirectory: string;
      bundlePath: string;
      profilePath: string;
      templatePath: string;
      cssPath: string;
    }
  > = {};

  await mkdir(fixtureRoot);
  for (const scenario of PAGE_NUMBER_RENDERER_SCENARIOS) {
    const scenarioDirectory = join(fixtureRoot, scenario.id);
    await mkdir(scenarioDirectory);
    await Promise.all([
      writeFile(join(scenarioDirectory, "input.html"), scenario.html, "utf8"),
      writeFile(join(scenarioDirectory, "style.css"), scenario.css, "utf8"),
    ]);
    scenarioDirectories[scenario.id] = scenarioDirectory;
  }

  const bodyHookDirectory = join(fixtureRoot, "body-hooks");
  await mkdir(bodyHookDirectory);
  for (const bodyHookCase of PAGE_NUMBER_BODY_HOOK_CASES) {
    const bodyHookPath = join(bodyHookDirectory, `${bodyHookCase.id}.html`);
    await writeFile(bodyHookPath, bodyHookCase.html, "utf8");
    bodyHookPaths[bodyHookCase.id] = bodyHookPath;
  }

  const launchDirectory = join(fixtureRoot, "actual-launch");
  await mkdir(launchDirectory);
  const markdownPath = join(launchDirectory, launchMarkdownName);
  const profilePath = join(launchDirectory, launchProfileName);
  await Promise.all([
    writeFile(markdownPath, launch.markdown, "utf8"),
    writeFile(profilePath, launch.profile, "utf8"),
    writeFile(
      join(fixtureRoot, "contract.json"),
      `${JSON.stringify(
        {
          version: PAGE_NUMBER_RENDERER_CONTRACT_VERSION,
          catalogDigest,
          candidates: WEASYPRINT_CANDIDATES,
          scenarios: PAGE_NUMBER_RENDERER_SCENARIOS.map(
            ({ html: _html, css: _css, ...scenario }) => scenario,
          ),
          productScenarios: PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS.map(
            ({
              markdown: _markdown,
              profile: _profile,
              template: _template,
              css: _css,
              ...scenario
            }) => scenario,
          ),
          projectScenarios: PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS.map(
            ({ authoring, markdown: _markdown, ...scenario }) => ({
              ...scenario,
              authoring:
                authoring.mode === "base-profile-only"
                  ? { ...authoring, baseProfile: undefined }
                  : {
                      ...authoring,
                      coverImage: { ...authoring.coverImage, base64: undefined },
                    },
            }),
          ),
          evidenceBoundary: {
            automated: PAGE_NUMBER_AUTOMATED_EVIDENCE,
            visualReviewRequired: [
              ...PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS,
              ...PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS,
            ].map((scenario) => ({
              scenarioId: scenario.id,
              assertions: scenario.visualReviewRequired,
            })),
          },
          bodyHookCases: PAGE_NUMBER_BODY_HOOK_CASES.map(
            ({ html: _html, ...bodyHookCase }) => bodyHookCase,
          ),
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
  ]);

  const productLaunchDirectory = join(fixtureRoot, "product-launches");
  await mkdir(productLaunchDirectory);
  for (const scenario of PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS) {
    const scenarioDirectory = join(productLaunchDirectory, scenario.id);
    await mkdir(scenarioDirectory);
    const markdownPath = join(scenarioDirectory, "input.md");
    const profilePath = join(scenarioDirectory, "profile.yml");
    const templatePath = scenario.template ? join(scenarioDirectory, "template.html") : undefined;
    const cssPath = scenario.css ? join(scenarioDirectory, "custom.css") : undefined;
    await Promise.all([
      writeFile(markdownPath, scenario.markdown, "utf8"),
      writeFile(profilePath, scenario.profile, "utf8"),
      ...(templatePath && scenario.template
        ? [writeFile(templatePath, scenario.template, "utf8")]
        : []),
      ...(cssPath && scenario.css ? [writeFile(cssPath, scenario.css, "utf8")] : []),
    ]);
    productLaunches[scenario.id] = {
      markdownPath,
      profilePath,
      ...(templatePath ? { templatePath } : {}),
      ...(cssPath ? { cssPath } : {}),
    };
  }

  const projectLaunchDirectory = join(fixtureRoot, "project-launches");
  await mkdir(projectLaunchDirectory);
  for (const scenario of PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS) {
    const authoringDirectory = join(projectLaunchDirectory, scenario.id);
    await mkdir(authoringDirectory);
    const markdownPath = join(authoringDirectory, "input.md");
    const projectDirectory = join(authoringDirectory, "project");
    const baseProfilePath =
      scenario.authoring.mode === "base-profile-only"
        ? join(authoringDirectory, "base-profile.yml")
        : undefined;
    const coverImagePath =
      scenario.authoring.mode === "cover-image-only"
        ? join(authoringDirectory, scenario.authoring.coverImage.fileName)
        : undefined;
    await Promise.all([
      writeFile(markdownPath, scenario.markdown, "utf8"),
      ...(baseProfilePath && scenario.authoring.mode === "base-profile-only"
        ? [writeFile(baseProfilePath, scenario.authoring.baseProfile, "utf8")]
        : []),
      ...(coverImagePath && scenario.authoring.mode === "cover-image-only"
        ? [writeFile(coverImagePath, Buffer.from(scenario.authoring.coverImage.base64, "base64"))]
        : []),
    ]);
    projectLaunches[scenario.id] = {
      authoringDirectory,
      ...(baseProfilePath ? { baseProfilePath } : {}),
      ...(coverImagePath ? { coverImagePath } : {}),
      markdownPath,
      projectDirectory,
      bundlePath: projectDirectory,
      profilePath: join(projectDirectory, "profile.yml"),
      templatePath: join(projectDirectory, "template.html"),
      cssPath: join(projectDirectory, "style.css"),
    };
  }

  return {
    catalogDigest,
    fixtureRoot,
    bodyHookPaths,
    scenarioDirectories,
    launch: { markdownPath, profilePath },
    productLaunches,
    projectLaunches,
  };
}
