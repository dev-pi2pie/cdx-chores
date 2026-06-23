import type { NormalizedMarkdownPdfOptions } from "../validation";
import type { MarkdownPdfTemplateCodexDecisionMode } from "./types-command";
import type {
  MarkdownPdfTemplateCodexFitPressure,
  MarkdownPdfTemplateCodexOrientationBucket,
} from "./types-signals";

export type MarkdownPdfTemplateCodexTemplateFamily = "document-layered" | "cover-media-layered";

export type MarkdownPdfTemplateCodexImageFit = "contain" | "cover";

export type MarkdownPdfTemplateCodexRecipePresetSource =
  | "explicit-recipe"
  | "base-profile"
  | "renderer-default";

export type MarkdownPdfTemplateCodexCoverLayout = "none" | "contained-media" | "full-bleed-media";

export type MarkdownPdfTemplateCodexCoverTitlePlacement = "document-title" | "below-media";

export type MarkdownPdfTemplateCodexCoverStyle = "none" | "media";

export interface MarkdownPdfTemplateCodexFamilySpec {
  id: MarkdownPdfTemplateCodexTemplateFamily;
  label: string;
  description: string;
  requiresCoverImage: boolean;
  requiredTemplateHooks: string[];
  requiredCssHooks: string[];
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
