import {
  MARKDOWN_PDF_PAGE_CHROME_POSITIONS,
  MARKDOWN_PDF_PAGE_NUMBER_COUNT_ORIGINS,
  MARKDOWN_PDF_PAGE_NUMBER_SCOPES,
  normalizeMarkdownPdfProfile,
  resolveMarkdownPdfPageNumberSlot,
  type MarkdownPdfPageChromePosition,
  type NormalizedMarkdownPdfProfile,
} from "../profile";
import type { MarkdownPdfPageInformationSlotResolution } from "../profile-codex/page-information-materialization";
import type { MarkdownPdfCodexPageInformationSignal } from "../profile-codex/page-information-signals";

type PageInformationChoice = "unspecified" | "off" | "on";

/** Metadata only. Authored page text and model prose must never enter this section. */
export interface MarkdownPdfCodexReportPageInformation {
  modelResultDetails: "not-requested" | "omitted";
  pageNumbers: {
    requested: {
      choice: PageInformationChoice;
      scope?: NormalizedMarkdownPdfProfile["pageNumbers"]["scope"];
      countFrom?: NormalizedMarkdownPdfProfile["pageNumbers"]["countFrom"];
      start?: 1;
      increment?: 1;
      position?: MarkdownPdfPageChromePosition;
    };
    final?: Omit<NormalizedMarkdownPdfProfile["pageNumbers"], "format">;
  };
  repeatingContent: {
    requested: {
      choice: PageInformationChoice;
      selectedPositions?: MarkdownPdfPageChromePosition[];
    };
    final?: {
      storedPositions: MarkdownPdfPageChromePosition[];
      reservedNumberPosition?: MarkdownPdfPageChromePosition;
      reservedSlotOutcome?: "clear" | "retain";
    };
  };
}

function requestedChoice(group: { enabled: boolean } | undefined): PageInformationChoice {
  return group === undefined ? "unspecified" : group.enabled ? "on" : "off";
}

function storedPositions(profile: NormalizedMarkdownPdfProfile): MarkdownPdfPageChromePosition[] {
  return MARKDOWN_PDF_PAGE_CHROME_POSITIONS.filter((position) => {
    const { area, slot } = resolveMarkdownPdfPageNumberSlot(position);
    return Boolean((area === "header" ? profile.header : profile.footer)[slot].trim());
  });
}

export function createMarkdownPdfCodexReportPageInformation(input: {
  pageInformation?: MarkdownPdfCodexPageInformationSignal;
  finalProfile?: Record<string, unknown>;
  slotResolution?: MarkdownPdfPageInformationSlotResolution;
  modelCallAttempted?: boolean;
}): MarkdownPdfCodexReportPageInformation | undefined {
  const pageInformation = input.pageInformation;
  if (!pageInformation?.pageNumbers && !pageInformation?.repeatingContent) return undefined;

  const requestedNumbers = pageInformation.pageNumbers;
  const requestedRepeating = pageInformation.repeatingContent;
  const final = input.finalProfile
    ? normalizeMarkdownPdfProfile({ profile: input.finalProfile }).profile
    : undefined;
  const reserved = final?.pageNumbers.enabled ? final.pageNumbers.position : undefined;
  const resolution =
    reserved && input.slotResolution?.position === reserved ? input.slotResolution : undefined;

  return {
    modelResultDetails: input.modelCallAttempted ? "omitted" : "not-requested",
    pageNumbers: {
      requested: {
        choice: requestedChoice(requestedNumbers),
        ...(requestedNumbers?.enabled
          ? {
              scope: requestedNumbers.scope,
              countFrom: requestedNumbers.countFrom,
              start: 1 as const,
              increment: 1 as const,
              position: requestedNumbers.position,
            }
          : {}),
      },
      ...(final
        ? {
            final: {
              enabled: final.pageNumbers.enabled,
              scope: final.pageNumbers.scope,
              countFrom: final.pageNumbers.countFrom,
              start: final.pageNumbers.start,
              increment: final.pageNumbers.increment,
              position: final.pageNumbers.position,
            },
          }
        : {}),
    },
    repeatingContent: {
      requested: {
        choice: requestedChoice(requestedRepeating),
        ...(requestedRepeating?.enabled
          ? { selectedPositions: [...requestedRepeating.selected] }
          : {}),
      },
      ...(final
        ? {
            final: {
              storedPositions: storedPositions(final),
              ...(reserved ? { reservedNumberPosition: reserved } : {}),
              ...(resolution ? { reservedSlotOutcome: resolution.choice } : {}),
            },
          }
        : {}),
    },
  };
}

const positions = new Set<string>(MARKDOWN_PDF_PAGE_CHROME_POSITIONS);
const scopes = new Set<string>(MARKDOWN_PDF_PAGE_NUMBER_SCOPES);
const origins = new Set<string>(MARKDOWN_PDF_PAGE_NUMBER_COUNT_ORIGINS);

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Markdown PDF Codex report page-information metadata is invalid.");
  }
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, required: string[], optional: string[] = []): void {
  if (
    required.some((key) => !Object.hasOwn(value, key)) ||
    Object.keys(value).some((key) => !required.includes(key) && !optional.includes(key))
  ) {
    throw new Error("Markdown PDF Codex report page-information metadata is invalid.");
  }
}

function position(value: unknown): boolean {
  return typeof value === "string" && positions.has(value);
}

function positionsArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(position) && new Set(value).size === value.length;
}

/** Reports omit this section when no explicit page-information choice was collected. */
export function validateMarkdownPdfCodexReportPageInformation(value: unknown): void {
  if (value === undefined) return;
  const section = object(value);
  keys(section, ["modelResultDetails", "pageNumbers", "repeatingContent"]);
  if (section.modelResultDetails !== "not-requested" && section.modelResultDetails !== "omitted") {
    throw new Error("Markdown PDF Codex report page-information model status is invalid.");
  }
  const numbers = object(section.pageNumbers);
  keys(numbers, ["requested"], ["final"]);
  const requestedNumbers = object(numbers.requested);
  keys(requestedNumbers, ["choice"], ["scope", "countFrom", "start", "increment", "position"]);
  if (
    requestedNumbers.choice !== "unspecified" &&
    requestedNumbers.choice !== "off" &&
    requestedNumbers.choice !== "on"
  ) {
    throw new Error("Markdown PDF Codex report page-information number choice is invalid.");
  }
  if (requestedNumbers.choice === "on") {
    if (
      !scopes.has(String(requestedNumbers.scope)) ||
      !origins.has(String(requestedNumbers.countFrom)) ||
      requestedNumbers.start !== 1 ||
      requestedNumbers.increment !== 1 ||
      !position(requestedNumbers.position)
    ) {
      throw new Error("Markdown PDF Codex report page-information number request is invalid.");
    }
  } else if (Object.keys(requestedNumbers).length !== 1) {
    throw new Error("Markdown PDF Codex report page-information number request is invalid.");
  }
  if (numbers.final !== undefined) {
    const finalNumbers = object(numbers.final);
    keys(finalNumbers, ["enabled", "scope", "countFrom", "start", "increment", "position"]);
    if (
      typeof finalNumbers.enabled !== "boolean" ||
      !scopes.has(String(finalNumbers.scope)) ||
      !origins.has(String(finalNumbers.countFrom)) ||
      !Number.isSafeInteger(finalNumbers.start) ||
      (finalNumbers.start as number) < 0 ||
      !Number.isSafeInteger(finalNumbers.increment) ||
      (finalNumbers.increment as number) < 1 ||
      !position(finalNumbers.position)
    ) {
      throw new Error("Markdown PDF Codex report page-information final numbers are invalid.");
    }
  }
  const repeating = object(section.repeatingContent);
  keys(repeating, ["requested"], ["final"]);
  if ((numbers.final === undefined) !== (repeating.final === undefined)) {
    throw new Error("Markdown PDF Codex report page-information final metadata is incomplete.");
  }
  const requestedRepeating = object(repeating.requested);
  keys(requestedRepeating, ["choice"], ["selectedPositions"]);
  if (
    requestedRepeating.choice !== "unspecified" &&
    requestedRepeating.choice !== "off" &&
    requestedRepeating.choice !== "on"
  ) {
    throw new Error("Markdown PDF Codex report page-information repeating choice is invalid.");
  }
  if (requestedRepeating.choice === "on") {
    if (!positionsArray(requestedRepeating.selectedPositions)) {
      throw new Error("Markdown PDF Codex report page-information selected positions are invalid.");
    }
  } else if (Object.keys(requestedRepeating).length !== 1) {
    throw new Error("Markdown PDF Codex report page-information repeating request is invalid.");
  }
  if (requestedNumbers.choice === "unspecified" && requestedRepeating.choice === "unspecified") {
    throw new Error("Markdown PDF Codex report page-information has no explicit group.");
  }
  if (repeating.final !== undefined) {
    const finalRepeating = object(repeating.final);
    keys(finalRepeating, ["storedPositions"], ["reservedNumberPosition", "reservedSlotOutcome"]);
    if (
      !positionsArray(finalRepeating.storedPositions) ||
      (finalRepeating.reservedNumberPosition !== undefined &&
        !position(finalRepeating.reservedNumberPosition)) ||
      (finalRepeating.reservedSlotOutcome !== undefined &&
        ((finalRepeating.reservedSlotOutcome !== "clear" &&
          finalRepeating.reservedSlotOutcome !== "retain") ||
          finalRepeating.reservedNumberPosition === undefined))
    ) {
      throw new Error("Markdown PDF Codex report page-information final positions are invalid.");
    }
    const finalNumberEnabled =
      numbers.final === undefined ? undefined : object(numbers.final).enabled;
    if (
      (finalRepeating.reservedNumberPosition !== undefined && finalNumberEnabled !== true) ||
      (finalNumberEnabled === true &&
        finalRepeating.reservedNumberPosition !== object(numbers.final).position) ||
      (finalRepeating.reservedSlotOutcome === "retain" &&
        !(finalRepeating.storedPositions as MarkdownPdfPageChromePosition[]).includes(
          finalRepeating.reservedNumberPosition as MarkdownPdfPageChromePosition,
        )) ||
      (finalRepeating.reservedSlotOutcome === "clear" &&
        (finalRepeating.storedPositions as MarkdownPdfPageChromePosition[]).includes(
          finalRepeating.reservedNumberPosition as MarkdownPdfPageChromePosition,
        ))
    ) {
      throw new Error(
        "Markdown PDF Codex report page-information final positions are inconsistent.",
      );
    }
  }
}
