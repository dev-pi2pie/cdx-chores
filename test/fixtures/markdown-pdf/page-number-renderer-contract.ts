import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PAGE_NUMBER_RENDERER_CONTRACT_VERSION = 1;
export const PAGE_NUMBER_LAB_MARKER_NAME = ".cdx-chores-page-number-renderer-evidence";
export const PAGE_NUMBER_LAB_MARKER_CONTENT =
  "cdx-chores markdown-pdf page-number renderer evidence v1\n";

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
}

export interface RendererContractScenario {
  id: string;
  purpose: string;
  required: boolean;
  capabilities: readonly RendererCapability[];
  html: string;
  css: string;
  expected: {
    pageCount: number;
    sizeMillimeters: readonly [width: number, height: number];
    orientation: PageOrientation;
    pages: readonly ExpectedPhysicalPage[];
    pngPages: readonly number[];
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

  return {
    catalogDigest,
    fixtureRoot,
    bodyHookPaths,
    scenarioDirectories,
    launch: { markdownPath, profilePath },
  };
}
