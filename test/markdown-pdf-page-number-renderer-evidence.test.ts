import { describe, expect, test } from "bun:test";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, normalize, sep } from "node:path";
import { deflateSync } from "node:zlib";

import {
  closeRetainedEvidenceLaboratory,
  inspectBodyHookCases,
  inspectPdf,
  initializeEvidenceLaboratory,
  PAGE_NUMBER_RENDERER_HARNESS_DIGEST,
  publicEvidenceReport,
  publicSafeText,
  runRendererEvidence,
  safeSubprocessEnvironment,
} from "../scripts/spikes/markdown-pdf-page-number-renderer-evidence";
import type {
  CommandRequest,
  CommandResult,
  PdfEvidence,
  PdfTextRunEvidence,
} from "../scripts/spikes/markdown-pdf-page-number-renderer-evidence";
import {
  PAGE_NUMBER_AUTOMATED_EVIDENCE,
  PAGE_NUMBER_LAB_MARKER_CONTENT,
  PAGE_NUMBER_LAB_MARKER_NAME,
  PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS,
  PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS,
  PAGE_NUMBER_RENDERER_SCENARIOS,
  WEASYPRINT_CANDIDATES,
} from "./fixtures/markdown-pdf/page-number-renderer-contract";
import type {
  ProductRendererScenario,
  ProjectRendererScenario,
  RendererContractScenario,
} from "./fixtures/markdown-pdf/page-number-renderer-contract";
import { withTempFixtureDir } from "./helpers/cli-test-utils";

interface MockExecutionOptions {
  fail?: (request: CommandRequest) => CommandResult | undefined;
  corruptPng?: boolean;
  skipPng?: boolean;
  inspect?: (path: string, expected: PdfEvidence) => PdfEvidence;
}

function expectedScenarioEvidence(
  scenario: RendererContractScenario | ProductRendererScenario | ProjectRendererScenario,
): PdfEvidence {
  const [widthMillimeters, heightMillimeters] = scenario.expected.sizeMillimeters;
  return {
    pageCount: scenario.expected.pageCount,
    pageLabelState: "default-physical",
    pages: scenario.expected.pages.map((page) => {
      const labelRuns = page.pageNumberLabels.map((label) =>
        evidenceRun(
          label,
          page.pageNumberRegion === "bottom-center" ? 60 : 110,
          page.pageNumberRegion === "top-right" ? 190 : 10,
          28,
          4,
        ),
      );
      return {
        text: [page.marker, ...page.pageNumberLabels].filter(Boolean).join(" "),
        runs: [evidenceRun(page.marker, 20, 100, 40, 5), ...labelRuns].filter(
          (run) => run.text.length > 0,
        ),
        widthMillimeters,
        heightMillimeters,
      };
    }),
  };
}

function evidenceRun(
  text: string,
  xMillimeters: number,
  yMillimeters: number,
  widthMillimeters: number,
  heightMillimeters: number,
): PdfTextRunEvidence {
  return { text, xMillimeters, yMillimeters, widthMillimeters, heightMillimeters };
}

function expectedActualLaunchEvidence(): PdfEvidence {
  return {
    pageCount: 3,
    pageLabelState: "default-physical",
    pages: [1, 2, 3].map((pageNumber) => ({
      text: `LAUNCH-PAGE-${pageNumber} LAUNCH-PN-${pageNumber}/3`,
      runs: [
        evidenceRun(`LAUNCH-PAGE-${pageNumber}`, 20, 100, 40, 5),
        evidenceRun(`LAUNCH-PN-${pageNumber}/3`, 60, 10, 28, 4),
      ],
      widthMillimeters: 148,
      heightMillimeters: 210,
    })),
  };
}

function pathHasSegment(path: string, segment: string): boolean {
  return normalize(path).split(sep).includes(segment);
}

function crc32(contents: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of contents) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), data.length + 8);
  return chunk;
}

