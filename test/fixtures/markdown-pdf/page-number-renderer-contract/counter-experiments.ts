import { baseCss, fixtureHtml, PORTRAIT_SIZE } from "./shared-content";
import type { CounterExperimentScenario } from "./types";

/**
 * Non-required renderer experiments for the Phase 14.5 evidence gate. A
 * passing mock protects report wiring only; real renderer evidence is required
 * before the mechanism can be accepted for production.
 */
export const PAGE_NUMBER_COUNTER_EXPERIMENTS: readonly CounterExperimentScenario[] = [
  {
    id: "phase-14-5-one-pass-four-counters",
    purpose:
      "Test whether one render can expose body-logical current/final values beside physical PDF current/total values.",
    required: false,
    mechanism: "one-pass",
    counterEvidencePattern: {
      marker: "PH14.5-COUNTERS",
      source: String.raw`PH14\.5-COUNTERS\[page=(?<page>-?\d+);pages=(?<pages>-?\d+);pdfPage=(?<pdfPage>\d+);pdfPages=(?<pdfPages>\d+)\]`,
    },
    capabilities: ["body-origin", "reset", "increment"],
    html: fixtureHtml([
      { marker: "PH14.5-COVER", pageName: "cover" },
      { marker: "PH14.5-TOC", pageName: "toc" },
      { marker: "PH14.5-BODY-1", pageName: "body-page" },
      { marker: "PH14.5-BODY-2", pageName: "body-page" },
      {
        marker: "PH14.5-BODY-3",
        pageName: "body-page",
        content: '<span id="logical-final"></span>',
      },
    ]),
    css: `${baseCss}
@page {
  size: 148mm 210mm;
  margin: 15mm;
}
@page cover { @bottom-center { content: none; } }
@page toc { @bottom-center { content: none; } }
@page body {
  counter-increment: logical-page 2;
  @bottom-center {
    content: "PH14.5-COUNTERS[page=" counter(logical-page) ";pages=" target-counter(url("#logical-final"), logical-page) ";pdfPage=" counter(page) ";pdfPages=" counter(pages) "]";
  }
}
@page body:nth(1 of body) { counter-reset: logical-page 3; }
.cover { page: cover; }
.toc { page: toc; }
.body-page { page: body; }
`,
    expected: {
      pageCount: 5,
      sizeMillimeters: PORTRAIT_SIZE,
      orientation: "portrait",
      pages: [
        { role: "cover", marker: "PH14.5-COVER", pageNumberLabels: [] },
        { role: "table-of-contents", marker: "PH14.5-TOC", pageNumberLabels: [] },
        {
          role: "document-body",
          marker: "PH14.5-BODY-1",
          pageNumberLabels: ["PH14.5-COUNTERS[page=5;pages=9;pdfPage=3;pdfPages=5]"],
          pageNumberRegion: "bottom-center",
          counterValues: { page: 5, pages: 9, pdfPage: 3, pdfPages: 5 },
        },
        {
          role: "document-body",
          marker: "PH14.5-BODY-2",
          pageNumberLabels: ["PH14.5-COUNTERS[page=7;pages=9;pdfPage=4;pdfPages=5]"],
          pageNumberRegion: "bottom-center",
          counterValues: { page: 7, pages: 9, pdfPage: 4, pdfPages: 5 },
        },
        {
          role: "document-body",
          marker: "PH14.5-BODY-3",
          pageNumberLabels: ["PH14.5-COUNTERS[page=9;pages=9;pdfPage=5;pdfPages=5]"],
          pageNumberRegion: "bottom-center",
          counterValues: { page: 9, pages: 9, pdfPage: 5, pdfPages: 5 },
        },
      ],
      pngPages: [1, 2, 3, 5],
    },
  },
];
