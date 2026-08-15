import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS,
  PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS,
  PAGE_NUMBER_COUNTER_EXPERIMENTS,
  WEASYPRINT_CANDIDATES,
} from "../../../test/fixtures/markdown-pdf/page-number-renderer-contract";
import type {
  ExpectedCounterValues,
  PhysicalPageRole,
  materializePageNumberRendererContract,
  WeasyPrintCandidate,
} from "../../../test/fixtures/markdown-pdf/page-number-renderer-contract";

export const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
export const labPrefix = "cdx-chores-weasyprint-matrix-";
export const reportName = "renderer-evidence-report.json";
export const maximumOutputBytes = 64 * 1024;
export const commandTimeoutMs = 120_000;

const harnessContract = {
  candidates: WEASYPRINT_CANDIDATES.map((candidate) => candidate.id),
  counterExperiments: PAGE_NUMBER_COUNTER_EXPERIMENTS.map((scenario) => scenario.id),
  productScenarios: PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS.map((scenario) => scenario.id),
  projectScenarios: PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS.map((scenario) => scenario.id),
  stages: [
    "setup",
    "dependency-install",
    "environment-inspection",
    "contract-render",
    "contract-extraction",
    "png-render",
    "doctor",
    "actual-launch",
    "actual-launch-extraction",
    "cleanup",
  ],
  timeoutMs: commandTimeoutMs,
  maximumOutputBytes,
} as const;

export const PAGE_NUMBER_RENDERER_HARNESS_DIGEST = createHash("sha256")
  .update(JSON.stringify(harnessContract))
  .digest("hex");

export type EvidenceStage = (typeof harnessContract.stages)[number] | "initialization";

export type EvidenceClassification =
  | "contract-failure"
  | "dependency-failure"
  | "executable-launch-failure"
  | "font-discovery-failure"
  | "native-library-failure"
  | "pass"
  | "setup-failure";

export interface CommandRequest {
  argv: readonly string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs: number;
  maximumOutputBytes: number;
  stage: EvidenceStage;
  candidateId?: WeasyPrintCandidate["id"];
  scenarioId?: string;
}

export interface CommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  errorCode?: string;
  timedOut?: boolean;
  outputTruncated?: boolean;
}

export type CommandRunner = (request: CommandRequest) => Promise<CommandResult>;

export interface PdfPageEvidence {
  text: string;
  runs: readonly PdfTextRunEvidence[];
  widthMillimeters: number;
  heightMillimeters: number;
}

export interface PdfTextRunEvidence {
  text: string;
  xMillimeters: number;
  yMillimeters: number;
  widthMillimeters: number;
  heightMillimeters: number;
}

export interface PdfEvidence {
  pageCount: number;
  pages: readonly PdfPageEvidence[];
  pageLabelState: "default-physical" | "unexpected-custom";
}

export type PdfInspector = (pdfPath: string) => Promise<PdfEvidence>;

export interface EvidenceFailure {
  candidateId?: WeasyPrintCandidate["id"];
  scenarioId?: string;
  stage: EvidenceStage;
  classification: Exclude<EvidenceClassification, "pass">;
  message: string;
}

export interface CandidateEvidence {
  candidateId: WeasyPrintCandidate["id"];
  weasyPrintVersion: string;
  environment?: Record<string, string>;
  scenarios: ScenarioEvidence[];
  counterExperiments: CounterExperimentEvidence[];
  doctorPassed: boolean;
  actualLaunchPassed: boolean;
  actualLaunchExtraction?: PdfExtractionSummary;
  productScenarios: ScenarioEvidence[];
  projectScenarios: ScenarioEvidence[];
}

export interface PdfExtractionSummary {
  pageCount: number;
  dimensionsMillimeters: Array<{ width: number; height: number }>;
  labelsByPhysicalPage: string[][];
  pageRolesByPhysicalPage: Array<PhysicalPageRole | "unidentified">;
  counterValuesByPhysicalPage: Array<ExpectedCounterValues | null>;
  pageLabelState: PdfEvidence["pageLabelState"];
}

export interface ScenarioEvidence {
  id: string;
  passed: boolean;
  extraction?: PdfExtractionSummary;
}

export interface OnePassCounterAssessment {
  mechanism: "one-pass";
  expectedPhysicalPages: number[];
  matchingPhysicalPages: number[];
  allCounterValuesMatch: boolean;
  /** Evidence-only result; the Phase 14.5 production verdict remains a separate review decision. */
  evidencePassed: boolean;
  mismatches: string[];
}

export interface CounterExperimentEvidence extends ScenarioEvidence {
  mechanism: "one-pass";
  assessment?: OnePassCounterAssessment;
}

export interface TemporaryImageEvidence {
  candidateId: WeasyPrintCandidate["id"];
  scenarioId: string;
  physicalPage: number;
  path: string;
}

export interface VisualConclusion {
  candidateId: WeasyPrintCandidate["id"];
  scenarioId: string;
  conclusion: string;
}

export interface BodyHookEvidence {
  id: string;
  actual: "hard-error" | "supported" | "warning-fallback";
  expected: "hard-error" | "supported" | "warning-fallback";
  passed: boolean;
}

export interface RendererEvidenceReport {
  catalogDigest: string;
  harnessDigest: string;
  outcome: "failed" | "inconclusive" | "passed";
  evidenceStatus: "complete" | "visual-review-required";
  retained: boolean;
  labPath: string;
  bodyHooks: BodyHookEvidence[];
  candidates: CandidateEvidence[];
  failures: EvidenceFailure[];
  temporaryImages: TemporaryImageEvidence[];
  visualConclusions: VisualConclusion[];
  evidenceBoundary: {
    automated: readonly string[];
    visualReviewRequired: Array<{ scenarioId: string; assertions: readonly string[] }>;
  };
}

export interface RunRendererEvidenceOptions {
  keep?: boolean;
  pythonExecutable?: string;
  nodeExecutable?: string;
  temporaryRoot?: string;
  uniqueId?: string;
  runner?: CommandRunner;
  inspectPdf?: PdfInspector;
  materializeContract?: typeof materializePageNumberRendererContract;
  initializeMarker?: (markerPath: string) => Promise<void>;
  visualConclusions?: readonly VisualConclusion[];
}
