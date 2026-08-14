/**
 * Stable public facade for the Markdown PDF page-number renderer evidence
 * harness. Implementation modules intentionally live beside this entrypoint.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  reportRendererEvidenceCliError,
  runRendererEvidenceCli,
} from "./markdown-pdf-page-number-renderer-evidence/cli";

export { PAGE_NUMBER_RENDERER_HARNESS_DIGEST } from "./markdown-pdf-page-number-renderer-evidence/contract";
export type {
  BodyHookEvidence,
  CandidateEvidence,
  CommandRequest,
  CommandResult,
  CommandRunner,
  EvidenceClassification,
  EvidenceFailure,
  EvidenceStage,
  PdfEvidence,
  PdfExtractionSummary,
  PdfInspector,
  PdfPageEvidence,
  PdfTextRunEvidence,
  RendererEvidenceReport,
  RunRendererEvidenceOptions,
  ScenarioEvidence,
  TemporaryImageEvidence,
  VisualConclusion,
} from "./markdown-pdf-page-number-renderer-evidence/contract";
export {
  closeRetainedEvidenceLaboratory,
  initializeEvidenceLaboratory,
} from "./markdown-pdf-page-number-renderer-evidence/laboratory";
export {
  inspectBodyHookCases,
  inspectPdf,
  publicSafeText,
} from "./markdown-pdf-page-number-renderer-evidence/pdf";
export { runRendererEvidence } from "./markdown-pdf-page-number-renderer-evidence/orchestration";
export { publicEvidenceReport } from "./markdown-pdf-page-number-renderer-evidence/report";
export {
  defaultCommandRunner,
  safeSubprocessEnvironment,
} from "./markdown-pdf-page-number-renderer-evidence/subprocess";

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runRendererEvidenceCli(process.argv.slice(2)).catch(reportRendererEvidenceCliError);
}
