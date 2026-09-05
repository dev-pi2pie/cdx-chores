import type { ResolvedCodexExecution } from "../../../utils/codex-execution";
import type {
  MarkdownPdfTemplateCodexDecision,
  MarkdownPdfTemplateCodexOutputPlan,
  MdPdfTemplateCodexSignalCollection,
} from "../../../cli/markdown-pdf/template-codex";

export interface MarkdownPdfTemplateCodexRequest {
  intent?: string;
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  signals: MdPdfTemplateCodexSignalCollection;
  workingDirectory: string;
}

export interface MarkdownPdfTemplateCodexResult {
  decision: MarkdownPdfTemplateCodexDecision;
}

export type MarkdownPdfTemplateCodexRunner = (options: {
  prompt: string;
  codexExecution: ResolvedCodexExecution;
  timeoutMs?: number;
  workingDirectory: string;
}) => Promise<string>;
