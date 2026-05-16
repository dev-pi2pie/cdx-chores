import type { NormalizeMarkdownPdfOptionsInput } from "../validation";

export type MarkdownPdfProfileFormat = "json" | "yaml";

export type MarkdownPdfMetadata = Record<string, string>;

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

export interface NormalizedMarkdownPdfPageNumbers {
  enabled: boolean;
  position: MarkdownPdfPageChromePosition;
  format: string;
  scope: "body";
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
  metadata: MarkdownPdfMetadata;
  code: NormalizedMarkdownPdfCode;
  header: MarkdownPdfPageChromeSlots;
  footer: MarkdownPdfPageChromeSlots;
  pageNumbers: NormalizedMarkdownPdfPageNumbers;
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
