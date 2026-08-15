import { describe, expect, test } from "bun:test";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import {
  closeRetainedEvidenceLaboratory,
  inspectBodyHookCases,
  PAGE_NUMBER_RENDERER_HARNESS_DIGEST,
  publicEvidenceReport,
  runRendererEvidence,
} from "../../scripts/spikes/markdown-pdf-page-number-renderer-evidence";
import type {
  CommandRequest,
  CommandResult,
} from "../../scripts/spikes/markdown-pdf-page-number-renderer-evidence";
import {
  PAGE_NUMBER_AUTOMATED_EVIDENCE,
  PAGE_NUMBER_COUNTER_EXPERIMENTS,
  PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS,
  PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS,
  PAGE_NUMBER_RENDERER_SCENARIOS,
  WEASYPRINT_CANDIDATES,
} from "../fixtures/markdown-pdf/page-number-renderer-contract";
import type {
  ProjectRendererScenario,
  WeasyPrintCandidate,
} from "../fixtures/markdown-pdf/page-number-renderer-contract";
import { createMockExecution, pathHasSegment, withEvidenceRoot } from "./support";

describe("Markdown PDF renderer evidence orchestration", () => {
  test("keeps the tested catalog concrete while accepting future candidate identities", () => {
    expect(WEASYPRINT_CANDIDATES.map((candidate) => candidate.weasyPrintVersion)).toEqual([
      "65.1",
      "68.0",
      "69.0",
    ]);

    const futureCandidate: WeasyPrintCandidate = {
      id: "wp-70-0-canary",
      weasyPrintVersion: "70.0rc1",
      dependencies: { pydyf: "0.12.2", fontTools: "4.64.0" },
    };
    const compatibleFutureScenario: Pick<ProjectRendererScenario, "candidateIds"> = {
      candidateIds: [futureCandidate.id],
    };

    expect(compatibleFutureScenario.candidateIds).toEqual(["wp-70-0-canary"]);

    const onePassExperiment = PAGE_NUMBER_COUNTER_EXPERIMENTS[0];
    expect(onePassExperiment).toBeDefined();
    expect(onePassExperiment?.html.match(/<main class="document-body">/gu)).toHaveLength(1);
    expect(onePassExperiment?.html.match(/<section class="fixture-page">/gu)).toHaveLength(3);
    const bodyGroup = onePassExperiment?.html.match(
      /<main class="document-body">(?<body>[\s\S]*?)<\/main>/u,
    )?.groups?.body;
    expect(bodyGroup).toContain("PH14.5-BODY-1");
    expect(bodyGroup).toContain("PH14.5-BODY-2");
    expect(bodyGroup).toContain("PH14.5-BODY-3");
    expect(onePassExperiment?.html).toContain("PH14.5-COVER");
    expect(onePassExperiment?.html).toContain("PH14.5-TOC");
    expect(onePassExperiment?.css).toContain(".document-body { page: body; }");
    expect(onePassExperiment?.css).not.toContain(".body-page");

    expect(PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS.map((scenario) => scenario.id)).toEqual([
      "product-built-in-document-origin",
      "product-explicit-body-origin",
      "product-custom-stylesheet-precedence",
      "product-built-in-automatic-metadata-title",
    ]);
    for (const scenario of PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS.filter(
      (item) => item.id !== "product-custom-stylesheet-precedence",
    )) {
      expect(scenario.profile).toContain("{page}");
      expect(scenario.profile).toContain("{pages}");
      expect(scenario.profile).toContain("{pdfPage}");
      expect(scenario.profile).toContain("{pdfPages}");
    }
    expect(PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS[1]?.authoring).toEqual(
      expect.objectContaining({
        mode: "base-profile-only",
        baseProfile: expect.stringContaining("PROJECT-BASE-L{page}/{pages}-P{pdfPage}/{pdfPages}"),
      }),
    );

    const customTemplate = PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS[1];
    expect(customTemplate?.profile).toContain("pageBreak: none");
    expect(customTemplate?.profile).toContain("start: 5");
    expect(customTemplate?.expected.pages.map((page) => page.pageNumberLabels)).toEqual([
      [],
      ["PRODUCT-B-L5/9-P2/4"],
      ["PRODUCT-B-L7/9-P3/4"],
      ["PRODUCT-B-L9/9-P4/4"],
    ]);

    const insertedBlank = PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS[2];
    expect(insertedBlank?.profile).toContain("PRODUCT-C-P{pdfPage}/{pdfPages}");
    expect(insertedBlank?.profile).not.toContain("{page}");
    expect(insertedBlank?.profile).not.toContain("{pages}");
    expect(insertedBlank?.expected.pages.map((page) => page.role)).toEqual([
      "document-body",
      "inserted-blank",
      "document-body",
    ]);
    expect(insertedBlank?.expected.pages.map((page) => page.pageNumberLabels)).toEqual([
      ["PRODUCT-C-P1/3"],
      ["PRODUCT-C-P2/3"],
      ["PRODUCT-C-P3/3"],
    ]);

    const bodyVisibleDocumentOrigin = PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS[0];
    expect(bodyVisibleDocumentOrigin?.profile).toContain("scope: body");
    expect(bodyVisibleDocumentOrigin?.profile).toContain("countFrom: document");
    expect(bodyVisibleDocumentOrigin?.expected.pages.map((page) => page.pageNumberLabels)).toEqual([
      [],
      [],
      ["PRODUCT-A-L4/8-P3/5"],
      ["PRODUCT-A-L6/8-P4/5"],
      ["PRODUCT-A-L8/8-P5/5"],
    ]);
  });

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
      expect(report).not.toHaveProperty("schemaVersion");
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
      const materializedContract = JSON.parse(
        await readFile(join(report.labPath, "fixtures", "contract.json"), "utf8"),
      ) as Record<string, unknown>;
      expect(materializedContract).not.toHaveProperty("version");
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
});
