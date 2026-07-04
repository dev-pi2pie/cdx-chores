import type { MarkdownPdfProfileCandidate } from "../profile/candidates";
import type { MarkdownPdfTableTemplateOnlyDirection } from "../profile/layout-policy";
import type { MarkdownPdfDocumentSignals, MarkdownPdfFontSignals } from "../profile/signals";
import type { NormalizedMarkdownPdfProfile } from "../profile/types";
import type {
  MarkdownPdfTemplateCodexCoverImageSignals,
  MarkdownPdfTemplateCodexRecipeSignals,
  MarkdownPdfTemplateCodexTitleSignals,
} from "../template-codex/types";
import type {
  MarkdownPdfProjectCodexProfilePhaseSignalMode,
  MarkdownPdfProjectCodexTemplatePhaseSignalMode,
} from "./types-phase";
import type { MarkdownPdfProjectCodexSignalMode } from "./types-modes";

export interface MarkdownPdfProjectCodexBaseProfileSignals {
  available: boolean;
  candidate?: MarkdownPdfProfileCandidate;
}

export interface MarkdownPdfProjectCodexProfileBasisSignals {
  candidate: MarkdownPdfProfileCandidate;
  normalizedProfile: NormalizedMarkdownPdfProfile;
  source: "base-profile" | "default-profile";
}

export type MarkdownPdfProjectCodexTemplateOwnedIntentDirection =
  | "custom-html-css-intent"
  | "cover-composition-intent"
  | "brand-styling-intent"
  | "table-layout-intent";

export type MarkdownPdfProjectCodexTemplateOwnedDocumentDirection =
  | "wide-table-document-signal"
  | MarkdownPdfTableTemplateOnlyDirection;

export interface MarkdownPdfProjectCodexTemplateOwnedSignals {
  documentDirections: MarkdownPdfProjectCodexTemplateOwnedDocumentDirection[];
  intentDirections: MarkdownPdfProjectCodexTemplateOwnedIntentDirection[];
  requiresCodex: boolean;
}

export interface MarkdownPdfProjectCodexFontSignals {
  hints: string[];
  profileFonts: MarkdownPdfFontSignals;
}

export interface MdPdfProjectCodexSignalModes {
  profile: MarkdownPdfProjectCodexProfilePhaseSignalMode;
  project: MarkdownPdfProjectCodexSignalMode;
  template: MarkdownPdfProjectCodexTemplatePhaseSignalMode;
}

export interface MdPdfProjectCodexSharedSignals {
  document: MarkdownPdfDocumentSignals;
  recipe: MarkdownPdfTemplateCodexRecipeSignals;
  title: MarkdownPdfTemplateCodexTitleSignals;
}

export interface MdPdfProjectCodexProfileSignals {
  baseProfile: MarkdownPdfProjectCodexBaseProfileSignals;
  basis: MarkdownPdfProjectCodexProfileBasisSignals;
  fonts: MarkdownPdfProjectCodexFontSignals;
}

export interface MdPdfProjectCodexTemplateSignals {
  coverImage: MarkdownPdfTemplateCodexCoverImageSignals;
  ownedSignals: MarkdownPdfProjectCodexTemplateOwnedSignals;
}

export interface MdPdfProjectCodexSignalCollection {
  modes: MdPdfProjectCodexSignalModes;
  profile: MdPdfProjectCodexProfileSignals;
  shared: MdPdfProjectCodexSharedSignals;
  template: MdPdfProjectCodexTemplateSignals;
}
