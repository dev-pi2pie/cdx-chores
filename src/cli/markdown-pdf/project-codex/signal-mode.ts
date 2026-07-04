import {
  classifyMarkdownPdfProfileCodexSignalMode,
  executionModeForMarkdownPdfProfileCodexSignalMode,
} from "../profile-codex/signal-mode";
import type { MarkdownPdfTemplateCodexRecipeSignals } from "../template-codex/types";
import type {
  MarkdownPdfProjectCodexProfilePhaseSignalMode,
  MarkdownPdfProjectCodexTemplatePhaseSignalMode,
} from "./types-phase";
import type { MarkdownPdfProjectCodexSignalMode } from "./types-modes";
import type {
  MarkdownPdfProjectCodexTemplateOwnedIntentDirection,
  MarkdownPdfProjectCodexTemplateOwnedSignals,
} from "./types-signals";

export interface MdPdfProjectCodexSignalFacts {
  hasBaseProfile: boolean;
  hasCoverImage: boolean;
  hasFontHints: boolean;
  hasInput: boolean;
  hasIntent: boolean;
  templateOwnedSignals: Pick<MarkdownPdfProjectCodexTemplateOwnedSignals, "requiresCodex">;
}

export interface MdPdfProjectCodexClassifiedSignalModes {
  profileSignalMode: MarkdownPdfProjectCodexProfilePhaseSignalMode;
  signalMode: MarkdownPdfProjectCodexSignalMode;
  templateSignalMode: MarkdownPdfProjectCodexTemplatePhaseSignalMode;
}

const TEMPLATE_OWNED_INTENT_PATTERNS: Array<{
  label: MarkdownPdfProjectCodexTemplateOwnedIntentDirection;
  pattern: RegExp;
}> = [
  { label: "custom-html-css-intent", pattern: /\b(?:custom\s+)?(?:html|css)\b/iu },
  { label: "cover-composition-intent", pattern: /\b(?:cover|hero|title\s+page)\b/iu },
  { label: "brand-styling-intent", pattern: /\b(?:brand|branding|visual|design|theme)\b/iu },
  { label: "table-layout-intent", pattern: /\b(?:wide|dense|complex)?\s*tables?\b/iu },
];

export function collectTemplateOwnedProjectDirections(input: {
  intent?: string;
  recipe: MarkdownPdfTemplateCodexRecipeSignals;
}): MarkdownPdfProjectCodexTemplateOwnedSignals {
  const intent = input.intent ?? "";
  const intentDirections: MarkdownPdfProjectCodexTemplateOwnedIntentDirection[] =
    TEMPLATE_OWNED_INTENT_PATTERNS.filter(({ pattern }) => pattern.test(intent)).map(
      ({ label }) => label,
    );
  const documentDirections =
    input.recipe.layoutPolicy.tableLayoutSignal.level === "strong"
      ? ([
          "wide-table-document-signal",
          ...input.recipe.layoutPolicy.tableLayoutSignal.templateOnlyDirections,
        ] satisfies MarkdownPdfProjectCodexTemplateOwnedSignals["documentDirections"])
      : [];
  const requiresCodex = intentDirections.length > 0 || documentDirections.length > 0;

  return {
    documentDirections,
    intentDirections,
    requiresCodex,
  };
}

export function classifyMdPdfProjectCodexProfileSignalMode(input: {
  hasBaseProfile: boolean;
  hasFontHints: boolean;
  hasInput: boolean;
  hasIntent: boolean;
}): MarkdownPdfProjectCodexProfilePhaseSignalMode {
  return classifyMarkdownPdfProfileCodexSignalMode(input);
}

export function classifyMdPdfProjectCodexTemplateSignalMode(input: {
  hasBaseProfile: boolean;
  hasCoverImage: boolean;
  templateOwnedSignals: Pick<MarkdownPdfProjectCodexTemplateOwnedSignals, "requiresCodex">;
}): MarkdownPdfProjectCodexTemplatePhaseSignalMode {
  if (input.templateOwnedSignals.requiresCodex) {
    return "codex-assisted";
  }
  if (input.hasCoverImage && !input.hasBaseProfile) {
    return "cover-image-only";
  }
  if (input.hasBaseProfile && !input.hasCoverImage) {
    return "base-profile-only";
  }
  return "deterministic";
}

export function classifyMdPdfProjectCodexSignalModes(
  input: MdPdfProjectCodexSignalFacts,
): MdPdfProjectCodexClassifiedSignalModes {
  const profileSignalMode = classifyMdPdfProjectCodexProfileSignalMode(input);
  const templateSignalMode = classifyMdPdfProjectCodexTemplateSignalMode(input);
  const signalMode = classifyMdPdfProjectCodexSignalMode({
    ...input,
    profileSignalMode,
    templateSignalMode,
  });

  return {
    profileSignalMode,
    signalMode,
    templateSignalMode,
  };
}

export function classifyMdPdfProjectCodexSignalMode(input: {
  hasBaseProfile: boolean;
  hasCoverImage: boolean;
  hasFontHints: boolean;
  hasInput: boolean;
  hasIntent: boolean;
  profileSignalMode: MarkdownPdfProjectCodexProfilePhaseSignalMode;
  templateSignalMode: MarkdownPdfProjectCodexTemplatePhaseSignalMode;
}): MarkdownPdfProjectCodexSignalMode {
  const hasAnySignal =
    input.hasBaseProfile ||
    input.hasCoverImage ||
    input.hasFontHints ||
    input.hasInput ||
    input.hasIntent;
  if (!hasAnySignal) {
    return "too-low-signal";
  }
  if (
    executionModeForMarkdownPdfProfileCodexSignalMode(input.profileSignalMode) ===
      "codex-assisted" ||
    input.templateSignalMode === "codex-assisted"
  ) {
    return "codex-assisted";
  }
  return "deterministic";
}
