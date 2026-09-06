import type { CodexExecutionOptions, ResolvedCodexExecution } from "../../../utils/codex-execution";
import type { CodexExecutionCommandOptions } from "../../options/codex-execution-option";
import type { NormalizedMarkdownPdfOptions, NormalizeMarkdownPdfOptionsInput } from "../validation";
import type { CodexProgressPresenter } from "../../actions/codex-progress";

export type MarkdownPdfTemplateCodexBundleIdFactory = (now: Date, attempt: number) => string;

export type MarkdownPdfTemplateCodexRunner = (options: {
  prompt: string;
  codexExecution: ResolvedCodexExecution;
  timeoutMs?: number;
  workingDirectory: string;
}) => Promise<string>;

export type MarkdownPdfTemplateCodexSignalMode =
  | "low-signal"
  | "base-profile-only"
  | "recipe-only"
  | "cover-image-only"
  | "deterministic"
  | "codex-assisted"
  | "no-usable-template";

export type MarkdownPdfTemplateCodexDecisionMode =
  | "deterministic"
  | "adapted"
  | "conservative-fallback"
  | "no-usable-template";

export interface MdPdfTemplateCodexOptions {
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
  preset?: string;
  pageSize?: string;
  orientation?: string;
  margin?: string;
  marginX?: string;
  marginY?: string;
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  toc?: boolean;
  tocDepth?: number;
  tocPageBreak?: string;
  templateBundleIdFactory?: MarkdownPdfTemplateCodexBundleIdFactory;
  codexRunner?: MarkdownPdfTemplateCodexRunner;
  codexProgressPresenter?: CodexProgressPresenter;
  timeoutMs?: number;
  codexExecution?: CodexExecutionOptions;
}

type MdPdfTemplateCodexNonCliOption =
  | "codexRunner"
  | "codexProgressPresenter"
  | "margin"
  | "marginBottom"
  | "marginLeft"
  | "marginRight"
  | "marginTop"
  | "marginX"
  | "marginY"
  | "orientation"
  | "pageSize"
  | "positionalInput"
  | "preset"
  | "templateBundleIdFactory"
  | "codexExecution"
  | "timeoutMs"
  | "toc"
  | "tocDepth"
  | "tocPageBreak";

export type MdPdfTemplateCodexCliOptions = Omit<
  MdPdfTemplateCodexOptions,
  MdPdfTemplateCodexNonCliOption
> &
  CodexExecutionCommandOptions & {
    codexTimeout?: number;
  };

export interface NormalizedMdPdfTemplateCodexCommandState {
  inputPath?: string;
  intent?: string;
  fontHints: string[];
  baseProfilePath?: string;
  coverImagePath?: string;
  outputPath?: string;
  dryRun: boolean;
  keepCodexReport: boolean;
  codexReportOutputPath?: string;
  overwrite: boolean;
  recipeOptions: NormalizedMarkdownPdfOptions;
  explicitRecipe: MdPdfTemplateCodexExplicitRecipeSignal;
  templateBundleIdFactory?: MarkdownPdfTemplateCodexBundleIdFactory;
}

export interface MdPdfTemplateCodexExplicitRecipeSignal {
  options: NormalizeMarkdownPdfOptionsInput;
  fields: string[];
}
