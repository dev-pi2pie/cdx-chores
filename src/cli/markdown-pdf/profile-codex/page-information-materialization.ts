import {
  MARKDOWN_PDF_PAGE_CHROME_POSITIONS,
  normalizeMarkdownPdfProfile,
  resolveMarkdownPdfPageNumberSlot,
  type MarkdownPdfPageChromePosition,
  type NormalizedMarkdownPdfPageChromeArea,
} from "../profile";
import type { MarkdownPdfCodexPageInformationSignal } from "./page-information-signals";

export interface MarkdownPdfPageInformationSlotResolution {
  position: MarkdownPdfPageChromePosition;
  choice: "clear" | "retain";
  /** Bind the choice to the exact content seen during revision. */
  conflictingText: string;
}

export class MarkdownPdfPageInformationConflictError extends Error {
  readonly position: MarkdownPdfPageChromePosition;
  readonly text: string;
  readonly source: "explicit" | "candidate";

  constructor(input: {
    position: MarkdownPdfPageChromePosition;
    text: string;
    source: "explicit" | "candidate";
  }) {
    super(`Page numbering conflicts with repeating content at ${input.position}.`);
    this.name = "MarkdownPdfPageInformationConflictError";
    this.position = input.position;
    this.text = input.text;
    this.source = input.source;
  }
}

function slotText(
  header: NormalizedMarkdownPdfPageChromeArea,
  footer: NormalizedMarkdownPdfPageChromeArea,
  position: MarkdownPdfPageChromePosition,
): string {
  const { area, slot } = resolveMarkdownPdfPageNumberSlot(position);
  return area === "header" ? header[slot] : footer[slot];
}

function setSlotText(
  header: NormalizedMarkdownPdfPageChromeArea,
  footer: NormalizedMarkdownPdfPageChromeArea,
  position: MarkdownPdfPageChromePosition,
  text: string,
): void {
  const { area, slot } = resolveMarkdownPdfPageNumberSlot(position);
  if (area === "header") header[slot] = text;
  else footer[slot] = text;
}

/** Apply Interactive authority after the base/Codex decision, before any consumer sees the Profile. */
export function applyMarkdownPdfCodexPageInformation(input: {
  profile: Record<string, unknown>;
  baseProfile?: Record<string, unknown>;
  pageInformation?: MarkdownPdfCodexPageInformationSignal;
  slotResolution?: MarkdownPdfPageInformationSlotResolution;
}): Record<string, unknown> {
  if (!input.pageInformation) return input.profile;

  const current = normalizeMarkdownPdfProfile({ profile: input.profile }).profile;
  const numbers = input.pageInformation.pageNumbers;
  const repeating = input.pageInformation.repeatingContent;
  const pageNumbers = numbers?.enabled
    ? { ...numbers }
    : numbers
      ? { ...current.pageNumbers, enabled: false }
      : current.pageNumbers;
  const header = { ...current.header };
  const footer = { ...current.footer };
  const reserved = pageNumbers.enabled ? pageNumbers.position : undefined;
  const explicitText =
    reserved && repeating?.enabled && repeating.selected.includes(reserved)
      ? repeating.text[reserved]
      : undefined;
  const candidateText = reserved ? slotText(header, footer, reserved) : undefined;
  const currentBase = input.baseProfile
    ? normalizeMarkdownPdfProfile({ profile: input.baseProfile }).profile
    : undefined;
  const baseText =
    reserved && currentBase
      ? slotText(currentBase.header, currentBase.footer, reserved)
      : undefined;
  const reviewedRetainedText =
    reserved &&
    repeating?.enabled !== false &&
    input.slotResolution?.position === reserved &&
    input.slotResolution.choice === "retain" &&
    !candidateText?.trim()
      ? baseText
      : undefined;
  const conflictingText =
    explicitText ??
    (repeating?.enabled === false
      ? undefined
      : candidateText?.trim()
        ? candidateText
        : reviewedRetainedText);
  const hasConflict = Boolean(reserved && conflictingText?.trim());
  const resolution = input.slotResolution;

  if (hasConflict && reserved && conflictingText !== undefined) {
    if (explicitText !== undefined) {
      throw new MarkdownPdfPageInformationConflictError({
        position: reserved,
        text: explicitText,
        source: "explicit",
      });
    }
    if (resolution?.position !== reserved || resolution.conflictingText !== conflictingText) {
      throw new MarkdownPdfPageInformationConflictError({
        position: reserved,
        text: conflictingText,
        source: "candidate",
      });
    }
  }

  if (repeating) {
    for (const position of MARKDOWN_PDF_PAGE_CHROME_POSITIONS) {
      const selectedText =
        repeating.enabled && repeating.selected.includes(position)
          ? repeating.text[position]
          : undefined;
      const retainedText =
        repeating.enabled && position === reserved && hasConflict && resolution?.choice === "retain"
          ? conflictingText
          : undefined;
      setSlotText(header, footer, position, selectedText ?? retainedText ?? "");
    }
  } else if (reserved && hasConflict && resolution) {
    setSlotText(
      header,
      footer,
      reserved,
      resolution.choice === "retain" ? (conflictingText ?? "") : "",
    );
  }

  const finalProfile = {
    ...input.profile,
    ...(numbers ? { pageNumbers } : {}),
    ...(repeating || (reserved && hasConflict && resolution) ? { header, footer } : {}),
  };
  // Validate via normalization, then keep the source-shaped recipe and exact authored text.
  normalizeMarkdownPdfProfile({ profile: finalProfile });
  return finalProfile;
}
