import type { MarkdownPdfProjectCodexIdentity } from "./types-identity";
import type {
  MarkdownPdfProjectCodexDecisionMode,
  MarkdownPdfProjectCodexSignalMode,
} from "./types-modes";
import type { MarkdownPdfProjectCodexPhaseSummary } from "./types-phase";

export interface MarkdownPdfProjectCodexReportArtifact {
  artifactType: "markdown-pdf-codex-project-report";
  artifact: {
    version: 1;
    advisoryOnly: true;
  };
  project: MarkdownPdfProjectCodexIdentity;
  signalMode: MarkdownPdfProjectCodexSignalMode;
  decisionMode: MarkdownPdfProjectCodexDecisionMode;
  phases: MarkdownPdfProjectCodexPhaseSummary[];
}
