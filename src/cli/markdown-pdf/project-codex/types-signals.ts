import type { MarkdownPdfProfileCandidate } from "../profile/candidates";
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
  normalizedProfile: NormalizedMarkdownPdfProfile;
}

export interface MarkdownPdfProjectCodexTemplateOwnedSignals {
  documentDirections: string[];
  forwardedProfileDirections: string[];
  intentDirections: string[];
  requiresCodex: boolean;
}

export interface MarkdownPdfProjectCodexFontSignals {
  hints: string[];
  profileFonts: MarkdownPdfFontSignals;
}

export interface MdPdfProjectCodexSignalCollection {
  signalMode: MarkdownPdfProjectCodexSignalMode;
  profileSignalMode: MarkdownPdfProjectCodexProfilePhaseSignalMode;
  templateSignalMode: MarkdownPdfProjectCodexTemplatePhaseSignalMode;
  documentSignals: MarkdownPdfDocumentSignals;
  baseProfile: MarkdownPdfProjectCodexBaseProfileSignals;
  recipe: MarkdownPdfTemplateCodexRecipeSignals;
  title: MarkdownPdfTemplateCodexTitleSignals;
  fonts: MarkdownPdfProjectCodexFontSignals;
  coverImage: MarkdownPdfTemplateCodexCoverImageSignals;
  templateOwnedSignals: MarkdownPdfProjectCodexTemplateOwnedSignals;
}
