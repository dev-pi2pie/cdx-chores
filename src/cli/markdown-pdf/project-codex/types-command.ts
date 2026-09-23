import type { CodexExecutionOptions } from "../../../utils/codex-execution";
import type { CodexExecutionCommandOptions } from "../../options/codex-execution-option";
import type { MarkdownPdfCodexProfileRunner } from "../../../adapters/codex/markdown-pdf-profile";
import type { MarkdownPdfTemplateCodexRunner } from "../../../adapters/codex/markdown-pdf-template";
import type { CodexProgressPresenter } from "../../actions/codex-progress";
import type { MarkdownPdfProjectCodexIdentityUidFactory } from "./types-identity";
import type { MarkdownPdfCodexPageInformationInput } from "../profile-codex/page-information-signals";
import type { MarkdownPdfPageInformationSlotResolution } from "../profile-codex/page-information-materialization";

export interface MdPdfProjectCodexOptions {
  input?: string;
  positionalInput?: string;
  intent?: string;
  fontHint?: string[];
  baseProfile?: string;
  coverImage?: string;
  output?: string;
  dryRun?: boolean;
  keepCodexReport?: boolean;
  codexReportOutput?: string;
  overwrite?: boolean;
  identityUidFactory?: MarkdownPdfProjectCodexIdentityUidFactory;
  profileCodexRunner?: MarkdownPdfCodexProfileRunner;
  templateCodexRunner?: MarkdownPdfTemplateCodexRunner;
  codexProgressPresenter?: CodexProgressPresenter;
  timeoutMs?: number;
  codexExecution?: CodexExecutionOptions;
  /** Internal Interactive signal; unavailable through direct CLI options. */
  internalPageInformation?: MarkdownPdfCodexPageInformationInput;
  /** Internal Interactive conflict decision; never a direct CLI option. */
  internalPageInformationSlotResolution?: MarkdownPdfPageInformationSlotResolution;
}

type MdPdfProjectCodexNonCliOption =
  | "identityUidFactory"
  | "codexProgressPresenter"
  | "positionalInput"
  | "profileCodexRunner"
  | "templateCodexRunner"
  | "codexExecution"
  | "timeoutMs"
  | "internalPageInformation"
  | "internalPageInformationSlotResolution";

export type MdPdfProjectCodexCliOptions = Omit<
  MdPdfProjectCodexOptions,
  MdPdfProjectCodexNonCliOption
> &
  CodexExecutionCommandOptions & {
    codexTimeout?: number;
  };

export interface NormalizedMdPdfProjectCodexCommandState {
  inputPath?: string;
  intent?: string;
  fontHints: string[];
  baseProfilePath?: string;
  coverImagePath?: string;
  outputDirectory?: string;
  dryRun: boolean;
  keepCodexReport: boolean;
  codexReportOutputPath?: string;
  overwrite: boolean;
}
