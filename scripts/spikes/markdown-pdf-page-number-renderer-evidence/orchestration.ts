import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  materializePageNumberRendererContract,
  PAGE_NUMBER_AUTOMATED_EVIDENCE,
  PAGE_NUMBER_COUNTER_EXPERIMENTS,
  PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS,
  PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS,
  PAGE_NUMBER_RENDERER_SCENARIOS,
  WEASYPRINT_CANDIDATES,
} from "../../../test/fixtures/markdown-pdf/page-number-renderer-contract";
import type {
  ProductRendererScenario,
  ProjectRendererScenario,
  RendererContractScenario,
} from "../../../test/fixtures/markdown-pdf/page-number-renderer-contract";
import type {
  CandidateEvidence,
  CounterExperimentEvidence,
  EvidenceFailure,
  PdfExtractionSummary,
  RendererEvidenceReport,
  RunRendererEvidenceOptions,
  ScenarioEvidence,
  TemporaryImageEvidence,
} from "./contract";
import { PAGE_NUMBER_RENDERER_HARNESS_DIGEST, reportName } from "./contract";
import { closeRetainedEvidenceLaboratory, initializeEvidenceLaboratory } from "./laboratory";
import {
  actualLaunchExpected,
  assessOnePassCounterEvidence,
  extractionSummary,
  inspectBodyHookCases,
  inspectPdf,
  publicSafeText,
  validateActualLaunch,
  validatePdfEvidence,
} from "./pdf";
import { contractFailure, runRenderedScenarioEvidence } from "./scenario";
import {
  candidateEnvironmentScript,
  commandRequest,
  defaultCommandRunner,
  environmentExecutable,
  runChecked,
  safeSubprocessEnvironment,
} from "./subprocess";

export async function runRendererEvidence(
  options: RunRendererEvidenceOptions = {},
): Promise<RendererEvidenceReport> {
  const labRoot = await initializeEvidenceLaboratory(options);
  try {
    return await runRendererEvidenceInLaboratory(options, labRoot);
  } catch (error) {
    if (options.keep !== true)
      await closeRetainedEvidenceLaboratory(labRoot, options.temporaryRoot);
    throw error;
  }
}

