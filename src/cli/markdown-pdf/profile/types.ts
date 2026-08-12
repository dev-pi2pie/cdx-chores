import type { NormalizeMarkdownPdfOptionsInput } from "../validation";
import type { MarkdownPdfPreset } from "../validation";

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

export const MARKDOWN_PDF_CODE_THEMES = [
  "github-light",
  "light-plus",
  "min-light",
  "vitesse-light",
  "catppuccin-latte",
] as const;

export type MarkdownPdfCodeTheme = (typeof MARKDOWN_PDF_CODE_THEMES)[number];

export interface NormalizedMarkdownPdfCode {
  highlight: boolean;
  theme: MarkdownPdfCodeTheme;
  lineNumbers: boolean;
  transformerNotation: boolean;
}

export type EffectiveMarkdownPdfCodeOptions = NormalizedMarkdownPdfCode;

export type MarkdownPdfPageChromePosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface MarkdownPdfPageChromeSlots {
  left: string;
  center: string;
  right: string;
}

export const MARKDOWN_PDF_PAGE_NUMBER_SCOPES = ["document", "body"] as const;

export type MarkdownPdfPageNumberScope = (typeof MARKDOWN_PDF_PAGE_NUMBER_SCOPES)[number];

export const MARKDOWN_PDF_PAGE_NUMBER_COUNT_ORIGINS = ["document", "body"] as const;

export type MarkdownPdfPageNumberCountOrigin =
  (typeof MARKDOWN_PDF_PAGE_NUMBER_COUNT_ORIGINS)[number];

export const MARKDOWN_PDF_PAGE_CHROME_FONT_WEIGHTS = [400, 500, 600, 700] as const;

export type MarkdownPdfPageChromeFontWeight =
  (typeof MARKDOWN_PDF_PAGE_CHROME_FONT_WEIGHTS)[number];

export const MARKDOWN_PDF_PAGE_CHROME_SEPARATOR_STYLES = ["solid"] as const;

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
}
