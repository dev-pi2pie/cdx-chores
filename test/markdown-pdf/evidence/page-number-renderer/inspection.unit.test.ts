import { describe, expect, test } from "bun:test";

import {
  assessOnePassCounterEvidence,
  extractionSummary,
} from "../../../../scripts/spikes/markdown-pdf-page-number-renderer-evidence/pdf";
import type { PdfEvidence } from "../../../../scripts/spikes/markdown-pdf-page-number-renderer-evidence/contract";
import { validatePdfEvidence } from "../../../../scripts/spikes/markdown-pdf-page-number-renderer-evidence/pdf";

import { evidenceRun } from "../page-number-support";

describe("Markdown PDF renderer evidence inspection and validation", () => {
  test("extracts contract-driven negative logical values and compares all four counters", () => {
    const expectedPages = [
      {
        role: "document-body" as const,
        marker: "NEGATIVE-COUNTER-PAGE",
        pageNumberLabels: [],
        counterValues: { page: -5, pages: -1, pdfPage: 1, pdfPages: 1 },
      },
    ];
    const evidence: PdfEvidence = {
      pageCount: 1,
      pages: [
        {
          text: "NEGATIVE-COUNTER-PAGE ALT-COUNTERS<page=-5,pages=-1,pdfPage=1,pdfPages=1>",
          runs: [],
          widthMillimeters: 148,
          heightMillimeters: 210,
        },
      ],
      pageLabelState: "default-physical",
    };
    const extraction = extractionSummary(evidence, expectedPages, {
      marker: "ALT-COUNTERS",
      source: String.raw`ALT-COUNTERS<page=(?<page>-?\d+),pages=(?<pages>-?\d+),pdfPage=(?<pdfPage>\d+),pdfPages=(?<pdfPages>\d+)>`,
    });
    expect(extraction.counterValuesByPhysicalPage).toEqual([
      { page: -5, pages: -1, pdfPage: 1, pdfPages: 1 },
    ]);
    expect(assessOnePassCounterEvidence(extraction, expectedPages)).toEqual({
      mechanism: "one-pass",
      expectedPhysicalPages: [1],
      matchingPhysicalPages: [1],
      allCounterValuesMatch: true,
      evidencePassed: true,
      mismatches: [],
    });

    const wrongExtraction = {
      ...extraction,
      counterValuesByPhysicalPage: [{ page: -4, pages: -2, pdfPage: 2, pdfPages: 3 }],
    };
    expect(assessOnePassCounterEvidence(wrongExtraction, expectedPages)).toEqual(
      expect.objectContaining({
        evidencePassed: false,
        allCounterValuesMatch: false,
        mismatches: [
          "physical page 1 page expected -5, received -4",
          "physical page 1 pages expected -1, received -2",
          "physical page 1 pdfPage expected 1, received 2",
          "physical page 1 pdfPages expected 1, received 3",
        ],
      }),
    );
  });

  test("compacts PDF whitespace only for required and forbidden annotation text", () => {
    const scenario = {
      expected: {
        pageCount: 1,
        sizeMillimeters: [148, 210] as const,
        orientation: "portrait" as const,
        pages: [
          {
            role: "document-body" as const,
            marker: "WRAP-MARKER",
            pageNumberLabels: ["WRAP-LABEL"],
            requiredText: ["PRODUCT-D-FOOTER"],
            forbiddenText: ["PRODUCT-D-METADATA-TITLE"],
          },
        ],
        pngPages: [],
      },
    };
    const basePage = {
      text: "WRAP-MARKER PRODUCT-D- FOOTER WRAP-LABEL",
      runs: [evidenceRun("WRAP-MARKER", 20, 100, 40, 5), evidenceRun("WRAP-LABEL", 60, 10, 28, 4)],
      widthMillimeters: 148,
      heightMillimeters: 210,
    };
    const evidence: PdfEvidence = {
      pageCount: 1,
      pages: [basePage],
      pageLabelState: "default-physical",
    };

    expect(validatePdfEvidence(scenario, evidence)).toEqual([]);
    expect(
      validatePdfEvidence(scenario, {
        ...evidence,
        pages: [{ ...basePage, text: `${basePage.text} PRODUCT-D-METADATA- TITLE` }],
      }),
    ).toContain("physical page 1 contains forbidden text PRODUCT-D-METADATA-TITLE");
    expect(
      validatePdfEvidence(scenario, {
        ...evidence,
        pages: [{ ...basePage, text: basePage.text.replace("WRAP-MARKER", "WRAP- MARKER") }],
      }),
    ).toContain("physical page 1 is missing marker WRAP-MARKER");
  });
});
