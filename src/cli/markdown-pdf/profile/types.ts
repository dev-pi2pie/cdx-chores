import type { NormalizeMarkdownPdfOptionsInput } from "../validation";
import type { MarkdownPdfPreset } from "../validation";
import {
  MARKDOWN_PDF_CODE_THEMES,
  MARKDOWN_PDF_PAGE_CHROME_FONT_WEIGHTS,
  MARKDOWN_PDF_PAGE_CHROME_POSITIONS,
  MARKDOWN_PDF_PAGE_CHROME_SEPARATOR_STYLES,
  MARKDOWN_PDF_PAGE_NUMBER_COUNT_ORIGINS,
  MARKDOWN_PDF_PAGE_NUMBER_SCOPES,
} from "./feature-registry";
import type { MarkdownPdfProfileRevisionAssessment } from "./revision";

export {
  MARKDOWN_PDF_CODE_THEMES,
  MARKDOWN_PDF_PAGE_CHROME_FONT_WEIGHTS,
  MARKDOWN_PDF_PAGE_CHROME_POSITIONS,
  MARKDOWN_PDF_PAGE_CHROME_SEPARATOR_STYLES,
  MARKDOWN_PDF_PAGE_NUMBER_COUNT_ORIGINS,
  MARKDOWN_PDF_PAGE_NUMBER_SCOPES,
};

export type MarkdownPdfProfileFormat = "json" | "yaml";

export type MarkdownPdfMetadata = Record<string, string>;

export type MarkdownPdfProfileSource = "codex" | "deterministic";

export interface NormalizedMarkdownPdfProfileIdentity {
  id: string;
  source: MarkdownPdfProfileSource;
  basedOn?: string;
  preset?: MarkdownPdfPreset;
  createdAt: string;
}

export type MarkdownPdfCodeTheme = (typeof MARKDOWN_PDF_CODE_THEMES)[number];

export interface NormalizedMarkdownPdfCode {
  highlight: boolean;
  theme: MarkdownPdfCodeTheme;
  lineNumbers: boolean;
  transformerNotation: boolean;
}

export type EffectiveMarkdownPdfCodeOptions = NormalizedMarkdownPdfCode;

export type MarkdownPdfPageChromePosition = (typeof MARKDOWN_PDF_PAGE_CHROME_POSITIONS)[number];

export interface MarkdownPdfPageChromeSlots {
  left: string;
  center: string;
  right: string;
}

export type MarkdownPdfPageNumberScope = (typeof MARKDOWN_PDF_PAGE_NUMBER_SCOPES)[number];

export type MarkdownPdfPageNumberCountOrigin =
  (typeof MARKDOWN_PDF_PAGE_NUMBER_COUNT_ORIGINS)[number];

export type MarkdownPdfPageChromeFontWeight =
  (typeof MARKDOWN_PDF_PAGE_CHROME_FONT_WEIGHTS)[number];

export type MarkdownPdfPageChromeSeparatorStyle =
  (typeof MARKDOWN_PDF_PAGE_CHROME_SEPARATOR_STYLES)[number];

export interface NormalizedMarkdownPdfPageChromeSeparator {
  width?: string;
  style?: MarkdownPdfPageChromeSeparatorStyle;
  color?: string;
  gap?: string | 0;
}

export interface NormalizedMarkdownPdfPageChromeStyle {
  fontSize?: string;
  fontWeight?: MarkdownPdfPageChromeFontWeight;
  lineHeight?: number;
  color?: string;
  separator?: NormalizedMarkdownPdfPageChromeSeparator;
}

export interface NormalizedMarkdownPdfPageChromeArea extends MarkdownPdfPageChromeSlots {
  style?: NormalizedMarkdownPdfPageChromeStyle;
}

export interface NormalizedMarkdownPdfPageNumbers {
  enabled: boolean;
  position: MarkdownPdfPageChromePosition;
  format: string;
  scope: MarkdownPdfPageNumberScope;
  countFrom: MarkdownPdfPageNumberCountOrigin;
  start: number;
  increment: number;
}

export type MarkdownPdfMetadataTitleBlockMode = "auto" | "show" | "hide";

export interface NormalizedMarkdownPdfTitleBlock {
  metadataTitle: MarkdownPdfMetadataTitleBlockMode;
}

export type MarkdownPdfCoverStyle = "plain" | "report";

export interface NormalizedMarkdownPdfCover {
  enabled: boolean;
  style: MarkdownPdfCoverStyle;
  fields: {
    title: string;
    subtitle: string;
    author: string;
    company: string;
    date: string;
  };
}

export type MarkdownPdfFontRole = "body" | "heading" | "code" | "pageChrome";

export type MarkdownPdfFontConfig = Record<string, string>;

export interface NormalizedMarkdownPdfFonts {
  body: MarkdownPdfFontConfig;
  heading: MarkdownPdfFontConfig;
  code: MarkdownPdfFontConfig;
  pageChrome: MarkdownPdfFontConfig;
}

export interface NormalizedMarkdownPdfProfile {
  identity?: NormalizedMarkdownPdfProfileIdentity;
  metadata: MarkdownPdfMetadata;
  code: NormalizedMarkdownPdfCode;
  header: NormalizedMarkdownPdfPageChromeArea;
  footer: NormalizedMarkdownPdfPageChromeArea;
  pageNumbers: NormalizedMarkdownPdfPageNumbers;
  titleBlock: NormalizedMarkdownPdfTitleBlock;
  cover: NormalizedMarkdownPdfCover;
  fonts: NormalizedMarkdownPdfFonts;
  contentLangs: string[];
}

export interface MarkdownPdfProfileMergeInput {
  profile?: Record<string, unknown>;
  frontmatter?: Record<string, unknown> | null;
  meta?: string[];
}

export interface MarkdownPdfProfileLoadResult {
  profile: NormalizedMarkdownPdfProfile;
  recipeOptions: NormalizeMarkdownPdfOptionsInput;
  revisionAssessment: MarkdownPdfProfileRevisionAssessment;
}
