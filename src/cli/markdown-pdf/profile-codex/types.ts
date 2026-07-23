import type { MarkdownPdfCodexProfileRunner } from "../../../adapters/codex/markdown-pdf-profile";
import type { CodexProgressPresenter } from "../../actions/codex-progress";

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
  codexProgressPresenter?: CodexProgressPresenter;
  profileUidFactory?: (now: Date) => string;
}

export type MdPdfProfileCodexCliOptions = Omit<
  MdPdfProfileCodexOptions,
  "codexProgressPresenter" | "codexRunner" | "profileUidFactory"
>;
