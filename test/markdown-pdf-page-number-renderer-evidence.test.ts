import { describe, expect, test } from "bun:test";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

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
} from "../scripts/spikes/markdown-pdf-page-number-renderer-evidence";
import {
  PAGE_NUMBER_LAB_MARKER_CONTENT,
  PAGE_NUMBER_LAB_MARKER_NAME,
  PAGE_NUMBER_RENDERER_SCENARIOS,
  WEASYPRINT_CANDIDATES,
} from "./fixtures/markdown-pdf/page-number-renderer-contract";
import type { RendererContractScenario } from "./fixtures/markdown-pdf/page-number-renderer-contract";
import { withTempFixtureDir } from "./helpers/cli-test-utils";

interface MockExecutionOptions {
  fail?: (request: CommandRequest) => CommandResult | undefined;
  skipPng?: boolean;
  inspect?: (path: string, expected: PdfEvidence) => PdfEvidence;
}

function expectedScenarioEvidence(scenario: RendererContractScenario): PdfEvidence {
  const [widthMillimeters, heightMillimeters] = scenario.expected.sizeMillimeters;
  return {
    pageCount: scenario.expected.pageCount,
    pages: scenario.expected.pages.map((page) => ({
      text: [page.marker, ...page.pageNumberLabels].filter(Boolean).join(" "),
      widthMillimeters,
      heightMillimeters,
    })),
  };
}

function expectedActualLaunchEvidence(): PdfEvidence {
  return {
    pageCount: 3,
    pages: [1, 2, 3].map((pageNumber) => ({
      text: `LAUNCH-PAGE-${pageNumber} LAUNCH-PN-${pageNumber}/3`,
      widthMillimeters: 148,
      heightMillimeters: 210,
    })),
  };
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
      await writeFile(`${pngBase}.png`, "png-evidence", "utf8");
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
    const scenario = PAGE_NUMBER_RENDERER_SCENARIOS.find((item) => path.includes(`/${item.id}/`));
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

        const doctor = mock.requests.find(
          (request) => request.stage === "doctor" && request.candidateId === candidate.id,
        );
        const launch = mock.requests.find(
          (request) => request.stage === "actual-launch" && request.candidateId === candidate.id,
        );
        expect(doctor?.argv.slice(-2)).toEqual(["doctor", "--json"]);
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
            expect(request.argv.at(-2)).toContain(`/${candidate.id}/${scenario.id}/output.pdf`);
            expect(request.argv.at(-1)).toContain(`/page-${expectedPage}`);
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
        expect(candidate.scenarios).toEqual(
          PAGE_NUMBER_RENDERER_SCENARIOS.map((scenario) => ({ id: scenario.id, passed: true })),
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
      expect(evidence.pages).toHaveLength(1);
      expect(evidence.pages[0]?.text).toContain("PDF-INSPECTOR-EVIDENCE");
      expect(evidence.pages[0]?.widthMillimeters).toBeCloseTo(148, 1);
      expect(evidence.pages[0]?.heightMillimeters).toBeCloseTo(210, 1);
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

  test("requires every selected PNG to exist and be non-empty", async () => {
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
            return { exitCode: 4, stdout: "", stderr: "pdftocairo launch failed" };
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
        report.failures.some(
          (failure) =>
            failure.stage === "contract-extraction" &&
            failure.message.includes("page-1.png is missing"),
        ),
      ).toBe(false);
      await closeRetainedEvidenceLaboratory(report.labPath, temporaryRoot);
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
      schemaVersion: 1,
      catalogDigest: "a".repeat(64),
      harnessDigest: PAGE_NUMBER_RENDERER_HARNESS_DIGEST,
      outcome: "inconclusive",
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
    });
    expect(publicReport).not.toHaveProperty("labPath");
    expect(publicReport.retained).toBe(false);
    expect(JSON.stringify(publicReport)).not.toContain("alice");
    expect(JSON.stringify(publicReport)).not.toContain("D:\\\\private");
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
