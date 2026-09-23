import type { CodexExecutionOptions } from "../../../utils/codex-execution";
import type { CodexExecutionCommandOptions } from "../../options/codex-execution-option";
import type { MarkdownPdfCodexProfileRunner } from "../../../adapters/codex/markdown-pdf-profile";
import type { CodexProgressPresenter } from "../../actions/codex-progress";
import type { MarkdownPdfCodexPageInformationInput } from "./page-information-signals";
import type { MarkdownPdfPageInformationSlotResolution } from "./page-information-materialization";

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
  /** Internal Interactive signal; unavailable through direct CLI options. */
  internalPageInformation?: MarkdownPdfCodexPageInformationInput;
  /** Internal Interactive conflict decision; never a direct CLI option. */
  internalPageInformationSlotResolution?: MarkdownPdfPageInformationSlotResolution;
}

export type MdPdfProfileCodexCliOptions = Omit<
  MdPdfProfileCodexOptions,
  | "codexProgressPresenter"
  | "codexRunner"
  | "profileUidFactory"
  | "timeoutMs"
  | "codexExecution"
  | "internalPageInformation"
  | "internalPageInformationSlotResolution"
> &
  CodexExecutionCommandOptions & {
    codexTimeout?: number;
  };