async function runRendererEvidenceInLaboratory(
  options: RunRendererEvidenceOptions,
  labRoot: string,
): Promise<RendererEvidenceReport> {
  const runner = options.runner ?? defaultCommandRunner;
  const pdfInspector = options.inspectPdf ?? inspectPdf;
  const failures: EvidenceFailure[] = [];
  const candidates: CandidateEvidence[] = [];
  const temporaryImages: TemporaryImageEvidence[] = [];
  const contract = await (options.materializeContract ?? materializePageNumberRendererContract)(
    labRoot,
  );
  const bodyHooks = await inspectBodyHookCases(contract.bodyHookPaths);
  for (const bodyHook of bodyHooks)
    if (!bodyHook.passed)
      failures.push(
        contractFailure(
          "contract-extraction",
          `Body-hook case ${bodyHook.id} resolved to ${bodyHook.actual}, expected ${bodyHook.expected}.`,
          undefined,
        ),
      );
  await mkdir(join(labRoot, "results"));

  for (const candidate of WEASYPRINT_CANDIDATES) {
    const environmentDirectory = join(labRoot, candidate.id);
    const python = environmentExecutable(environmentDirectory, "python");
    const weasyprint = environmentExecutable(environmentDirectory, "weasyprint");
    const candidateResult: CandidateEvidence = {
      candidateId: candidate.id,
      weasyPrintVersion: candidate.weasyPrintVersion,
      scenarios: [],
      counterExperiments: [],
      doctorPassed: false,
      actualLaunchPassed: false,
      productScenarios: [],
      projectScenarios: [],
    };
    candidates.push(candidateResult);
    const commands = [
      commandRequest(
        "setup",
        [options.pythonExecutable ?? "python3", "-m", "venv", environmentDirectory],
        { candidateId: candidate.id },
      ),
      commandRequest(
        "dependency-install",
        [
          python,
          "-m",
          "pip",
          "install",
          `weasyprint==${candidate.weasyPrintVersion}`,
          `pydyf==${candidate.dependencies.pydyf}`,
          `fonttools[woff]==${candidate.dependencies.fontTools}`,
        ],
        { candidateId: candidate.id },
      ),
      commandRequest("environment-inspection", [python, "-c", candidateEnvironmentScript()], {
        candidateId: candidate.id,
      }),
    ];
    let candidateBlocked = false;
    for (const request of commands) {
      const execution = await runChecked(runner, request);
      if (execution.failure) {
        failures.push(execution.failure);
        candidateBlocked = true;
        break;
      }
      if (request.stage === "environment-inspection") {
        try {
          const environment = JSON.parse(execution.result.stdout) as Record<string, string>;
          candidateResult.environment = environment;
          if (
            environment.weasyprint !== candidate.weasyPrintVersion ||
            environment.pydyf !== candidate.dependencies.pydyf ||
            environment.fontTools !== candidate.dependencies.fontTools
          ) {
            failures.push({
              stage: "environment-inspection",
              classification: "dependency-failure",
              candidateId: candidate.id,
              message: "Effective dependency versions differ from the pinned candidate contract.",
            });
            candidateBlocked = true;
          }
        } catch {
          failures.push({
            stage: "environment-inspection",
            classification: "dependency-failure",
            candidateId: candidate.id,
            message: "Candidate environment returned invalid JSON.",
          });
          candidateBlocked = true;
        }
      }
    }
    if (candidateBlocked) continue;

    for (const scenario of PAGE_NUMBER_RENDERER_SCENARIOS) {
      const scenarioDirectory = contract.scenarioDirectories[scenario.id];
      if (!scenarioDirectory) throw new Error(`Missing materialized scenario ${scenario.id}.`);
      const scenarioEvidence: ScenarioEvidence = { id: scenario.id, passed: false };
      candidateResult.scenarios.push(scenarioEvidence);
      scenarioEvidence.passed = await runRenderedScenarioEvidence({
        runner,
        pdfInspector,
        failures,
        candidateId: candidate.id,
        scenarioId: scenario.id,
        outputDirectory: join(labRoot, "results", candidate.id, scenario.id),
        renderStage: "contract-render",
        extractionStage: "contract-extraction",
        renderArgv: (pdfPath) => [weasyprint, join(scenarioDirectory, "input.html"), pdfPath],
        pngPages: scenario.expected.pngPages,
        validate: (evidence) => validatePdfEvidence(scenario, evidence),
        summarize: (evidence) => extractionSummary(evidence, scenario.expected.pages),
        temporaryImages,
        onExtraction: (summary) => {
          scenarioEvidence.extraction = summary;
        },
      });
    }

    for (const scenario of PAGE_NUMBER_COUNTER_EXPERIMENTS) {
      const scenarioDirectory = contract.counterExperimentDirectories[scenario.id];
      if (!scenarioDirectory)
        throw new Error(`Missing materialized counter experiment ${scenario.id}.`);
      const scenarioEvidence: CounterExperimentEvidence = {
        id: scenario.id,
        passed: false,
        mechanism: scenario.mechanism,
      };
      candidateResult.counterExperiments.push(scenarioEvidence);
      let experimentExtraction: PdfExtractionSummary | undefined;
      scenarioEvidence.passed = await runRenderedScenarioEvidence({
        runner,
        pdfInspector,
        failures,
        candidateId: candidate.id,
        scenarioId: scenario.id,
        outputDirectory: join(labRoot, "results", candidate.id, "counter-experiments", scenario.id),
        renderStage: "contract-render",
        extractionStage: "contract-extraction",
        renderArgv: (pdfPath) => [weasyprint, join(scenarioDirectory, "input.html"), pdfPath],
        pngPages: scenario.expected.pngPages,
        validate: (evidence) => validatePdfEvidence(scenario, evidence),
        summarize: (evidence) =>
          extractionSummary(evidence, scenario.expected.pages, scenario.counterEvidencePattern),
        temporaryImages,
        onExtraction: (summary) => {
          scenarioEvidence.extraction = summary;
          experimentExtraction = summary;
        },
      });
      if (experimentExtraction)
        scenarioEvidence.assessment = assessOnePassCounterEvidence(
          experimentExtraction,
          scenario.expected.pages,
          scenarioEvidence.passed,
        );
    }

    const selectedEnvironment = safeSubprocessEnvironment(dirname(weasyprint));
    const doctor = await runChecked(
      runner,
      commandRequest(
        "doctor",
        [options.nodeExecutable ?? "node", "dist/esm/bin.mjs", "doctor", "--json"],
        { candidateId: candidate.id, env: selectedEnvironment },
      ),
    );
    if (doctor.failure) failures.push(doctor.failure);
    else {
      try {
        const doctorPayload = JSON.parse(doctor.result.stdout) as {
          tools?: { weasyprint?: { version?: string } };
        };
        candidateResult.doctorPassed =
          doctorPayload.tools?.weasyprint?.version === candidate.weasyPrintVersion;
        if (!candidateResult.doctorPassed)
          failures.push({
            stage: "doctor",
            classification: "executable-launch-failure",
            candidateId: candidate.id,
            message: "doctor --json did not report the selected candidate version.",
          });
      } catch {
        failures.push({
          stage: "doctor",
          classification: "executable-launch-failure",
          candidateId: candidate.id,
          message: "doctor --json returned invalid JSON.",
        });
      }
    }

    const launchDirectory = join(labRoot, "results", candidate.id, "actual-launch");
    await mkdir(launchDirectory, { recursive: true });
    const launchPdf = join(launchDirectory, "output.pdf");
    const launched = await runChecked(
      runner,
      commandRequest(
        "actual-launch",
        [
          options.nodeExecutable ?? "node",
          "dist/esm/bin.mjs",
          "md",
          "to-pdf",
          "--input",
          contract.launch.markdownPath,
          "--profile",
          contract.launch.profilePath,
          "--output",
          launchPdf,
          "--overwrite",
        ],
        { candidateId: candidate.id, env: selectedEnvironment },
      ),
    );
    if (launched.failure) failures.push(launched.failure);
    else {
      try {
        const evidence = await pdfInspector(launchPdf);
        const mismatches = validateActualLaunch(evidence);
        candidateResult.actualLaunchExtraction = extractionSummary(
          evidence,
          actualLaunchExpected.pages.map((page) => ({
            role: page.role,
            marker: page.marker,
            pageNumberLabels: [page.label],
          })),
        );
        candidateResult.actualLaunchPassed = mismatches.length === 0;
        if (mismatches.length > 0)
          failures.push(
            contractFailure("actual-launch-extraction", mismatches.join("; "), candidate.id),
          );
      } catch (error) {
        failures.push({
          stage: "actual-launch-extraction",
          classification: "setup-failure",
          candidateId: candidate.id,
          message: publicSafeText(error instanceof Error ? error.message : String(error)),
        });
      }
    }

    for (const scenario of PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS) {
      const productLaunch = contract.productLaunches[scenario.id];
      if (!productLaunch) throw new Error(`Missing materialized product launch ${scenario.id}.`);
      const scenarioEvidence: ScenarioEvidence = { id: scenario.id, passed: false };
      candidateResult.productScenarios.push(scenarioEvidence);
      scenarioEvidence.passed = await runRenderedScenarioEvidence({
        runner,
        pdfInspector,
        failures,
        candidateId: candidate.id,
        scenarioId: scenario.id,
        outputDirectory: join(labRoot, "results", candidate.id, "product-launches", scenario.id),
        renderStage: "actual-launch",
        extractionStage: "actual-launch-extraction",
        renderArgv: (productPdf) => [
          options.nodeExecutable ?? "node",
          "dist/esm/bin.mjs",
          "md",
          "to-pdf",
          "--input",
          productLaunch.markdownPath,
          "--profile",
          productLaunch.profilePath,
          ...(productLaunch.templatePath ? ["--template", productLaunch.templatePath] : []),
          ...(productLaunch.cssPath ? ["--css", productLaunch.cssPath] : []),
          "--output",
          productPdf,
          "--overwrite",
        ],
        pngPages: scenario.expected.pngPages,
        validate: (evidence) => validatePdfEvidence(scenario, evidence),
        summarize: (evidence) =>
          extractionSummary(
            evidence,
            scenario.expected.pages,
            undefined,
            scenario.expected.textOccurrences,
          ),
        temporaryImages,
        onExtraction: (summary) => {
          scenarioEvidence.extraction = summary;
        },
        env: selectedEnvironment,
      });
    }

    for (const scenario of PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS) {
      if (!scenario.candidateIds.includes(candidate.id)) continue;
      const projectLaunch = contract.projectLaunches[scenario.id];
      if (!projectLaunch) throw new Error(`Missing materialized Project launch ${scenario.id}.`);
      const authoringScenarioId = `${scenario.id}:authoring`;
      const authored = await runChecked(
        runner,
        commandRequest(
          "actual-launch",
          [
            options.nodeExecutable ?? "node",
            "dist/esm/bin.mjs",
            "md",
            "pdf-project",
            "codex",
            ...(projectLaunch.baseProfilePath
              ? ["--base-profile", projectLaunch.baseProfilePath]
              : []),
            ...(projectLaunch.coverImagePath
              ? ["--cover-image", projectLaunch.coverImagePath]
              : []),
            "--output",
            projectLaunch.projectDirectory,
            "--overwrite",
          ],
          { candidateId: candidate.id, scenarioId: authoringScenarioId, env: selectedEnvironment },
        ),
      );
      if (authored.failure) {
        failures.push(authored.failure);
        continue;
      }
      const launchExtractions = new Map<string, PdfExtractionSummary>();
      for (const launchMode of scenario.launchModes) {
        const scenarioId = `${scenario.id}:${launchMode}`;
        const scenarioEvidence: ScenarioEvidence = { id: scenarioId, passed: false };
        candidateResult.projectScenarios.push(scenarioEvidence);
        scenarioEvidence.passed = await runRenderedScenarioEvidence({
          runner,
          pdfInspector,
          failures,
          candidateId: candidate.id,
          scenarioId,
          outputDirectory: join(
            labRoot,
            "results",
            candidate.id,
            "project-launches",
            scenario.id,
            launchMode,
          ),
          renderStage: "actual-launch",
          extractionStage: "actual-launch-extraction",
          renderArgv: (projectPdf) => [
            options.nodeExecutable ?? "node",
            "dist/esm/bin.mjs",
            "md",
            "to-pdf",
            "--input",
            projectLaunch.markdownPath,
            ...(launchMode === "bundle"
              ? ["--bundle", projectLaunch.bundlePath]
              : [
                  "--profile",
                  projectLaunch.profilePath,
                  "--template",
                  projectLaunch.templatePath,
                  "--css",
                  projectLaunch.cssPath,
                ]),
            "--output",
            projectPdf,
            "--overwrite",
          ],
          pngPages: scenario.expected.pngPages,
          validate: (evidence) => validatePdfEvidence(scenario, evidence),
          summarize: (evidence) => extractionSummary(evidence, scenario.expected.pages),
          temporaryImages,
          onExtraction: (summary) => {
            scenarioEvidence.extraction = summary;
            launchExtractions.set(launchMode, summary);
          },
          env: selectedEnvironment,
        });
      }
      if (scenario.equivalenceBoundary && launchExtractions.size === 2) {
        const [firstMode, secondMode] = scenario.equivalenceBoundary.compare;
        if (
          JSON.stringify(launchExtractions.get(firstMode)) !==
          JSON.stringify(launchExtractions.get(secondMode))
        )
          failures.push(
            contractFailure(
              "actual-launch-extraction",
              "Project bundle and explicit-role extraction summaries differ.",
              candidate.id,
              scenario.id,
            ),
          );
      }
    }
  }

  const requiredScenarioIds = new Set(
    [
      ...PAGE_NUMBER_RENDERER_SCENARIOS.filter((scenario) => scenario.required),
      ...PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS.filter((scenario) => scenario.required),
      ...PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS.filter((scenario) => scenario.required).flatMap(
        (scenario) => [
          { id: scenario.id },
          ...scenario.launchModes.map((mode) => ({ id: `${scenario.id}:${mode}` })),
        ],
      ),
    ].map(
      (
        scenario:
          | RendererContractScenario
          | ProductRendererScenario
          | Pick<ProjectRendererScenario, "id">,
      ) => scenario.id,
    ),
  );
  const hasRequiredContractFailure = failures.some(
    (failure) =>
      failure.classification === "contract-failure" &&
      (failure.scenarioId === undefined || requiredScenarioIds.has(failure.scenarioId)),
  );
  const hasEnvironmentFailure = failures.some(
    (failure) => failure.classification !== "contract-failure",
  );
  const outcome = hasRequiredContractFailure
    ? "failed"
    : hasEnvironmentFailure
      ? "inconclusive"
      : "passed";
  const hasFailedCounterExperiment = candidates.some((candidate) =>
    candidate.counterExperiments.some((experiment) => !experiment.passed),
  );
  const retained = options.keep === true || outcome !== "passed" || hasFailedCounterExperiment;
  const report: RendererEvidenceReport = {
    catalogDigest: contract.catalogDigest,
    harnessDigest: PAGE_NUMBER_RENDERER_HARNESS_DIGEST,
    outcome,
    evidenceStatus: [
      ...PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS,
      ...PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS,
    ].some((scenario) => scenario.visualReviewRequired.length > 0)
      ? "visual-review-required"
      : "complete",
    retained,
    labPath: labRoot,
    bodyHooks,
    candidates,
    failures,
    temporaryImages,
    visualConclusions: (options.visualConclusions ?? []).map((conclusion) => ({
      ...conclusion,
      conclusion: publicSafeText(conclusion.conclusion),
    })),
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
  };
  await writeFile(
    join(labRoot, "results", reportName),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  if (!retained) await closeRetainedEvidenceLaboratory(labRoot, options.temporaryRoot);
  return report;
}
