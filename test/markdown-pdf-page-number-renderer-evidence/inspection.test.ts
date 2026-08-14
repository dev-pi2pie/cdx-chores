import { describe, expect, test } from "bun:test";
import { stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  closeRetainedEvidenceLaboratory,
  inspectPdf,
  runRendererEvidence,
} from "../../scripts/spikes/markdown-pdf-page-number-renderer-evidence";
import type { PdfEvidence } from "../../scripts/spikes/markdown-pdf-page-number-renderer-evidence";
import { PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS } from "../fixtures/markdown-pdf/page-number-renderer-contract";
import {
  createMockExecution,
  evidenceRun,
  minimalPdf,
  mockPng,
  pathHasSegment,
  withEvidenceRoot,
} from "./support";

describe("Markdown PDF renderer evidence inspection and validation", () => {
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
    const label = selected?.expected.pages[1]?.pageNumberLabels[0] ?? "PRODUCT-B-0/4";
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
      const label = "PRODUCT-B-0/4";
      const mock = createMockExecution({
        inspect: (path, evidence) =>
          pathHasSegment(path, scenarioId)
            ? {
                ...evidence,
                pages: evidence.pages.map((page, pageIndex) =>
                  pageIndex === 1
                    ? {
                        ...page,
                        text: page.text.replace(label, "PRODUCT-B- 0/4"),
                        runs: page.runs.flatMap((run) =>
                          run.text === label
                            ? [
                                evidenceRun("PRODUCT-B-", 110, 190, 18, 4),
                                evidenceRun("0/4", 128, 190, 10, 4),
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
