import type { NormalizedMarkdownPdfOptions } from "../validation";

export type MarkdownPdfTemplateCodexSignalMode =
  | "low-signal"
  | "base-profile-only"
  | "recipe-only"
  | "cover-image-only"
  | "codex-assisted"
  | "no-usable-template";

export type MarkdownPdfTemplateCodexDecisionMode =
  | "deterministic"
  | "codex-selected"
  | "conservative-fallback"
  | "no-usable-template";

export type MarkdownPdfTemplateCodexTemplateFamily = "document-layered" | "cover-media-layered";

export type MarkdownPdfTemplateCodexImageFit = "contain" | "cover";

export type MarkdownPdfTemplateCodexOrientationBucket =
  | "landscape"
  | "portrait"
  | "square"
  | "panoramic"
  | "tall"
  | "unknown";

export type MarkdownPdfTemplateCodexFitPressure =
  | "normal"
  | "crop-risk"
  | "letterbox-risk"
  | "unknown";

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
}

export type MdPdfTemplateCodexCliOptions = Omit<MdPdfTemplateCodexOptions, "positionalInput">;

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
}
