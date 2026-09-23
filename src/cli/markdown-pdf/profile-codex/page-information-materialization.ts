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
  const conflictingText =
    explicitText ?? (repeating?.enabled === false ? undefined : candidateText);
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
  } else if (reserved && hasConflict && resolution?.choice === "clear") {
    setSlotText(header, footer, reserved, "");
  }

  const finalProfile = {
    ...input.profile,
    ...(numbers ? { pageNumbers } : {}),
    ...(repeating || (reserved && hasConflict && resolution?.choice === "clear")
      ? { header, footer }
      : {}),
  };
  // Normalization verifies the final combination while keeping unrelated fields intact.
  normalizeMarkdownPdfProfile({ profile: finalProfile });
  return finalProfile;
}
