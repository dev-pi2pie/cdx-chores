import type { NormalizedMarkdownPdfOptions } from "../validation";
import type { MarkdownPdfTemplateCodexDecisionMode } from "./types-command";
import type {
  MarkdownPdfTemplateCodexFitPressure,
  MarkdownPdfTemplateCodexOrientationBucket,
} from "./types-signals";
import type { MarkdownPdfTemplateCodexTitlePolicyDecision } from "./title-policy";

export type MarkdownPdfTemplateCodexTemplateFamily = "document-layered" | "cover-media-layered";

export type MarkdownPdfTemplateCodexImageFit = "contain" | "cover";

export type MarkdownPdfTemplateCodexRecipePresetSource =
  | "explicit-recipe"
  | "base-profile"
  | "document-signal"
  | "renderer-default";

export type MarkdownPdfTemplateCodexCoverLayout = "none" | "contained-media" | "full-bleed-media";

export type MarkdownPdfTemplateCodexCoverTitlePlacement = "document-title" | "below-media";

export type MarkdownPdfTemplateCodexCoverStyle = "none" | "media";

export interface MarkdownPdfTemplateCodexFamilySpec {
  id: MarkdownPdfTemplateCodexTemplateFamily;
  label: string;
  description: string;
  requiresCoverImage: boolean;
  requiredTemplateHooks: MarkdownPdfTemplateCodexRequiredHook[];
  requiredCssHooks: MarkdownPdfTemplateCodexRequiredHook[];
  defaultCoverLayout: MarkdownPdfTemplateCodexCoverLayout;
  defaultCoverTitlePlacement: MarkdownPdfTemplateCodexCoverTitlePlacement;
}

export interface MarkdownPdfTemplateCodexRequiredHook {
  id: string;
  marker: string;
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

export type MarkdownPdfTemplateCodexFontRole = "body" | "heading" | "code";

export type MarkdownPdfTemplateCodexTemplateFontDecisionSource = "font-hint" | "template-style";

export interface MarkdownPdfTemplateCodexTemplateFontDecision {
  role: MarkdownPdfTemplateCodexFontRole;
  family: string;
  source: MarkdownPdfTemplateCodexTemplateFontDecisionSource;
  templateLevel: boolean;
}

export type MarkdownPdfTemplateCodexMaterializedFontDecisionStatus = "applied" | "blocked";

export interface MarkdownPdfTemplateCodexMaterializedFontDecision extends MarkdownPdfTemplateCodexTemplateFontDecision {
  status: MarkdownPdfTemplateCodexMaterializedFontDecisionStatus;
  profileOwned: boolean;
  overridesProfileFont: boolean;
  reason: "applied" | "template-level-override" | "profile-font-owned";
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
  titlePolicy: MarkdownPdfTemplateCodexTitlePolicyDecision;
  fontDecisions: MarkdownPdfTemplateCodexMaterializedFontDecision[];
  managedAssets: MarkdownPdfTemplateCodexManagedAssetBinding[];
  warnings?: string[];
  unsupportedDirections?: string[];
  fallbackReason?: string;
  templateHtml: string;
  styleCss: string;
}
