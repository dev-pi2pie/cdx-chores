import { describe, expect, test } from "bun:test";
import { stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  assessOnePassCounterEvidence,
  closeRetainedEvidenceLaboratory,
  extractionSummary,
  inspectPdf,
  publicEvidenceReport,
  runRendererEvidence,
} from "../../scripts/spikes/markdown-pdf-page-number-renderer-evidence";
import type { PdfEvidence } from "../../scripts/spikes/markdown-pdf-page-number-renderer-evidence";
import { validatePdfEvidence } from "../../scripts/spikes/markdown-pdf-page-number-renderer-evidence/pdf";
import {
  PAGE_NUMBER_COUNTER_EXPERIMENTS,
  PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS,
} from "../fixtures/markdown-pdf/page-number-renderer-contract";
import {
  createMockExecution,
  evidenceRun,
  minimalPdf,
  mockPng,
  pathHasSegment,
  withEvidenceRoot,
} from "./support";

describe("Markdown PDF renderer evidence inspection and validation", () => {
  test("reports page roles and one-pass four-counter evidence without replacing the historical baseline", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const mock = createMockExecution();
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "phase-14-5-one-pass-report",
        runner: mock.runner,
        inspectPdf: mock.inspectPdf,
      });
      const experimentId = PAGE_NUMBER_COUNTER_EXPERIMENTS[0]?.id;
      expect(experimentId).toBe("phase-14-5-one-pass-four-counters");
      for (const candidate of report.candidates) {
        const historical = candidate.scenarios.find(
          (scenario) => scenario.id === "document-origin-visibility",
        );
        expect(historical?.extraction?.labelsByPhysicalPage).toEqual([
          [],
          [],
          ["PN-DOC-3/7"],
          ["PN-DOC-4/7"],
          ["PN-DOC-5/7"],
          ["PN-DOC-6/7"],
          ["PN-DOC-7/7"],
        ]);
        expect(historical?.extraction?.pageRolesByPhysicalPage).toEqual([
          "cover",
          "cover",
          "metadata-title",
          "table-of-contents",
          "table-of-contents",
          "document-body",
          "document-body",
        ]);

        const experiment = candidate.counterExperiments.find(
          (scenario) => scenario.id === experimentId,
        );
        expect(experiment?.extraction?.pageRolesByPhysicalPage).toEqual([
          "cover",
          "table-of-contents",
          "document-body",
          "document-body",
          "document-body",
        ]);
        expect(experiment?.extraction?.counterValuesByPhysicalPage).toEqual([
          null,
          null,
          { page: 5, pages: 9, pdfPage: 3, pdfPages: 5 },
          { page: 7, pages: 9, pdfPage: 4, pdfPages: 5 },
          { page: 9, pages: 9, pdfPage: 5, pdfPages: 5 },
        ]);
        expect(experiment?.assessment).toEqual({
          mechanism: "one-pass",
          expectedPhysicalPages: [3, 4, 5],
          matchingPhysicalPages: [3, 4, 5],
          allCounterValuesMatch: true,
          evidencePassed: true,
          mismatches: [],
        });
      }
      expect(publicEvidenceReport(report).candidates[0]?.counterExperiments[0]?.assessment).toEqual(
        report.candidates[0]?.counterExperiments[0]?.assessment,
      );
      await expect(stat(report.labPath)).rejects.toThrow();
    });
  });

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

  test("retains failed optional counter evidence without failing the required outcome", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const experiment = PAGE_NUMBER_COUNTER_EXPERIMENTS[0];
      expect(experiment).toBeDefined();
      const expectedLabel = experiment?.expected.pages[2]?.pageNumberLabels[0];
      expect(expectedLabel).toBeDefined();
      const wrongLabel = expectedLabel?.replace("page=5", "page=6") ?? "";
      const mock = createMockExecution({
        inspect: (path, evidence) =>
          experiment && pathHasSegment(path, experiment.id)
            ? {
                ...evidence,
                pages: evidence.pages.map((page, index) =>
                  index === 2 && expectedLabel
                    ? {
                        ...page,
                        text: page.text.replace(expectedLabel, wrongLabel),
                        runs: page.runs.map((run) =>
                          run.text === expectedLabel ? { ...run, text: wrongLabel } : run,
                        ),
                      }
                    : page,
                ),
              }
            : evidence,
      });
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "optional-counter-experiment-failure",
        runner: mock.runner,
        inspectPdf: mock.inspectPdf,
      });

      expect(report.outcome).toBe("passed");
      expect(report.retained).toBe(true);
      expect(report.failures).toContainEqual(
        expect.objectContaining({
          scenarioId: experiment?.id,
          classification: "contract-failure",
        }),
      );
      expect(
        report.candidates.every((candidate) => {
          const evidence = candidate.counterExperiments.find((item) => item.id === experiment?.id);
          return evidence?.passed === false && evidence.assessment?.evidencePassed === false;
        }),
      ).toBe(true);
      expect(
        publicEvidenceReport(report).candidates[0]?.counterExperiments[0]?.assessment
          ?.evidencePassed,
      ).toBe(false);
      expect((await stat(report.labPath)).isDirectory()).toBe(true);
      await closeRetainedEvidenceLaboratory(report.labPath, temporaryRoot);
    });
  });

  test("extracts text and A5 dimensions through the real PDF inspector", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const pdfPath = join(temporaryRoot, "inspector.pdf");
      await writeFile(pdfPath, minimalPdf("PDF-INSPECTOR-EVIDENCE"));
      const evidence = await inspectPdf(pdfPath);
      expect(evidence.pageCount).toBe(1);
      expect(evidence.pageLabelState).toBe("default-physical");
      expect(evidence.pages).toHaveLength(1);
      expect(evidence.pages[0]?.text).toContain("PDF-INSPECTOR-EVIDENCE");
      expect(evidence.pages[0]?.runs).toContainEqual(
        expect.objectContaining({
          text: "PDF-INSPECTOR-EVIDENCE",
          xMillimeters: expect.any(Number),
          yMillimeters: expect.any(Number),
        }),
      );
      expect(evidence.pages[0]?.widthMillimeters).toBeCloseTo(148, 1);
      expect(evidence.pages[0]?.heightMillimeters).toBeCloseTo(210, 1);
    });
  });

  test("gates unexpected custom PDF page-label metadata", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const mock = createMockExecution({
        inspect: (path, expected) =>
          path.includes("document-origin-visibility")
            ? { ...expected, pageLabelState: "unexpected-custom" }
            : expected,
      });
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "custom-page-labels",
        runner: mock.runner,
        inspectPdf: mock.inspectPdf,
      });
      expect(report.outcome).toBe("failed");
      expect(report.failures).toContainEqual(
        expect.objectContaining({
          stage: "contract-extraction",
          message: expect.stringContaining("unexpected custom page-label metadata"),
        }),
      );
      expect(
        report.candidates[0]?.scenarios.find(
          (scenario) => scenario.id === "document-origin-visibility",
        )?.extraction?.pageLabelState,
      ).toBe("unexpected-custom");
      await closeRetainedEvidenceLaboratory(report.labPath, temporaryRoot);
    });
  });

  test("gates unexpected custom page labels on implemented product launches", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const target = PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS[0];
      expect(target).toBeDefined();
      const mock = createMockExecution({
        inspect: (path, expected) =>
          target && pathHasSegment(path, target.id)
            ? { ...expected, pageLabelState: "unexpected-custom" }
            : expected,
      });
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "product-custom-page-labels",
        runner: mock.runner,
        inspectPdf: mock.inspectPdf,
      });
      expect(report.outcome).toBe("failed");
      expect(report.failures).toContainEqual(
        expect.objectContaining({
          stage: "actual-launch-extraction",
          scenarioId: target?.id,
          message: expect.stringContaining("unexpected custom page-label metadata"),
        }),
      );
      await closeRetainedEvidenceLaboratory(report.labPath, temporaryRoot);
    });
  });

  test("allows ToC pages to repeat body heading markers", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const target = PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS.find(
        (scenario) => scenario.id === "product-built-in-document-origin",
      );
      expect(target).toBeDefined();
      const mock = createMockExecution({
        inspect: (path, expected) =>
          target && pathHasSegment(path, target.id)
            ? {
                ...expected,
                pages: expected.pages.map((page, index) =>
                  index === 1
                    ? {
                        ...page,
                        text: `${page.text} PRODUCT-A-BODY-2 PRODUCT-A-BODY-3`,
                      }
                    : page,
                ),
              }
            : expected,
      });
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "toc-repeated-heading-markers",
        runner: mock.runner,
        inspectPdf: mock.inspectPdf,
      });

      expect(report.outcome).toBe("passed");
      expect(report.failures).toEqual([]);
    });
  });

  test("continues to reject repeated heading markers on non-ToC pages", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const target = PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS.find(
        (scenario) => scenario.id === "product-built-in-document-origin",
      );
      expect(target).toBeDefined();
      const mock = createMockExecution({
        inspect: (path, expected) =>
          target && pathHasSegment(path, target.id)
            ? {
                ...expected,
                pages: expected.pages.map((page, index) =>
                  index === 2 ? { ...page, text: `${page.text} PRODUCT-A-BODY-2` } : page,
                ),
              }
            : expected,
      });
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "body-repeated-heading-markers",
        runner: mock.runner,
        inspectPdf: mock.inspectPdf,
      });

      expect(report.outcome).toBe("failed");
      expect(
        report.failures.some(
          (failure) =>
            failure.scenarioId === target?.id &&
            failure.message.includes("out-of-order marker PRODUCT-A-BODY-2"),
        ),
      ).toBe(true);
      await closeRetainedEvidenceLaboratory(report.labPath, temporaryRoot);
    });
  });

  test("requires the Product A company marker exactly once on its visible cover page", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const target = PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS.find(
        (scenario) => scenario.id === "product-built-in-document-origin",
      );
      expect(target).toBeDefined();
      const mock = createMockExecution({
        inspect: (path, expected) =>
          target && pathHasSegment(path, target.id)
            ? {
                ...expected,
                pages: expected.pages.map((page, index) =>
                  index === 1 ? { ...page, text: `${page.text} PRODUCT-A-COMPANY-ONCE` } : page,
                ),
              }
            : expected,
      });
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "product-a-duplicate-company-marker",
        runner: mock.runner,
        inspectPdf: mock.inspectPdf,
      });

      expect(report.outcome).toBe("failed");
      expect(report.failures).toContainEqual(
        expect.objectContaining({
          scenarioId: target?.id,
          message: expect.stringContaining(
            "extracted text PRODUCT-A-COMPANY-ONCE expected 1 occurrence(s), received 2",
          ),
        }),
      );
      expect(report.failures).toContainEqual(
        expect.objectContaining({
          scenarioId: target?.id,
          message: expect.stringContaining(
            "extracted text PRODUCT-A-COMPANY-ONCE expected physical pages 1, received 1,2",
          ),
        }),
      );
      await closeRetainedEvidenceLaboratory(report.labPath, temporaryRoot);
    });
  });

  test("classifies extraction mismatches as contract failures and retains the laboratory", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const mock = createMockExecution({
        inspect: (path, expected) =>
          path.includes("document-origin-visibility")
            ? {
                ...expected,
                pages: expected.pages.map((page, index) =>
                  index === 0 ? { ...page, text: "WRONG-ORDER PN-DOC-3/7" } : page,
                ),
              }
            : expected,
      });
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "contract-failure",
        runner: mock.runner,
        inspectPdf: mock.inspectPdf,
      });

      expect(report.outcome).toBe("failed");
      expect(report.retained).toBe(true);
      expect(
        report.failures.some(
          (failure) =>
            failure.classification === "contract-failure" &&
            failure.stage === "contract-extraction" &&
            failure.scenarioId === "document-origin-visibility",
        ),
      ).toBe(true);
      expect((await stat(report.labPath)).isDirectory()).toBe(true);
      await closeRetainedEvidenceLaboratory(report.labPath, temporaryRoot);
    });
  });

  test("rejects missing physical pages and non-finite dimensions", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const mock = createMockExecution({
        inspect: (path, expected) =>
          path.includes("document-origin-visibility")
            ? {
                ...expected,
                pages: expected.pages
                  .slice(0, -1)
                  .map((page, index) =>
                    index === 0 ? { ...page, widthMillimeters: Number.NaN } : page,
                  ),
              }
            : expected,
      });
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "malformed-extraction",
        runner: mock.runner,
        inspectPdf: mock.inspectPdf,
      });
      expect(report.outcome).toBe("failed");
      expect(
        report.failures.some(
          (failure) =>
            failure.scenarioId === "document-origin-visibility" &&
            failure.message.includes("physical page 7 is missing") &&
            failure.message.includes("unexpected dimensions"),
        ),
      ).toBe(true);
      await closeRetainedEvidenceLaboratory(report.labPath, temporaryRoot);
    });
  });

  test("gates product-launch extraction including selected-slot replacement", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const selected = PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS[0];
      expect(selected).toBeDefined();
      const mock = createMockExecution({
        inspect: (path, expected) =>
          selected && pathHasSegment(path, selected.id)
            ? {
                ...expected,
                pages: expected.pages.map((page, index) =>
                  index === 0 ? { ...page, text: `${page.text} PRODUCT-A-REPLACED-SLOT` } : page,
                ),
              }
            : expected,
      });
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "product-launch-slot-failure",
        runner: mock.runner,
        inspectPdf: mock.inspectPdf,
      });

      expect(report.outcome).toBe("failed");
      expect(report.failures).toContainEqual(
        expect.objectContaining({
          stage: "actual-launch-extraction",
          classification: "contract-failure",
          scenarioId: selected?.id,
          message: expect.stringContaining("forbidden text"),
        }),
      );
      expect(
        report.candidates.every(
          (candidate) =>
            candidate.productScenarios.find((scenario) => scenario.id === selected?.id)?.passed ===
            false,
        ),
      ).toBe(true);
      await closeRetainedEvidenceLaboratory(report.labPath, temporaryRoot);
    });
  });

  test("gates product page count, body visibility, dimensions, and margin-box region", async () => {
    const selected = PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS.find(
      (scenario) => scenario.id === "product-explicit-body-origin",
    );
    expect(selected).toBeDefined();
    const label = selected?.expected.pages[1]?.pageNumberLabels[0] ?? "PRODUCT-B-L5/9-P2/4";
    const cases: Array<{
      id: string;
      message: string;
      mutate: (evidence: PdfEvidence) => PdfEvidence;
    }> = [
      {
        id: "page-count",
        message: "expected 4 pages",
        mutate: (evidence) => ({ ...evidence, pageCount: 3 }),
      },
      {
        id: "body-visibility",
        message: "out-of-order label",
        mutate: (evidence) => ({
          ...evidence,
          pages: evidence.pages.map((page, index) =>
            index === 0
              ? {
                  ...page,
                  text: `${page.text} ${label}`,
                  runs: [...page.runs, evidenceRun(label, 110, 190, 28, 4)],
                }
              : page,
          ),
        }),
      },
      {
        id: "dimensions",
        message: "unexpected dimensions",
        mutate: (evidence) => ({
          ...evidence,
          pages: evidence.pages.map((page, index) =>
            index === 1 ? { ...page, widthMillimeters: 120 } : page,
          ),
        }),
      },
      {
        id: "region",
        message: "outside top-right",
        mutate: (evidence) => ({
          ...evidence,
          pages: evidence.pages.map((page, index) =>
            index === 1
              ? {
                  ...page,
                  runs: page.runs.map((run) =>
                    run.text.includes(label)
                      ? { ...run, xMillimeters: 20, yMillimeters: 100 }
                      : run,
                  ),
                }
              : page,
          ),
        }),
      },
    ];

    for (const failureCase of cases) {
      await withEvidenceRoot(async (temporaryRoot) => {
        const mock = createMockExecution({
          inspect: (path, evidence) =>
            selected && pathHasSegment(path, selected.id) ? failureCase.mutate(evidence) : evidence,
        });
        const report = await runRendererEvidence({
          temporaryRoot,
          uniqueId: `product-${failureCase.id}-failure`,
          runner: mock.runner,
          inspectPdf: mock.inspectPdf,
        });
        expect(report.outcome).toBe("failed");
        expect(report.failures).toContainEqual(
          expect.objectContaining({
            stage: "actual-launch-extraction",
            scenarioId: selected?.id,
            message: expect.stringContaining(failureCase.message),
          }),
        );
        await closeRetainedEvidenceLaboratory(report.labPath, temporaryRoot);
      });
    }
  });

  test("aggregates contiguous split text runs before validating a label region", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const scenarioId = "product-explicit-body-origin";
      const label = "PRODUCT-B-L5/9-P2/4";
      const firstLabelRun = "PRODUCT-B-";
      const secondLabelRun = "L5/9-P2/4";
      const mock = createMockExecution({
        inspect: (path, evidence) =>
          pathHasSegment(path, scenarioId)
            ? {
                ...evidence,
                pages: evidence.pages.map((page, pageIndex) =>
                  pageIndex === 1
                    ? {
                        ...page,
                        text: page.text.replace(label, `${firstLabelRun} ${secondLabelRun}`),
                        runs: page.runs.flatMap((run) =>
                          run.text === label
                            ? [
                                evidenceRun(firstLabelRun, 110, 190, 18, 4),
                                evidenceRun(secondLabelRun, 128, 190, 20, 4),
                              ]
                            : [run],
                        ),
                      }
                    : page,
                ),
              }
            : evidence,
      });
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "split-label-runs",
        runner: mock.runner,
        inspectPdf: mock.inspectPdf,
      });
      expect(report.outcome).toBe("passed");
      expect(report.evidenceStatus).toBe("visual-review-required");
      expect(report.failures).toEqual([]);
      expect(
        report.candidates.every(
          (candidate) =>
            candidate.productScenarios.find((scenario) => scenario.id === scenarioId)?.passed,
        ),
      ).toBe(true);
    });
  });

  test("gates required repeating content and automatic metadata-title page ownership", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const scenario = PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS.find(
        (item) => item.id === "product-built-in-automatic-metadata-title",
      );
      expect(scenario?.expected.pages.map((page) => page.role)).toEqual([
        "table-of-contents",
        "document-body",
      ]);
      expect(scenario?.expected.pages[0]?.forbiddenText).toContain("PRODUCT-D-METADATA-TITLE");
      expect(scenario?.expected.pages[1]?.requiredText).toContain("PRODUCT-D-METADATA-TITLE");

      const mock = createMockExecution({
        inspect: (path, evidence) =>
          scenario && pathHasSegment(path, scenario.id)
            ? {
                ...evidence,
                pages: evidence.pages.map((page, index) =>
                  index === 0
                    ? {
                        ...page,
                        text: page.text.replace("PRODUCT-D-HEADER", ""),
                        runs: page.runs.filter((run) => run.text !== "PRODUCT-D-HEADER"),
                      }
                    : page,
                ),
              }
            : evidence,
      });
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "required-repeating-content",
        runner: mock.runner,
        inspectPdf: mock.inspectPdf,
      });

      expect(report.outcome).toBe("failed");
      expect(report.failures).toContainEqual(
        expect.objectContaining({
          scenarioId: scenario?.id,
          message: expect.stringContaining(
            "physical page 1 is missing required text PRODUCT-D-HEADER",
          ),
        }),
      );
      await closeRetainedEvidenceLaboratory(report.labPath, temporaryRoot);
    });
  });

  test("requires every selected PNG to be complete and decodable", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const mock = createMockExecution({ skipPng: true });
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "missing-png",
        runner: mock.runner,
        inspectPdf: mock.inspectPdf,
      });

      expect(report.outcome).toBe("failed");
      expect(report.failures.some((failure) => failure.message.includes("is missing"))).toBe(true);
      await closeRetainedEvidenceLaboratory(report.labPath, temporaryRoot);

      const corrupt = createMockExecution({ corruptPng: true });
      const corruptReport = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "corrupt-png",
        runner: corrupt.runner,
        inspectPdf: corrupt.inspectPdf,
      });
      expect(corruptReport.outcome).toBe("failed");
      expect(
        corruptReport.failures.some((failure) => failure.message.includes("is not a valid PNG")),
      ).toBe(true);
      await closeRetainedEvidenceLaboratory(corruptReport.labPath, temporaryRoot);

      const truncated = createMockExecution();
      const truncatedReport = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "truncated-png",
        runner: async (request) => {
          const result = await truncated.runner(request);
          if (request.stage === "png-render") {
            await writeFile(`${request.argv.at(-1)}.png`, mockPng().subarray(0, 16));
          }
          return result;
        },
        inspectPdf: truncated.inspectPdf,
      });
      expect(truncatedReport.outcome).toBe("failed");
      expect(
        truncatedReport.failures.some((failure) => failure.message.includes("is not a valid PNG")),
      ).toBe(true);
      await closeRetainedEvidenceLaboratory(truncatedReport.labPath, temporaryRoot);

      const invalidDeflate = createMockExecution();
      const invalidDeflateReport = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "invalid-deflate-png",
        runner: async (request) => {
          const result = await invalidDeflate.runner(request);
          if (request.stage === "png-render") {
            await writeFile(`${request.argv.at(-1)}.png`, mockPng(Buffer.from([0xff])));
          }
          return result;
        },
        inspectPdf: invalidDeflate.inspectPdf,
      });
      expect(invalidDeflateReport.outcome).toBe("failed");
      expect(
        invalidDeflateReport.failures.some((failure) =>
          failure.message.includes("is not a valid PNG"),
        ),
      ).toBe(true);
      await closeRetainedEvidenceLaboratory(invalidDeflateReport.labPath, temporaryRoot);
    });
  });
});
