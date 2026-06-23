import type { NormalizedMarkdownPdfOptions } from "../validation";
import type { NormalizeMarkdownPdfOptionsInput } from "../validation";
import type { MarkdownPdfDocumentSignals, MarkdownPdfFontSignals } from "../profile/signals";
import type { MarkdownPdfProfileCandidateSummary } from "../profile/candidates";

export type MarkdownPdfTemplateCodexBundleIdFactory = (now: Date, attempt: number) => string;

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
  templateBundleIdFactory?: MarkdownPdfTemplateCodexBundleIdFactory;
}

export type MdPdfTemplateCodexCliOptions = Omit<
  MdPdfTemplateCodexOptions,
  "positionalInput" | "templateBundleIdFactory"
>;

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

export interface MarkdownPdfTemplateCodexRecipeSignals {
  effectiveOptions: NormalizedMarkdownPdfOptions;
  explicitFields: string[];
  baseProfileFields: string[];
}

export interface MarkdownPdfTemplateCodexBaseProfileSignals {
  available: boolean;
  summary?: MarkdownPdfProfileCandidateSummary;
}

export interface MarkdownPdfTemplateCodexCoverImageDimensions {
  width: number;
  height: number;
}

export interface MarkdownPdfTemplateCodexCoverImageSignals {
  available: boolean;
  sourceBasename?: string;
  format?: "jpeg" | "png" | "webp";
  metadataStatus?: "parsed" | "unparsed" | "unreadable" | "unsupported-format";
  dimensions?: MarkdownPdfTemplateCodexCoverImageDimensions;
  aspectRatio?: number;
  orientationBucket: MarkdownPdfTemplateCodexOrientationBucket;
  fitPressure: MarkdownPdfTemplateCodexFitPressure;
}

export interface MarkdownPdfTemplateCodexFontSignals {
  hints: string[];
  profileFonts: MarkdownPdfFontSignals;
}

export interface MdPdfTemplateCodexSignalCollection {
  signalMode: MarkdownPdfTemplateCodexSignalMode;
  documentSignals: MarkdownPdfDocumentSignals;
  baseProfile: MarkdownPdfTemplateCodexBaseProfileSignals;
  recipe: MarkdownPdfTemplateCodexRecipeSignals;
  fonts: MarkdownPdfTemplateCodexFontSignals;
  coverImage: MarkdownPdfTemplateCodexCoverImageSignals;
}

export interface MarkdownPdfTemplateCodexPlannedFile {
  path: string;
  bundlePath: string;
}

export interface MarkdownPdfTemplateCodexPlannedAsset extends MarkdownPdfTemplateCodexPlannedFile {
  sourcePath: string;
  sourceBasename: string;
}

export interface MarkdownPdfTemplateCodexPlannedReport {
  path: string;
  location: "in-bundle" | "external";
  bundlePath?: string;
}

export interface MarkdownPdfTemplateCodexOutputPlan {
  bundleId: string;
  outputDirectory: string;
  generatedOutputDirectory: boolean;
  templateHtml: MarkdownPdfTemplateCodexPlannedFile;
  styleCss: MarkdownPdfTemplateCodexPlannedFile;
  report?: MarkdownPdfTemplateCodexPlannedReport;
  assets: MarkdownPdfTemplateCodexPlannedAsset[];
}
