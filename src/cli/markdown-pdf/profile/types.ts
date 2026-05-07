import type { NormalizeMarkdownPdfOptionsInput } from "../validation";

export type MarkdownPdfProfileFormat = "json" | "yaml";

export type MarkdownPdfMetadata = Record<string, string>;

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

export interface NormalizedMarkdownPdfProfile {
  metadata: MarkdownPdfMetadata;
  header: MarkdownPdfPageChromeSlots;
  footer: MarkdownPdfPageChromeSlots;
  pageNumbers: NormalizedMarkdownPdfPageNumbers;
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