function mockPng(imageData = deflateSync(Buffer.from([0, 0]))): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", imageData),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function createMockExecution(options: MockExecutionOptions = {}) {
  const requests: CommandRequest[] = [];
  const runner = async (request: CommandRequest): Promise<CommandResult> => {
    requests.push(request);
    const failed = options.fail?.(request);
    if (failed) return failed;

    if (request.stage === "png-render" && !options.skipPng) {
      const pngBase = request.argv.at(-1);
      if (!pngBase) throw new Error("mock png request has no output base");
      await writeFile(
        `${pngBase}.png`,
        options.corruptPng ? Buffer.from("not-a-png", "utf8") : mockPng(),
      );
    }
    if (request.stage === "environment-inspection") {
      const candidate = WEASYPRINT_CANDIDATES.find((item) =>
        request.argv.some((argument) => argument.includes(item.id)),
      );
      if (!candidate) throw new Error("mock candidate is missing");
      return {
        exitCode: 0,
        stdout: JSON.stringify({
          python: "3.13.7",
          weasyprint: candidate.weasyPrintVersion,
          pydyf: candidate.dependencies.pydyf,
          fontTools: candidate.dependencies.fontTools,
          pango: "1.56.4",
        }),
        stderr: "",
      };
    }
    if (request.stage === "doctor") {
      const candidate = WEASYPRINT_CANDIDATES.find((item) =>
        request.env?.PATH?.split(process.platform === "win32" ? ";" : ":")[0]?.includes(item.id),
      );
      return {
        exitCode: 0,
        stdout: JSON.stringify({
          tools: { weasyprint: { version: candidate?.weasyPrintVersion } },
        }),
        stderr: "",
      };
    }
    return { exitCode: 0, stdout: "", stderr: "" };
  };

  const inspectPdf = async (path: string): Promise<PdfEvidence> => {
    const scenario = [
      ...PAGE_NUMBER_RENDERER_SCENARIOS,
      ...PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS,
      ...PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS,
    ].find((item) => pathHasSegment(path, item.id));
    const expected = scenario ? expectedScenarioEvidence(scenario) : expectedActualLaunchEvidence();
    return options.inspect?.(path, expected) ?? expected;
  };
  return { runner, inspectPdf, requests };
}

