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
  timeoutMs?: number;
  workingDirectory: string;
}) => Promise<string>;
