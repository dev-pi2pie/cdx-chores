export { DEFAULT_MARKDOWN_PDF_PROFILE, DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE } from "./defaults";
export {
  MARKDOWN_PDF_PROFILE_BASELINE_REVISION,
  MARKDOWN_PDF_PROFILE_CURRENT_REVISION,
  MARKDOWN_PDF_PROFILE_FEATURE_COMBINATION_RULES,
  MARKDOWN_PDF_PROFILE_FEATURE_REGISTRY,
  markdownPdfProfileFeatureAtPath,
  markdownPdfProfileFeatureKeys,
  markdownPdfProfileFeatureTokens,
  markdownPdfProfileFeatureValues,
  markdownPdfProfileRendererCapability,
  markdownPdfProfileRendererCapabilities,
  markdownPdfProfileRendererCapabilityFields,
} from "./feature-registry";
export type {
  MarkdownPdfProfileFeatureCombinationRule,
  MarkdownPdfProfileFeatureDefinition,
  MarkdownPdfProfileFeatureKind,
  MarkdownPdfProfileFeatureToken,
  MarkdownPdfProfileFeatureValue,
  MarkdownPdfProfileNormalizationRoute,
} from "./feature-registry";
export {
  isMarkdownPdfPageNumberFormatToken,
  MARKDOWN_PDF_LOGICAL_FINAL_TARGET_ID,
  MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME,
  MARKDOWN_PDF_PAGE_NUMBER_FORMAT_TOKEN_DEFINITIONS,
  MARKDOWN_PDF_PAGE_NUMBER_FORMAT_TOKENS,
  markdownPdfPageNumberFormatTokens,
  parseMarkdownPdfPageNumberFormat,
} from "./page-number-format";
export type {
  MarkdownPdfPageNumberFormatSegment,
  MarkdownPdfPageNumberFormatToken,
  MarkdownPdfPageNumberFormatTokenDefinition,
} from "./page-number-format";
export { assessMarkdownPdfProfileRevision, inferMarkdownPdfProfileRevision } from "./revision";
export type {
  MarkdownPdfProfileRevisionAssessment,
  MarkdownPdfProfileRevisionState,
} from "./revision";
export { MARKDOWN_PDF_CODE_THEMES } from "./types";
export {
  isMarkdownPdfPageChromeColor,
  isMarkdownPdfPageChromeFontSize,
  isMarkdownPdfPageChromeFontWeight,
  isMarkdownPdfPageChromeLineHeight,
  isMarkdownPdfPageChromeSeparatorGap,
  isMarkdownPdfPageChromeSeparatorStyle,
  isMarkdownPdfPageChromeSeparatorWidth,
} from "./page-number-domains";
export {
  assessMarkdownPdfCoverVisibility,
  createMarkdownPdfCoverCss,
  createMarkdownPdfCoverHtml,
  resolveMarkdownPdfCoverFields,
} from "./cover";
export type { MarkdownPdfCoverVisibilityAssessment, ResolvedMarkdownPdfCoverFields } from "./cover";
export { createMarkdownPdfFontCss } from "./fonts";
export { normalizeMarkdownPdfProfileIdentity } from "./identity";
export { createMarkdownPdfProfileConfig } from "./materialize";
export {
  normalizeMarkdownPdfProfile,
  markdownPdfProfileToRecipeOptions,
  resolveMarkdownPdfCodeOptions,
} from "./normalize";
export { createMarkdownPdfPageChromeCss, resolveMarkdownPdfPageNumberSlot } from "./page-chrome";
export type {
  CreateMarkdownPdfPageChromeCssInput,
  MarkdownPdfPageChromeBodyBoundary,
} from "./page-chrome";
export { resolveMarkdownPdfPageNumberConfiguration } from "./page-number-configuration";
export type {
  MarkdownPdfPageNumberConfigurationSource,
  ResolvedMarkdownPdfPageNumberConfiguration,
} from "./page-number-configuration";
export { resolveMarkdownPdfPlaceholderText } from "./placeholders";
export { parseMarkdownPdfProfileFile, readMarkdownPdfProfileFile } from "./parse";
export type { MarkdownPdfProfileParseResult } from "./parse";
export {
  inferMarkdownPdfProfileFormat,
  MARKDOWN_PDF_PROFILE_ROOT_KEYS,
  MARKDOWN_PDF_PROFILE_SUPPORTED_SCHEMA_SUMMARY,
  validateMarkdownPdfProfileShape,
} from "./schema";
export { serializeMarkdownPdfProfile } from "./serialize";
export type {
  EffectiveMarkdownPdfCodeOptions,
  MarkdownPdfCodeTheme,
  MarkdownPdfMetadata,
  MarkdownPdfMetadataTitleBlockMode,
  MarkdownPdfCoverStyle,
  MarkdownPdfFontConfig,
  MarkdownPdfFontRole,
  MarkdownPdfPageChromePosition,
  MarkdownPdfPageChromeSlots,
  MarkdownPdfPageChromeFontWeight,
  MarkdownPdfPageChromeSeparatorStyle,
  MarkdownPdfPageNumberCountOrigin,
  MarkdownPdfPageNumberScope,
  MarkdownPdfProfileFormat,
  MarkdownPdfProfileLoadResult,
  MarkdownPdfProfileMergeInput,
  MarkdownPdfProfileSource,
  NormalizedMarkdownPdfCode,
  NormalizedMarkdownPdfCover,
  NormalizedMarkdownPdfFonts,
  NormalizedMarkdownPdfPageChromeArea,
  NormalizedMarkdownPdfPageChromeSeparator,
  NormalizedMarkdownPdfPageChromeStyle,
  NormalizedMarkdownPdfProfileIdentity,
  NormalizedMarkdownPdfPageNumbers,
  NormalizedMarkdownPdfTitleBlock,
  NormalizedMarkdownPdfProfile,
} from "./types";
export {
  MARKDOWN_PDF_PAGE_CHROME_POSITIONS,
  MARKDOWN_PDF_PAGE_CHROME_FONT_WEIGHTS,
  MARKDOWN_PDF_PAGE_CHROME_SEPARATOR_STYLES,
  MARKDOWN_PDF_PAGE_NUMBER_COUNT_ORIGINS,
  MARKDOWN_PDF_PAGE_NUMBER_SCOPES,
} from "./types";
