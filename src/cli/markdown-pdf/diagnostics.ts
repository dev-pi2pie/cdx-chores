import type {
  MarkdownPdfProfileRevisionAssessment,
  NormalizedMarkdownPdfPageNumbers,
  NormalizedMarkdownPdfProfile,
} from "./profile";
import { resolveMarkdownPdfPageNumberSlot } from "./profile";
import type { MarkdownPdfTemplateCompatibilityResult } from "./template-compatibility";

export const MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS = {
  occupiedPageNumberSlot: "MARKDOWN_PDF_PAGE_NUMBER_SLOT_OCCUPIED",
  physicalPageTotalWithLogicalSequence: "MARKDOWN_PDF_PHYSICAL_PAGE_TOTAL_WITH_LOGICAL_SEQUENCE",
  legacyBodyVisibilityFallback: "MARKDOWN_PDF_LEGACY_BODY_VISIBILITY_FALLBACK",
  rendererCapabilityMissing: "MARKDOWN_PDF_RENDERER_CAPABILITY_MISSING",
  rendererCapabilityUnsupported: "MARKDOWN_PDF_RENDERER_CAPABILITY_UNSUPPORTED",
  rendererCapabilityUnverified: "MARKDOWN_PDF_RENDERER_CAPABILITY_UNVERIFIED",
  rendererCapabilityProbeFailed: "MARKDOWN_PDF_RENDERER_CAPABILITY_PROBE_FAILED",
  rendererCapabilityUnknown: "MARKDOWN_PDF_RENDERER_CAPABILITY_UNKNOWN",
  profileSchemaVersionInvalid: "MARKDOWN_PDF_PROFILE_SCHEMA_VERSION_INVALID",
  profileSchemaVersionStale: "MARKDOWN_PDF_PROFILE_SCHEMA_VERSION_STALE",
  profileSchemaVersionForward: "MARKDOWN_PDF_PROFILE_SCHEMA_VERSION_FORWARD",
} as const;

export type MarkdownPdfDiagnosticConditionId =
  (typeof MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS)[keyof typeof MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS];

export type MarkdownPdfWarningConditionId =
  | typeof MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.occupiedPageNumberSlot
  | typeof MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.physicalPageTotalWithLogicalSequence
  | typeof MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.legacyBodyVisibilityFallback
  | typeof MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.profileSchemaVersionInvalid
  | typeof MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.profileSchemaVersionStale
  | typeof MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.profileSchemaVersionForward;

export const MARKDOWN_PDF_LEGACY_BODY_VISIBILITY_WARNING =
  "Selected legacy Markdown PDF template has no provable .document-body boundary; body-scoped page-number visibility will use document-origin fallback behavior.";

export interface MarkdownPdfDiagnostic {
  conditionId: MarkdownPdfWarningConditionId;
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
      }
    | {
        kind: "profile-schema-version";
        state: "forward" | "invalid" | "stale";
        declaredRevision?: number;
        inferredRevision: number;
        currentRevision: number;
      };
}

export interface MarkdownPdfDiagnostics {
  conditions: MarkdownPdfDiagnostic[];
}

function profileRevisionDiagnostic(
  assessment: MarkdownPdfProfileRevisionAssessment | undefined,
): MarkdownPdfDiagnostic | undefined {
  if (!assessment || assessment.state === "missing" || assessment.state === "supported") {
    return undefined;
  }

  const context = {
    kind: "profile-schema-version" as const,
    state: assessment.state,
    ...(assessment.declaredRevision === undefined
      ? {}
      : { declaredRevision: assessment.declaredRevision }),
    inferredRevision: assessment.inferredRevision,
    currentRevision: assessment.currentRevision,
  };

  if (assessment.state === "invalid") {
    return {
      conditionId: MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.profileSchemaVersionInvalid,
      severity: "warning",
      message: `Profile schemaVersion is unusable; inferred Profile revision is ${assessment.inferredRevision} and current revision is ${assessment.currentRevision}. Supported Profile content will continue to render.`,
      context,
    };
  }
  if (assessment.state === "stale") {
    return {
      conditionId: MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.profileSchemaVersionStale,
      severity: "warning",
      message: `Profile schemaVersion ${assessment.declaredRevision} is below inferred Profile revision ${assessment.inferredRevision}. Supported Profile content will continue to render.`,
      context,
    };
  }
  return {
    conditionId: MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.profileSchemaVersionForward,
    severity: "warning",
    message: `Profile schemaVersion ${assessment.declaredRevision} is newer than current Profile revision ${assessment.currentRevision}. Supported Profile content will continue to render.`,
    context,
  };
}

export function collectMarkdownPdfOccupiedPageNumberSlotDiagnostic(input: {
  profile: NormalizedMarkdownPdfProfile;
  pageNumbers: NormalizedMarkdownPdfPageNumbers;
}): MarkdownPdfDiagnostic | undefined {
  if (!input.pageNumbers.enabled) {
    return undefined;
  }

  const target = resolveMarkdownPdfPageNumberSlot(input.pageNumbers.position);
  if (input.profile[target.area][target.slot].trim().length === 0) {
    return undefined;
  }

  return {
    conditionId: MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.occupiedPageNumberSlot,
    severity: "warning",
    message: `Page numbers at ${input.pageNumbers.position} replace configured ${target.area}.${target.slot} content for this render.`,
    context: {
      kind: "occupied-page-number-slot",
      position: input.pageNumbers.position,
      ...target,
    },
  };
}

export function collectMarkdownPdfDiagnostics(input: {
  profile: NormalizedMarkdownPdfProfile;
  profileRevision?: MarkdownPdfProfileRevisionAssessment;
  pageNumbers: NormalizedMarkdownPdfPageNumbers;
  templateCompatibility: MarkdownPdfTemplateCompatibilityResult;
}): MarkdownPdfDiagnostics {
  const conditions: MarkdownPdfDiagnostic[] = [];
  const revisionDiagnostic = profileRevisionDiagnostic(input.profileRevision);
  if (revisionDiagnostic) {
    conditions.push(revisionDiagnostic);
  }

  if (!input.pageNumbers.enabled) {
    return { conditions };
  }

  const occupiedSlot = collectMarkdownPdfOccupiedPageNumberSlotDiagnostic(input);
  if (occupiedSlot) {
    conditions.push(occupiedSlot);
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