function minimalPdf(text: string): Uint8Array {
  const stream = `BT /F1 12 Tf 36 540 Td (${text}) Tj ET\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 419.5276 595.2756] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
  ];
  let output = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(output));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(output, "ascii");
}

async function withEvidenceRoot(callback: (temporaryRoot: string) => Promise<void>): Promise<void> {
  await withTempFixtureDir("page-number-renderer-evidence", callback);
}

describe("Markdown PDF page-number renderer evidence harness", () => {
  test("keeps stable harness metadata and uses bounded timed command requests", async () => {
    expect(PAGE_NUMBER_RENDERER_HARNESS_DIGEST).toMatch(/^[a-f0-9]{64}$/u);
    await withEvidenceRoot(async (temporaryRoot) => {
      const mock = createMockExecution();
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "bounded-commands",
        runner: mock.runner,
        inspectPdf: mock.inspectPdf,
      });

      expect(report.harnessDigest).toBe(PAGE_NUMBER_RENDERER_HARNESS_DIGEST);
      expect(report.catalogDigest).toMatch(/^[a-f0-9]{64}$/u);
      expect(report.outcome).toBe("passed");
      expect(report.evidenceStatus).toBe("visual-review-required");
      expect(report.evidenceBoundary.automated).toEqual(PAGE_NUMBER_AUTOMATED_EVIDENCE);
      expect(report.evidenceBoundary.visualReviewRequired).toEqual(
        [...PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS, ...PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS].map(
          (scenario) => ({
            scenarioId: scenario.id,
            assertions: scenario.visualReviewRequired,
          }),
        ),
      );
      expect(report.temporaryImages.length).toBeGreaterThan(0);
      expect(report.visualConclusions).toEqual([]);
      expect(report.candidates[0]?.scenarios[0]?.extraction).toEqual(
        expect.objectContaining({
          pageCount: expect.any(Number),
          dimensionsMillimeters: expect.any(Array),
          labelsByPhysicalPage: expect.any(Array),
          pageLabelState: "default-physical",
        }),
      );
      expect(
        mock.requests
          .filter((request) => request.stage === "actual-launch")
          .every((request) => request.argv[0] === "node" && request.argv[0] !== process.execPath),
      ).toBe(true);
      const publicReportText = JSON.stringify(publicEvidenceReport(report));
      expect(publicReportText).not.toContain(report.labPath);
      for (const image of report.temporaryImages)
        expect(publicReportText).not.toContain(image.path);
      expect(mock.requests.length).toBeGreaterThan(0);
      expect(new Set(mock.requests.map((request) => request.timeoutMs))).toEqual(
        new Set([120_000]),
      );
      expect(new Set(mock.requests.map((request) => request.maximumOutputBytes))).toEqual(
        new Set([64 * 1024]),
      );
    });
  });

  test("pins every candidate setup and selects it for doctor and the actual launch", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const mock = createMockExecution();
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "candidate-commands",
        keep: true,
        pythonExecutable: "/shared/python3.11",
        nodeExecutable: "/explicit/node",
        runner: mock.runner,
        inspectPdf: mock.inspectPdf,
      });

      expect(report.outcome).toBe("passed");
      for (const candidate of WEASYPRINT_CANDIDATES) {
        const install = mock.requests.find(
          (request) =>
            request.stage === "dependency-install" && request.candidateId === candidate.id,
        );
        expect(install?.argv).toContain(`weasyprint==${candidate.weasyPrintVersion}`);
        expect(install?.argv).toContain(`pydyf==${candidate.dependencies.pydyf}`);
        expect(install?.argv).toContain(`fonttools[woff]==${candidate.dependencies.fontTools}`);
        const setup = mock.requests.find(
          (request) => request.stage === "setup" && request.candidateId === candidate.id,
        );
        expect(setup?.argv[0]).toBe("/shared/python3.11");

        const doctor = mock.requests.find(
          (request) => request.stage === "doctor" && request.candidateId === candidate.id,
        );
        const launch = mock.requests.find(
          (request) => request.stage === "actual-launch" && request.candidateId === candidate.id,
        );
        expect(doctor?.argv).toEqual(["/explicit/node", "dist/esm/bin.mjs", "doctor", "--json"]);
        expect(launch?.argv).toContain("to-pdf");
        expect(doctor?.env?.PATH).toContain(candidate.id);
        expect(launch?.env?.PATH).toContain(candidate.id);

        for (const scenario of PAGE_NUMBER_RENDERER_SCENARIOS) {
          const pngRequests = mock.requests.filter(
            (request) =>
              request.stage === "png-render" &&
              request.candidateId === candidate.id &&
              request.scenarioId === scenario.id,
          );
          expect(pngRequests).toHaveLength(scenario.expected.pngPages.length);
          for (const [index, request] of pngRequests.entries()) {
            const expectedPage = String(scenario.expected.pngPages[index]);
            expect(request.argv[request.argv.indexOf("-f") + 1]).toBe(expectedPage);
            expect(request.argv[request.argv.indexOf("-l") + 1]).toBe(expectedPage);
            expect(request.argv).toContain("-singlefile");
            expect(request.argv[0]).toBe("pdftoppm");
            expect(request.argv.at(-2)).toContain(`/${candidate.id}/${scenario.id}/output.pdf`);
            expect(request.argv.at(-1)).toContain(`/page-${expectedPage}`);
          }
        }

        for (const scenario of PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS) {
          const launchRequest = mock.requests.find(
            (request) =>
              request.stage === "actual-launch" &&
              request.candidateId === candidate.id &&
              request.scenarioId === scenario.id,
          );
          expect(launchRequest?.env?.PATH).toContain(candidate.id);
          expect(launchRequest?.argv[0]).toBe("/explicit/node");
          expect(launchRequest?.argv[1]).toBe("dist/esm/bin.mjs");
          expect(launchRequest?.argv.slice(2, 4)).toEqual(["md", "to-pdf"]);
          expect(launchRequest?.argv).toContain("--profile");
          expect(launchRequest?.argv).toContain("--output");
          expect(launchRequest?.argv.at(-1)).toBe("--overwrite");
          expect(launchRequest?.argv.includes("--template")).toBe(Boolean(scenario.template));
          expect(launchRequest?.argv.includes("--css")).toBe(Boolean(scenario.css));
          const inputPath = launchRequest?.argv[launchRequest.argv.indexOf("--input") + 1];
          const profilePath = launchRequest?.argv[launchRequest.argv.indexOf("--profile") + 1];
          const outputPath = launchRequest?.argv[launchRequest.argv.indexOf("--output") + 1];
          expect(outputPath).toBe(
            join(
              report.labPath,
              "results",
              candidate.id,
              "product-launches",
              scenario.id,
              "output.pdf",
            ),
          );
          expect(inputPath && (await readFile(inputPath, "utf8"))).toBe(scenario.markdown);
          expect(profilePath && (await readFile(profilePath, "utf8"))).toBe(scenario.profile);
          if (scenario.template) {
            const templatePath = launchRequest?.argv[launchRequest.argv.indexOf("--template") + 1];
            expect(templatePath && (await readFile(templatePath, "utf8"))).toBe(scenario.template);
          }
          if (scenario.css) {
            const cssPath = launchRequest?.argv[launchRequest.argv.indexOf("--css") + 1];
            expect(cssPath && (await readFile(cssPath, "utf8"))).toBe(scenario.css);
          }

          const pngRequests = mock.requests.filter(
            (request) =>
              request.stage === "png-render" &&
              request.candidateId === candidate.id &&
              request.scenarioId === scenario.id,
          );
          expect(pngRequests).toHaveLength(scenario.expected.pngPages.length);
          for (const [index, request] of pngRequests.entries()) {
            const expectedPage = String(scenario.expected.pngPages[index]);
            expect(request.argv[request.argv.indexOf("-f") + 1]).toBe(expectedPage);
            expect(request.argv[request.argv.indexOf("-l") + 1]).toBe(expectedPage);
            expect(request.argv).toContain("-singlefile");
            expect(request.argv.at(-2)).toContain(
              `/${candidate.id}/product-launches/${scenario.id}/output.pdf`,
            );
            expect(request.argv.at(-1)).toContain(`/page-${expectedPage}`);
          }
        }

        for (const scenario of PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS.filter((item) =>
          item.candidateIds.includes(candidate.id),
        )) {
          const authoringRequest = mock.requests.find(
            (request) =>
              request.stage === "actual-launch" &&
              request.candidateId === candidate.id &&
              request.scenarioId === `${scenario.id}:authoring`,
          );
          expect(authoringRequest?.argv.slice(0, 5)).toEqual([
            "/explicit/node",
            "dist/esm/bin.mjs",
            "md",
            "pdf-project",
            "codex",
          ]);
          expect(authoringRequest?.argv.includes("--base-profile")).toBe(
            scenario.authoring.mode === "base-profile-only",
          );
          expect(authoringRequest?.argv.includes("--cover-image")).toBe(
            scenario.authoring.mode === "cover-image-only",
          );
          expect(authoringRequest?.argv).toContain("--output");
          for (const launchMode of scenario.launchModes) {
            const launchRequest = mock.requests.find(
              (request) =>
                request.stage === "actual-launch" &&
                request.candidateId === candidate.id &&
                request.scenarioId === `${scenario.id}:${launchMode}`,
            );
            expect(launchRequest?.argv[0]).toBe("/explicit/node");
            expect(launchRequest?.argv).toContain("to-pdf");
            expect(launchRequest?.argv.includes("--bundle")).toBe(launchMode === "bundle");
            expect(launchRequest?.argv.includes("--profile")).toBe(launchMode === "explicit-roles");
          }
        }
      }
      await closeRetainedEvidenceLaboratory(report.labPath, temporaryRoot);
    });
  });

  test("fails candidate selection when PATH resolves a different WeasyPrint", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const mock = createMockExecution();
      const runner = (request: CommandRequest): Promise<CommandResult> => {
        if (request.stage === "doctor" && request.candidateId === "wp-68-0") {
          const selectedPath = request.env?.PATH ?? "";
          return mock.runner({
            ...request,
            env: { ...request.env, PATH: selectedPath.replace("wp-68-0", "wp-65-1") },
          });
        }
        return mock.runner(request);
      };
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "wrong-selected-path",
        runner,
        inspectPdf: mock.inspectPdf,
      });
      expect(report.outcome).toBe("inconclusive");
      expect(report.failures).toContainEqual(
        expect.objectContaining({
          candidateId: "wp-68-0",
          stage: "doctor",
          classification: "executable-launch-failure",
        }),
      );
      await closeRetainedEvidenceLaboratory(report.labPath, temporaryRoot);
    });
  });

  test("requires the selected candidate PATH for the actual CLI launch", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const mock = createMockExecution();
      const runner = (request: CommandRequest): Promise<CommandResult> => {
        if (request.stage === "actual-launch") {
          const selected = WEASYPRINT_CANDIDATES.find((candidate) =>
            request.env?.PATH?.split(process.platform === "win32" ? ";" : ":")[0]?.includes(
              candidate.id,
            ),
          );
          if (selected?.id !== request.candidateId) {
            return Promise.resolve({
              exitCode: 3,
              stdout: "",
              stderr: "actual launch selected a different candidate",
            });
          }
        }
        return mock.runner(request);
      };
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "actual-launch-selected-path",
        runner,
        inspectPdf: mock.inspectPdf,
      });
      expect(report.outcome).toBe("passed");

      const wrongPathReport = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "actual-launch-wrong-path",
        runner: (request) =>
          runner(
            request.stage === "actual-launch" && request.candidateId === "wp-68-0"
              ? {
                  ...request,
                  env: {
                    ...request.env,
                    PATH: (request.env?.PATH ?? "").replace("wp-68-0", "wp-65-1"),
                  },
                }
              : request,
          ),
        inspectPdf: mock.inspectPdf,
      });
      expect(wrongPathReport.outcome).toBe("inconclusive");
      expect(wrongPathReport.failures).toContainEqual(
        expect.objectContaining({
          candidateId: "wp-68-0",
          stage: "actual-launch",
          classification: "executable-launch-failure",
        }),
      );
      await closeRetainedEvidenceLaboratory(wrongPathReport.labPath, temporaryRoot);
    });
  });

  test("asserts exact contract and actual-launch page order, count, dimensions, and orientation", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const mock = createMockExecution();
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "page-assertions",
        keep: true,
        runner: mock.runner,
        inspectPdf: mock.inspectPdf,
      });

      expect(report.failures).toEqual([]);
      expect(report.bodyHooks).toEqual(await inspectBodyHookCases());
      expect(report.bodyHooks.every((bodyHook) => bodyHook.passed)).toBe(true);
      expect(report.candidates).toHaveLength(3);
      for (const candidate of report.candidates) {
        expect(candidate.scenarios.map(({ id, passed }) => ({ id, passed }))).toEqual(
          PAGE_NUMBER_RENDERER_SCENARIOS.map((scenario) => ({ id: scenario.id, passed: true })),
        );
        expect(candidate.productScenarios.map(({ id, passed }) => ({ id, passed }))).toEqual(
          PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS.map((scenario) => ({
            id: scenario.id,
            passed: true,
          })),
        );
        expect(
          candidate.projectScenarios.map(({ id, passed, extraction }) => ({
            id,
            passed,
            pageLabelState: extraction?.pageLabelState,
          })),
        ).toEqual(
          PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS.filter((scenario) =>
            scenario.candidateIds.includes(candidate.candidateId),
          ).flatMap((scenario) =>
            scenario.launchModes.map((mode) => ({
              id: `${scenario.id}:${mode}`,
              passed: true,
              pageLabelState: "default-physical",
            })),
          ),
        );
        expect(candidate.doctorPassed).toBe(true);
        expect(candidate.actualLaunchPassed).toBe(true);
      }
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

  test("classifies Project extraction failures and bundle-explicit mismatches", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const project = PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS[1];
      expect(project).toBeDefined();
      const failed = createMockExecution({
        inspect: (path, expected) =>
          project && pathHasSegment(path, project.id) && pathHasSegment(path, "bundle")
            ? { ...expected, pageCount: expected.pageCount + 1 }
            : expected,
      });
      const failedReport = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "project-extraction-failure",
        runner: failed.runner,
        inspectPdf: failed.inspectPdf,
      });
      expect(failedReport.outcome).toBe("failed");
      expect(failedReport.failures).toContainEqual(
        expect.objectContaining({
          classification: "contract-failure",
          scenarioId: `${project?.id}:bundle`,
        }),
      );
      await closeRetainedEvidenceLaboratory(failedReport.labPath, temporaryRoot);

      const mismatch = createMockExecution({
        inspect: (path, expected) =>
          project && pathHasSegment(path, project.id) && pathHasSegment(path, "explicit-roles")
            ? {
                ...expected,
                pages: expected.pages.map((page) => ({
                  ...page,
                  widthMillimeters: page.widthMillimeters + 0.1,
                })),
              }
            : expected,
      });
      const mismatchReport = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "project-equivalence-mismatch",
        runner: mismatch.runner,
        inspectPdf: mismatch.inspectPdf,
      });
      expect(mismatchReport.outcome).toBe("failed");
      expect(mismatchReport.failures).toContainEqual(
        expect.objectContaining({
          classification: "contract-failure",
          scenarioId: project?.id,
          message: "Project bundle and explicit-role extraction summaries differ.",
        }),
      );
      await closeRetainedEvidenceLaboratory(mismatchReport.labPath, temporaryRoot);
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

  test("keeps the optional repagination sentinel informative rather than gating", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const sentinel = PAGE_NUMBER_RENDERER_SCENARIOS.find((scenario) => !scenario.required);
      expect(sentinel).toBeDefined();
      const mock = createMockExecution({
        inspect: (path, expected) =>
          sentinel && pathHasSegment(path, sentinel.id)
            ? {
                ...expected,
                pages: expected.pages.map((page, index) =>
                  index === 0 ? { ...page, text: "REPAGINATION-SENTINEL-MISMATCH" } : page,
                ),
              }
            : expected,
      });
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "informative-sentinel",
        runner: mock.runner,
        inspectPdf: mock.inspectPdf,
      });

      expect(report.outcome).toBe("passed");
      expect(report.failures).toContainEqual(
        expect.objectContaining({ scenarioId: sentinel?.id, classification: "contract-failure" }),
      );
      expect(
        report.candidates.every(
          (candidate) =>
            candidate.scenarios.find((scenario) => scenario.id === sentinel?.id)?.passed === false,
        ),
      ).toBe(true);
      expect(report.retained).toBe(false);
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

  test("classifies actual-launch order mismatches separately", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const mock = createMockExecution({
        inspect: (path, expected) => {
          if (!path.includes("actual-launch")) return expected;
          const pages = [...expected.pages];
          pages[1] = { ...pages[1]!, text: "LAUNCH-PAGE-3 LAUNCH-PN-3/3" };
          return { ...expected, pages };
        },
      });
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "launch-order-failure",
        runner: mock.runner,
        inspectPdf: mock.inspectPdf,
      });

      expect(report.outcome).toBe("failed");
      expect(
        report.failures.some(
          (failure) =>
            failure.stage === "actual-launch-extraction" &&
            failure.classification === "contract-failure",
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

  test("keeps dependency, native-library, font, and executable failures stage-aware", async () => {
    const cases = [
      {
        stage: "dependency-install" as const,
        stderr: "resolution failed",
        classification: "dependency-failure",
      },
      {
        stage: "contract-render" as const,
        stderr: "Pango native library unavailable",
        classification: "native-library-failure",
      },
      {
        stage: "contract-render" as const,
        stderr: "fontconfig error: no fonts",
        classification: "font-discovery-failure",
      },
      {
        stage: "doctor" as const,
        stderr: "spawn failed",
        classification: "executable-launch-failure",
      },
    ];
    for (const [index, failureCase] of cases.entries()) {
      await withEvidenceRoot(async (temporaryRoot) => {
        let failed = false;
        const mock = createMockExecution({
          fail: (request) => {
            if (!failed && request.stage === failureCase.stage) {
              failed = true;
              return { exitCode: 9, stdout: "", stderr: failureCase.stderr };
            }
            return undefined;
          },
        });
        const report = await runRendererEvidence({
          temporaryRoot,
          uniqueId: `stage-failure-${index}`,
          runner: mock.runner,
          inspectPdf: mock.inspectPdf,
        });

        expect(report.outcome).toBe("inconclusive");
        expect(
          report.failures.some((failure) => failure.classification === failureCase.classification),
        ).toBe(true);
        await closeRetainedEvidenceLaboratory(report.labPath, temporaryRoot);
      });
    }
  });

  test("treats an effective pin or doctor-selection mismatch as environment evidence", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const base = createMockExecution();
      const runner = async (request: CommandRequest): Promise<CommandResult> => {
        if (request.stage === "environment-inspection" && request.candidateId === "wp-65-1") {
          return {
            exitCode: 0,
            stdout: JSON.stringify({
              python: "3.13.7",
              weasyprint: "65.1",
              pydyf: "unexpected",
              fontTools: "4.63.0",
              pango: "1.56.4",
            }),
            stderr: "",
          };
        }
        if (request.stage === "doctor" && request.candidateId === "wp-68-0") {
          return {
            exitCode: 0,
            stdout: JSON.stringify({ tools: { weasyprint: { version: "69.0" } } }),
            stderr: "",
          };
        }
        return base.runner(request);
      };
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "effective-version-mismatch",
        runner,
        inspectPdf: base.inspectPdf,
      });

      expect(report.outcome).toBe("inconclusive");
      expect(report.failures).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            candidateId: "wp-65-1",
            stage: "environment-inspection",
            classification: "dependency-failure",
          }),
          expect.objectContaining({
            candidateId: "wp-68-0",
            stage: "doctor",
            classification: "executable-launch-failure",
          }),
        ]),
      );
      await closeRetainedEvidenceLaboratory(report.labPath, temporaryRoot);
    });
  });

  test("does not convert a failed PNG executable into a renderer-contract failure", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      let failed = false;
      const mock = createMockExecution({
        fail: (request) => {
          if (!failed && request.stage === "png-render") {
            failed = true;
            return { exitCode: 4, stdout: "", stderr: "pdftoppm launch failed" };
          }
          return undefined;
        },
      });
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "png-executable-failure",
        runner: mock.runner,
        inspectPdf: mock.inspectPdf,
      });

      expect(report.outcome).toBe("inconclusive");
      expect(report.failures.some((failure) => failure.stage === "png-render")).toBe(true);
      expect(
        report.candidates.some((candidate) =>
          candidate.scenarios.some((scenario) => scenario.passed === false),
        ),
      ).toBe(true);
      expect(
        report.failures.some(
          (failure) =>
            failure.stage === "contract-extraction" &&
            failure.message.includes("page-1.png is missing"),
        ),
      ).toBe(false);
      await closeRetainedEvidenceLaboratory(report.labPath, temporaryRoot);
    });
  });

  test("classifies a rejected command runner and retains its laboratory", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const mock = createMockExecution();
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "runner-rejection",
        runner: (request) =>
          request.stage === "setup" && request.candidateId === "wp-65-1"
            ? Promise.reject(new Error("synthetic runner rejection"))
            : mock.runner(request),
        inspectPdf: mock.inspectPdf,
      });

      expect(report.outcome).toBe("inconclusive");
      expect(report.retained).toBe(true);
      expect(report.failures).toContainEqual(
        expect.objectContaining({
          stage: "setup",
          classification: "setup-failure",
          candidateId: "wp-65-1",
        }),
      );
      expect((await stat(report.labPath)).isDirectory()).toBe(true);
      await closeRetainedEvidenceLaboratory(report.labPath, temporaryRoot);
    });
  });

  test("cleans the laboratory after an unexpected orchestration error", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const mock = createMockExecution();
      await expect(
        runRendererEvidence({
          temporaryRoot,
          uniqueId: "materialization-error-cleanup",
          runner: mock.runner,
          inspectPdf: mock.inspectPdf,
          materializeContract: async () => {
            throw new Error("synthetic materialization failure");
          },
        }),
      ).rejects.toThrow("synthetic materialization failure");
      expect(
        (await readdir(temporaryRoot)).filter((entry) =>
          entry.includes("materialization-error-cleanup"),
        ),
      ).toEqual([]);
    });
  });

  test("treats timeout and bounded-output violations as inconclusive launch failures", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const mock = createMockExecution({
        fail: (request) =>
          request.stage === "doctor" && request.candidateId === "wp-65-1"
            ? {
                exitCode: null,
                stdout: "x".repeat(65_536),
                stderr: "",
                timedOut: true,
                outputTruncated: true,
              }
            : undefined,
      });
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "bounded-output-failure",
        runner: mock.runner,
        inspectPdf: mock.inspectPdf,
      });

      expect(report.outcome).toBe("inconclusive");
      expect(report.failures).toContainEqual(
        expect.objectContaining({
          stage: "doctor",
          classification: "executable-launch-failure",
          message: expect.stringContaining("timed out"),
        }),
      );
      await closeRetainedEvidenceLaboratory(report.labPath, temporaryRoot);
    });
  });

  test("rolls back a partially initialized laboratory when marker creation fails", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      expect(
        initializeEvidenceLaboratory({
          temporaryRoot,
          uniqueId: "marker-write-failure",
          initializeMarker: async () => {
            throw new Error("synthetic marker failure");
          },
        }),
      ).rejects.toThrow("synthetic marker failure");
      expect(await readdir(temporaryRoot)).toEqual([]);
    });
  });

  test("cleans successful runs automatically and honors explicit keep", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const automatic = createMockExecution();
      const cleaned = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "automatic-cleanup",
        runner: automatic.runner,
        inspectPdf: automatic.inspectPdf,
      });
      expect(cleaned.outcome).toBe("passed");
      expect(cleaned.retained).toBe(false);
      expect(stat(cleaned.labPath)).rejects.toThrow();

      const explicit = createMockExecution();
      const kept = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "explicit-keep",
        keep: true,
        runner: explicit.runner,
        inspectPdf: explicit.inspectPdf,
      });
      expect(kept.outcome).toBe("passed");
      expect(kept.retained).toBe(true);
      expect((await stat(kept.labPath)).isDirectory()).toBe(true);
      await closeRetainedEvidenceLaboratory(kept.labPath, temporaryRoot);
      expect(stat(kept.labPath)).rejects.toThrow();
    });
  });

  test("closeout requires the exact direct temp child and ownership marker", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      await expect(closeRetainedEvidenceLaboratory(temporaryRoot, temporaryRoot)).rejects.toThrow(
        "unsafe",
      );

      const unmarked = join(temporaryRoot, "cdx-chores-weasyprint-matrix-unmarked");
      await mkdir(unmarked);
      await expect(closeRetainedEvidenceLaboratory(unmarked, temporaryRoot)).rejects.toThrow(
        "without its marker",
      );

      const foreign = join(temporaryRoot, "cdx-chores-weasyprint-matrix-foreign");
      await mkdir(foreign);
      await writeFile(join(foreign, PAGE_NUMBER_LAB_MARKER_NAME), "foreign\n", "utf8");
      await expect(closeRetainedEvidenceLaboratory(foreign, temporaryRoot)).rejects.toThrow(
        "foreign marker",
      );

      const broader = join(temporaryRoot, "unrelated-owned-directory");
      await mkdir(broader);
      await writeFile(
        join(broader, PAGE_NUMBER_LAB_MARKER_NAME),
        PAGE_NUMBER_LAB_MARKER_CONTENT,
        "utf8",
      );
      await expect(closeRetainedEvidenceLaboratory(broader, temporaryRoot)).rejects.toThrow(
        "unsafe",
      );
    });
  });

  test("redacts Unix and Windows paths from public output and omits the lab path", async () => {
    expect(publicSafeText("failed at /Users/alice/private/report.json")).toBe(
      "failed at [redacted-path]",
    );
    expect(publicSafeText("failed at C:\\Users\\alice\\private\\report.json")).toBe(
      "failed at [redacted-path]",
    );
    expect(publicSafeText("failed at /workspace/build/report.json")).toBe(
      "failed at [redacted-path]",
    );
    expect(publicSafeText("failed at E:/build/private/report.json")).toBe(
      "failed at [redacted-path]",
    );
    expect(publicSafeText("see https://example.test/guidance")).toBe(
      "see https://example.test/guidance",
    );
    const publicReport = publicEvidenceReport({
      schemaVersion: 3,
      catalogDigest: "a".repeat(64),
      harnessDigest: PAGE_NUMBER_RENDERER_HARNESS_DIGEST,
      outcome: "inconclusive",
      evidenceStatus: "visual-review-required",
      retained: true,
      labPath: "/private/tmp/cdx-chores-weasyprint-matrix-private",
      bodyHooks: [],
      candidates: [],
      failures: [
        {
          stage: "setup",
          classification: "setup-failure",
          message: "failure at /home/alice/lab and D:\\private\\lab",
        },
      ],
      temporaryImages: [
        {
          candidateId: "wp-65-1",
          scenarioId: "private-image",
          physicalPage: 1,
          path: "/home/alice/lab/page-1.png",
        },
      ],
      visualConclusions: [
        {
          candidateId: "wp-65-1",
          scenarioId: "private-image",
          conclusion: "reviewed at /home/alice/lab/page-1.png",
        },
      ],
      evidenceBoundary: {
        automated: [],
        visualReviewRequired: [],
      },
    });
    expect(publicReport).not.toHaveProperty("labPath");
    expect(publicReport).not.toHaveProperty("temporaryImages");
    expect(publicReport.retained).toBe(false);
    expect(JSON.stringify(publicReport)).not.toContain("alice");
    expect(JSON.stringify(publicReport)).not.toContain("D:\\\\private");
    expect(publicReport.visualConclusions[0]?.conclusion).toBe("reviewed at [redacted-path]");
  });

  test("uses an allowlisted subprocess environment without ambient credentials", () => {
    const secretKey = "CDX_PAGE_NUMBER_TEST_SECRET";
    process.env[secretKey] = "must-not-leak";
    try {
      const environment = safeSubprocessEnvironment("/candidate/bin");
      expect(environment[secretKey]).toBeUndefined();
      expect(environment.PATH?.split(process.platform === "win32" ? ";" : ":")[0]).toBe(
        "/candidate/bin",
      );
      expect(environment.PIP_NO_INPUT).toBe("1");
      expect(environment.PIP_CONFIG_FILE).toBeTruthy();
    } finally {
      delete process.env[secretKey];
    }
  });

  test("writes a retained raw report only inside the owned laboratory", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const mock = createMockExecution();
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "raw-report",
        keep: true,
        runner: mock.runner,
        inspectPdf: mock.inspectPdf,
      });
      const rawReport = JSON.parse(
        await readFile(join(report.labPath, "results", "renderer-evidence-report.json"), "utf8"),
      ) as { catalogDigest: string; harnessDigest: string; labPath: string };
      expect(rawReport.catalogDigest).toBe(report.catalogDigest);
      expect(rawReport.harnessDigest).toBe(PAGE_NUMBER_RENDERER_HARNESS_DIGEST);
      expect(rawReport.labPath).toBe(report.labPath);
      await closeRetainedEvidenceLaboratory(report.labPath, temporaryRoot);
    });
  });
});
