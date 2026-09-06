import type { CodexExecutionOptions } from "../../../utils/codex-execution";
import type { CodexExecutionCommandOptions } from "../../options/codex-execution-option";
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
  timeoutMs?: number;
  codexExecution?: CodexExecutionOptions;
  codexRunner?: MarkdownPdfCodexProfileRunner;
  codexProgressPresenter?: CodexProgressPresenter;
  profileUidFactory?: (now: Date) => string;
}

export type MdPdfProfileCodexCliOptions = Omit<
  MdPdfProfileCodexOptions,
  "codexProgressPresenter" | "codexRunner" | "profileUidFactory" | "timeoutMs" | "codexExecution"
> &
  CodexExecutionCommandOptions & {
    codexTimeout?: number;
  };
