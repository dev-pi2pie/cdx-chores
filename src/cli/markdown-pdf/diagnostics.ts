import type { NormalizedMarkdownPdfPageNumbers, NormalizedMarkdownPdfProfile } from "./profile";
import type { MarkdownPdfTemplateCompatibilityResult } from "./template-compatibility";

export const MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS = {
  occupiedPageNumberSlot: "MARKDOWN_PDF_PAGE_NUMBER_SLOT_OCCUPIED",
  physicalPageTotalWithLogicalSequence: "MARKDOWN_PDF_PHYSICAL_PAGE_TOTAL_WITH_LOGICAL_SEQUENCE",
  legacyBodyVisibilityFallback: "MARKDOWN_PDF_LEGACY_BODY_VISIBILITY_FALLBACK",
} as const;

export type MarkdownPdfDiagnosticConditionId =
  (typeof MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS)[keyof typeof MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS];

export const MARKDOWN_PDF_LEGACY_BODY_VISIBILITY_WARNING =
  "Selected legacy Markdown PDF template has no provable .document-body boundary; body-scoped page-number visibility will use document-origin fallback behavior.";

export interface MarkdownPdfDiagnostic {
  conditionId: MarkdownPdfDiagnosticConditionId;
  severity: "warning";
  message: string;
  context:
    | {
        kind: "occupied-page-number-slot";
        position: NormalizedMarkdownPdfPageNumbers["position"];
        area: "header" | "footer";
        slot: "left" | "center" | "right";
      }
    | {
        kind: "physical-page-total-with-logical-sequence";
        countFrom: NormalizedMarkdownPdfPageNumbers["countFrom"];
        start: number;
        increment: number;
      }
    | {
        kind: "legacy-body-visibility-fallback";
        bodyBoundary: "legacy-document-origin-fallback";
      };
}

export interface MarkdownPdfDiagnostics {
  conditions: MarkdownPdfDiagnostic[];
}

function pageNumberTarget(position: NormalizedMarkdownPdfPageNumbers["position"]): {
  area: "header" | "footer";
  slot: "left" | "center" | "right";
} {
  const [pageArea, slot] = position.split("-") as ["top" | "bottom", "left" | "center" | "right"];
  return { area: pageArea === "top" ? "header" : "footer", slot };
}

export function collectMarkdownPdfDiagnostics(input: {
  profile: NormalizedMarkdownPdfProfile;
  pageNumbers: NormalizedMarkdownPdfPageNumbers;
  templateCompatibility: MarkdownPdfTemplateCompatibilityResult;
}): MarkdownPdfDiagnostics {
  if (!input.pageNumbers.enabled) {
    return { conditions: [] };
  }

  const conditions: MarkdownPdfDiagnostic[] = [];
  const target = pageNumberTarget(input.pageNumbers.position);
  if (input.profile[target.area][target.slot].trim().length > 0) {
    conditions.push({
      conditionId: MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.occupiedPageNumberSlot,
      severity: "warning",
      message: `Page numbers at ${input.pageNumbers.position} replace configured ${target.area}.${target.slot} content for this render.`,
      context: {
        kind: "occupied-page-number-slot",
        position: input.pageNumbers.position,
        ...target,
      },
    });
  }

  if (
    input.pageNumbers.format.includes("{pages}") &&
    (input.pageNumbers.start !== 1 ||
      input.pageNumbers.increment !== 1 ||
      input.pageNumbers.countFrom === "body")
  ) {
    conditions.push({
      conditionId: MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.physicalPageTotalWithLogicalSequence,
      severity: "warning",
      message:
        "The {pages} placeholder remains the physical PDF page count when page-number arithmetic or body-origin numbering changes the logical sequence.",
      context: {
        kind: "physical-page-total-with-logical-sequence",
        countFrom: input.pageNumbers.countFrom,
        start: input.pageNumbers.start,
        increment: input.pageNumbers.increment,
      },
    });
  }

  if (input.templateCompatibility.bodyBoundary === "legacy-document-origin-fallback") {
    conditions.push({
      conditionId: MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.legacyBodyVisibilityFallback,
      severity: "warning",
      message: MARKDOWN_PDF_LEGACY_BODY_VISIBILITY_WARNING,
      context: {
        kind: "legacy-body-visibility-fallback",
        bodyBoundary: input.templateCompatibility.bodyBoundary,
      },
    });
  }

  return { conditions };
}

export function markdownPdfDiagnosticWarnings(diagnostics: MarkdownPdfDiagnostics): string[] {
  return diagnostics.conditions.map((condition) => condition.message);
}
