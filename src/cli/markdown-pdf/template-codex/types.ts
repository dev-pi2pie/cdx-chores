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
  | "adapted"
  | "conservative-fallback"
  | "no-usable-template";

export type MarkdownPdfTemplateCodexTemplateFamily = "document-layered" | "cover-media-layered";

export type MarkdownPdfTemplateCodexImageFit = "contain" | "cover";

export type MarkdownPdfTemplateCodexRecipePresetSource =
  | "explicit-recipe"
  | "base-profile"
  | "renderer-default";

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

export type MarkdownPdfTemplateCodexPlannedReport =
  | MarkdownPdfTemplateCodexPlannedBundleReport
  | MarkdownPdfTemplateCodexPlannedExternalReport;

export interface MarkdownPdfTemplateCodexPlannedBundleReport extends MarkdownPdfTemplateCodexPlannedFile {
  location: "in-bundle";
}

export interface MarkdownPdfTemplateCodexPlannedExternalReport {
  path: string;
  location: "external";
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

export type MarkdownPdfTemplateCodexCoverLayout = "none" | "contained-media" | "full-bleed-media";

export type MarkdownPdfTemplateCodexCoverTitlePlacement = "document-title" | "below-media";

export type MarkdownPdfTemplateCodexCoverStyle = "none" | "media";

export interface MarkdownPdfTemplateCodexFamilySpec {
  id: MarkdownPdfTemplateCodexTemplateFamily;
  label: string;
  description: string;
  requiresCoverImage: boolean;
  requiredHooks: string[];
  defaultCoverLayout: MarkdownPdfTemplateCodexCoverLayout;
  defaultCoverTitlePlacement: MarkdownPdfTemplateCodexCoverTitlePlacement;
}

export interface MarkdownPdfTemplateCodexRecipePresetSlot {
  preset: NormalizedMarkdownPdfOptions["preset"];
  source: MarkdownPdfTemplateCodexRecipePresetSource;
}

export interface MarkdownPdfTemplateCodexCoverSlot {
  enabled: boolean;
  imageFit?: MarkdownPdfTemplateCodexImageFit;
  layout: MarkdownPdfTemplateCodexCoverLayout;
  titlePlacement: MarkdownPdfTemplateCodexCoverTitlePlacement;
  style: MarkdownPdfTemplateCodexCoverStyle;
  orientationBucket: MarkdownPdfTemplateCodexOrientationBucket;
  fitPressure: MarkdownPdfTemplateCodexFitPressure;
}

export interface MarkdownPdfTemplateCodexTableSlot {
  density: "compact" | "standard" | "wide";
  repeatHeader: boolean;
  width: "content" | "full";
}

export interface MarkdownPdfTemplateCodexCodeSlot {
  style: "shiki-compatible";
  lineWrap: "wrap";
  preserveSelectors: boolean;
}

export interface MarkdownPdfTemplateCodexSpacingSlot {
  density: "compact" | "standard" | "spacious";
}

export interface MarkdownPdfTemplateCodexTypographySlot {
  scale: "compact" | "standard" | "reader";
}

export interface MarkdownPdfTemplateCodexColorSlot {
  palette: "neutral";
}

export interface MarkdownPdfTemplateCodexThemeTokens {
  bodyFont: string;
  headingFont: string;
  monospaceFont: string;
  bodySize: string;
  lineHeight: string;
  text: string;
  background: string;
  muted: string;
  accent: string;
  border: string;
  codeBackground: string;
  blockGap: string;
}

export interface MarkdownPdfTemplateCodexResolvedSlots {
  recipePreset: MarkdownPdfTemplateCodexRecipePresetSlot;
  cover: MarkdownPdfTemplateCodexCoverSlot;
  tables: MarkdownPdfTemplateCodexTableSlot;
  code: MarkdownPdfTemplateCodexCodeSlot;
  spacing: MarkdownPdfTemplateCodexSpacingSlot;
  typography: MarkdownPdfTemplateCodexTypographySlot;
  color: MarkdownPdfTemplateCodexColorSlot;
}

export interface MarkdownPdfTemplateCodexManagedAssetBinding {
  role: "cover-image";
  bundlePath: string;
  sourceBasename: string;
}

export interface MarkdownPdfTemplateCodexSynthesisResult {
  decisionMode: MarkdownPdfTemplateCodexDecisionMode;
  templateFamily: MarkdownPdfTemplateCodexTemplateFamily;
  slots: MarkdownPdfTemplateCodexResolvedSlots;
  themeTokens: MarkdownPdfTemplateCodexThemeTokens;
  managedAssets: MarkdownPdfTemplateCodexManagedAssetBinding[];
  templateHtml: string;
  styleCss: string;
}
