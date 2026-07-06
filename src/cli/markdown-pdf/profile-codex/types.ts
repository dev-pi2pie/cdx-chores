import type { MarkdownPdfCodexProfileRunner } from "../../../adapters/codex/markdown-pdf-profile";

export interface MdPdfProfileCodexOptions {
  input?: string;
  positionalInput?: string;
  intent?: string;
  fontHint?: string[];
  baseProfile?: string;
  output?: string;
  dryRun?: boolean;
  keepCodexReport?: boolean;
  codexReportOutput?: string;
  overwrite?: boolean;
  codexRunner?: MarkdownPdfCodexProfileRunner;
  profileUidFactory?: (now: Date) => string;
}

export type MdPdfProfileCodexCliOptions = Omit<
  MdPdfProfileCodexOptions,
  "codexRunner" | "profileUidFactory"
>;
