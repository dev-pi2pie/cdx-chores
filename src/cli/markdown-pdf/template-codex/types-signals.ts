import type { MarkdownPdfDocumentSignals, MarkdownPdfFontSignals } from "../profile/signals";
import type { MarkdownPdfTableLayoutSignal } from "../profile/layout-policy";
import type { MarkdownPdfProfileCandidateSummary } from "../profile/candidates";
import type {
  MdPdfTemplateCodexExplicitRecipeSignal,
  MarkdownPdfTemplateCodexSignalMode,
} from "./types-command";
import type { NormalizedMarkdownPdfOptions } from "../validation";

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

export interface MarkdownPdfTemplateCodexRecipeSignals {
  effectiveOptions: NormalizedMarkdownPdfOptions;
  explicitFields: string[];
  baseProfileFields: string[];
  layoutPolicy: MarkdownPdfTemplateCodexLayoutPolicySignal;
}

export interface MarkdownPdfTemplateCodexLayoutPolicySignal {
  tableLayoutSignal: MarkdownPdfTableLayoutSignal;
  recipePreset: {
    status: "applied" | "blocked" | "not-needed";
    source: "document-table-signal";
    preset?: NormalizedMarkdownPdfOptions["preset"];
    blockedBy?: "explicit-recipe" | "base-profile";
    reason: string;
  };
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

export type { MdPdfTemplateCodexExplicitRecipeSignal };
