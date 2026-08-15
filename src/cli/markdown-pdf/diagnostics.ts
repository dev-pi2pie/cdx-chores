import type {
  MarkdownPdfProfileRevisionAssessment,
  NormalizedMarkdownPdfPageNumbers,
  NormalizedMarkdownPdfProfile,
} from "./profile";
import {
  assessMarkdownPdfCoverVisibility,
  markdownPdfPageNumberFormatTokens,
  resolveMarkdownPdfPageNumberSlot,
} from "./profile";
import type { MarkdownPdfTemplateCompatibilityResult } from "./template-compatibility";

export const MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS = {
  occupiedPageNumberSlot: "MARKDOWN_PDF_PAGE_NUMBER_SLOT_OCCUPIED",
  legacyPagesTokenMigration: "MARKDOWN_PDF_LEGACY_PAGES_TOKEN_MIGRATION",
  legacyBodyVisibilityFallback: "MARKDOWN_PDF_LEGACY_BODY_VISIBILITY_FALLBACK",
  rendererCapabilityMissing: "MARKDOWN_PDF_RENDERER_CAPABILITY_MISSING",
  rendererCapabilityUnsupported: "MARKDOWN_PDF_RENDERER_CAPABILITY_UNSUPPORTED",
  rendererCapabilityUnverified: "MARKDOWN_PDF_RENDERER_CAPABILITY_UNVERIFIED",
  rendererCapabilityProbeFailed: "MARKDOWN_PDF_RENDERER_CAPABILITY_PROBE_FAILED",
  rendererCapabilityUnknown: "MARKDOWN_PDF_RENDERER_CAPABILITY_UNKNOWN",
  profileSchemaVersionInvalid: "MARKDOWN_PDF_PROFILE_SCHEMA_VERSION_INVALID",
  profileSchemaVersionStale: "MARKDOWN_PDF_PROFILE_SCHEMA_VERSION_STALE",
  profileSchemaVersionForward: "MARKDOWN_PDF_PROFILE_SCHEMA_VERSION_FORWARD",
  coverFieldsEmpty: "MARKDOWN_PDF_COVER_FIELDS_EMPTY",
  coverDefaultCssDisabled: "MARKDOWN_PDF_COVER_DEFAULT_CSS_DISABLED",
} as const;

export type MarkdownPdfDiagnosticConditionId =
  (typeof MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS)[keyof typeof MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS];

export type MarkdownPdfWarningConditionId =
  | typeof MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.occupiedPageNumberSlot
  | typeof MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.legacyPagesTokenMigration
  | typeof MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.legacyBodyVisibilityFallback
  | typeof MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.profileSchemaVersionInvalid
  | typeof MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.profileSchemaVersionStale
  | typeof MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.profileSchemaVersionForward
  | typeof MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.coverFieldsEmpty
  | typeof MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.coverDefaultCssDisabled;

export const MARKDOWN_PDF_LEGACY_BODY_VISIBILITY_WARNING =
  "Selected legacy Markdown PDF template has no provable .document-body boundary; body-scoped page-number visibility will use document-origin fallback behavior.";

export const MARKDOWN_PDF_EMPTY_COVER_WARNING =
  "The cover page is enabled, but its configured fields resolve to no visible metadata. The PDF may contain an empty cover page. Add title, subtitle, author, company, or date metadata; customize cover.fields; or disable the cover page.";

export const MARKDOWN_PDF_COVER_DEFAULT_CSS_DISABLED_WARNING =
  "The cover page is enabled with --no-default-css. Custom CSS owns the cover page break, layout, and header, footer, and page-number reset for this render.";

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
        kind: "legacy-pages-token-migration";
        countFrom: NormalizedMarkdownPdfPageNumbers["countFrom"];
        declaredRevision: 1 | 2;
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
      }
    | {
        kind: "empty-cover-fields";
      }
    | {
        kind: "cover-default-css-disabled";
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

export function collectMarkdownPdfEmptyCoverDiagnostic(
  profile: NormalizedMarkdownPdfProfile,
): MarkdownPdfDiagnostic | undefined {
  if (!profile.cover.enabled || assessMarkdownPdfCoverVisibility(profile).hasVisibleMetadata) {
    return undefined;
  }
  return {
    conditionId: MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.coverFieldsEmpty,
    severity: "warning",
    message: MARKDOWN_PDF_EMPTY_COVER_WARNING,
    context: { kind: "empty-cover-fields" },
  };
}

export function collectMarkdownPdfCoverDefaultCssDisabledDiagnostic(input: {
  noDefaultCss?: boolean;
  profile: NormalizedMarkdownPdfProfile;
}): MarkdownPdfDiagnostic | undefined {
  if (!input.profile.cover.enabled || input.noDefaultCss !== true) {
    return undefined;
  }
  return {
    conditionId: MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.coverDefaultCssDisabled,
    severity: "warning",
    message: MARKDOWN_PDF_COVER_DEFAULT_CSS_DISABLED_WARNING,
    context: { kind: "cover-default-css-disabled" },
  };
}

export function collectMarkdownPdfDiagnostics(input: {
  profile: NormalizedMarkdownPdfProfile;
  profileRevision?: MarkdownPdfProfileRevisionAssessment;
  pageNumbers: NormalizedMarkdownPdfPageNumbers;
  templateCompatibility: MarkdownPdfTemplateCompatibilityResult;
  noDefaultCss?: boolean;
}): MarkdownPdfDiagnostics {
  const conditions: MarkdownPdfDiagnostic[] = [];
  const revisionDiagnostic = profileRevisionDiagnostic(input.profileRevision);
  if (revisionDiagnostic) {
    conditions.push(revisionDiagnostic);
  }

  const emptyCover = collectMarkdownPdfEmptyCoverDiagnostic(input.profile);
  if (emptyCover) {
    conditions.push(emptyCover);
  }

  const coverDefaultCssDisabled = collectMarkdownPdfCoverDefaultCssDisabledDiagnostic(input);
  if (coverDefaultCssDisabled) {
    conditions.push(coverDefaultCssDisabled);
  }

  if (!input.pageNumbers.enabled) {
    return { conditions };
  }

  const occupiedSlot = collectMarkdownPdfOccupiedPageNumberSlotDiagnostic(input);
  if (occupiedSlot) {
    conditions.push(occupiedSlot);
  }

  const declaredRevision = input.profileRevision?.declaredRevision;
  if (
    (declaredRevision === 1 || declaredRevision === 2) &&
    markdownPdfPageNumberFormatTokens(input.pageNumbers.format).includes("pages")
  ) {
    conditions.push({
      conditionId: MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.legacyPagesTokenMigration,
      severity: "warning",
      message: `This Profile declares schemaVersion ${declaredRevision}. {pages} now means the final logical page number for countFrom: ${input.pageNumbers.countFrom}. To show the rendered PDF page count, replace {pages} with {pdfPages}.`,
      context: {
        kind: "legacy-pages-token-migration",
        countFrom: input.pageNumbers.countFrom,
        declaredRevision,
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
