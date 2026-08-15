import { CliError } from "../../errors";
import type { CliRuntime } from "../../types";
import {
  MARKDOWN_PDF_PAGE_CHROME_POSITIONS,
  MARKDOWN_PDF_PAGE_NUMBER_COUNT_ORIGINS,
  normalizeMarkdownPdfProfileIdentity,
  type MarkdownPdfPageChromePosition,
} from "../profile";
import {
  MARKDOWN_PDF_RENDERER_CAPABILITY_MATRIX,
  type MarkdownPdfRendererCapabilityDefinition,
  type MarkdownPdfRendererCapabilityId,
} from "../renderer-capabilities";
import {
  isMarkdownPdfRendererCapabilityField,
  isMarkdownPdfRendererCapabilityId,
} from "../renderer-capability-contract";
import type { MdPdfProjectCodexProfilePhaseResult } from "./profile-phase";
import { createMdPdfProjectCodexRenderCommand } from "./render-command";
import { sanitizeMdPdfProjectCodexReportText } from "./report-redaction";
import type {
  MarkdownPdfProjectCodexOutputPlan,
  NormalizedMdPdfProjectCodexCommandState,
} from "./types";
import type {
  MarkdownPdfProjectCodexHandoffCapabilityRequirement,
  MarkdownPdfProjectCodexHandoffDiagnostic,
  MarkdownPdfProjectCodexHandoffProjection,
} from "./types-report";
import type { MarkdownPdfProjectCodexValidationSummary } from "./validate-project";

const PAGE_NUMBER_POSITIONS = new Set<string>(MARKDOWN_PDF_PAGE_CHROME_POSITIONS);
const PAGE_NUMBER_COUNT_ORIGINS = new Set<string>(MARKDOWN_PDF_PAGE_NUMBER_COUNT_ORIGINS);
const PAGE_CHROME_AREAS = new Set<string>(["header", "footer"]);
const PAGE_CHROME_SLOTS = new Set<string>(["left", "center", "right"]);
const CAPABILITY_DEFINITIONS = new Map<
  MarkdownPdfRendererCapabilityId,
  MarkdownPdfRendererCapabilityDefinition
>(MARKDOWN_PDF_RENDERER_CAPABILITY_MATRIX.map((definition) => [definition.id, definition]));

function invalidProjection(message: string): never {
  throw new CliError(message, { code: "INVALID_INPUT", exitCode: 2 });
}

function plainObject(value: unknown, label: string): Record<string, unknown> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return value as Record<string, unknown>;
  }
  return invalidProjection(`${label} must be a plain object.`);
}

function assertExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
  label: string,
): void {
  const actualKeys = Object.keys(value);
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => !expectedKeys.includes(key))
  ) {
    invalidProjection(`${label} contains unsupported fields.`);
  }
}

function stringValue(value: unknown, label: string): string {
  return typeof value === "string" ? value : invalidProjection(`${label} must be a string.`);
}

function enumValue(value: unknown, allowed: ReadonlySet<string>, label: string): string {
  const candidate = stringValue(value, label);
  return allowed.has(candidate)
    ? candidate
    : invalidProjection(`${label} contains an unsupported value.`);
}

function safeInteger(value: unknown, input: { label: string; minimum: number }): number {
  if (!Number.isSafeInteger(value) || (value as number) < input.minimum) {
    return invalidProjection(`${input.label} must be a bounded integer.`);
  }
  return value as number;
}

function profileIdentity(input: {
  outputPlan: MarkdownPdfProjectCodexOutputPlan;
  profilePhase: MdPdfProjectCodexProfilePhaseResult;
}): string {
  const finalProfile = plainObject(input.profilePhase.finalProfile, "final Project Profile");
  const identity = normalizeMarkdownPdfProfileIdentity(finalProfile.profile);
  if (!identity || identity.id !== input.outputPlan.identity.profileId) {
    return invalidProjection("Final Project Profile identity does not match the output plan.");
  }
  return identity.id;
}

function occupiedSlotDiagnostic(
  diagnostic: Record<string, unknown>,
): MarkdownPdfProjectCodexHandoffDiagnostic {
  const context = plainObject(diagnostic.context, "Project handoff diagnostic context");
  assertExactKeys(
    context,
    ["kind", "position", "area", "slot"],
    "Project handoff diagnostic context",
  );
  if (context.kind !== "occupied-page-number-slot") {
    return invalidProjection("Project handoff diagnostic context kind is unsupported.");
  }
  const position = enumValue(
    context.position,
    PAGE_NUMBER_POSITIONS,
    "Project handoff diagnostic position",
  ) as MarkdownPdfPageChromePosition;
  const area = enumValue(
    context.area,
    PAGE_CHROME_AREAS,
    "Project handoff diagnostic page area",
  ) as "header" | "footer";
  const slot = enumValue(
    context.slot,
    PAGE_CHROME_SLOTS,
    "Project handoff diagnostic page slot",
  ) as "left" | "center" | "right";
  const [positionArea, positionSlot] = position.split("-") as ["top" | "bottom", typeof slot];
  if ((positionArea === "top" ? "header" : "footer") !== area || positionSlot !== slot) {
    return invalidProjection("Project handoff diagnostic slot does not match its position.");
  }
  return {
    conditionId: "MARKDOWN_PDF_PAGE_NUMBER_SLOT_OCCUPIED",
    severity: "warning",
    context: { kind: context.kind, position, area, slot },
    message: sanitizeMdPdfProjectCodexReportText(
      stringValue(diagnostic.message, "Project handoff diagnostic message"),
    ),
  };
}

function legacyPagesMigrationDiagnostic(
  diagnostic: Record<string, unknown>,
): MarkdownPdfProjectCodexHandoffDiagnostic {
  const context = plainObject(diagnostic.context, "Project handoff diagnostic context");
  assertExactKeys(
    context,
    ["kind", "countFrom", "declaredRevision"],
    "Project handoff diagnostic context",
  );
  if (context.kind !== "legacy-pages-token-migration") {
    return invalidProjection("Project handoff diagnostic context kind is unsupported.");
  }
  const declaredRevision = safeInteger(context.declaredRevision, {
    label: "Project handoff declared Profile revision",
    minimum: 1,
  });
  if (declaredRevision !== 1 && declaredRevision !== 2) {
    return invalidProjection("Project handoff declared Profile revision is unsupported.");
  }
  return {
    conditionId: "MARKDOWN_PDF_LEGACY_PAGES_TOKEN_MIGRATION",
    severity: "warning",
    context: {
      kind: context.kind,
      countFrom: enumValue(
        context.countFrom,
        PAGE_NUMBER_COUNT_ORIGINS,
        "Project handoff diagnostic count origin",
      ) as "document" | "body",
      declaredRevision,
    },
    message: sanitizeMdPdfProjectCodexReportText(
      stringValue(diagnostic.message, "Project handoff diagnostic message"),
    ),
  };
}

function legacyFallbackDiagnostic(
  diagnostic: Record<string, unknown>,
): MarkdownPdfProjectCodexHandoffDiagnostic {
  const context = plainObject(diagnostic.context, "Project handoff diagnostic context");
  assertExactKeys(context, ["kind", "bodyBoundary"], "Project handoff diagnostic context");
  if (
    context.kind !== "legacy-body-visibility-fallback" ||
    context.bodyBoundary !== "legacy-document-origin-fallback"
  ) {
    return invalidProjection("Project handoff diagnostic body boundary is unsupported.");
  }
  return {
    conditionId: "MARKDOWN_PDF_LEGACY_BODY_VISIBILITY_FALLBACK",
    severity: "warning",
    context: {
      kind: context.kind,
      bodyBoundary: context.bodyBoundary,
    },
    message: sanitizeMdPdfProjectCodexReportText(
      stringValue(diagnostic.message, "Project handoff diagnostic message"),
    ),
  };
}

function missingBodyBoundaryDiagnostic(
  diagnostic: Record<string, unknown>,
): MarkdownPdfProjectCodexHandoffDiagnostic {
  const context = plainObject(diagnostic.context, "Project handoff diagnostic context");
  assertExactKeys(context, ["kind"], "Project handoff diagnostic context");
  if (context.kind !== "missing-body-boundary") {
    return invalidProjection("Project handoff diagnostic context kind is unsupported.");
  }
  return {
    conditionId: "MARKDOWN_PDF_BODY_BOUNDARY_REQUIRED",
    severity: "error",
    context: { kind: context.kind },
    message: sanitizeMdPdfProjectCodexReportText(
      stringValue(diagnostic.message, "Project handoff diagnostic message"),
    ),
  };
}

function profileRevisionDiagnostic(
  diagnostic: Record<string, unknown>,
  conditionId:
    | "MARKDOWN_PDF_PROFILE_SCHEMA_VERSION_INVALID"
    | "MARKDOWN_PDF_PROFILE_SCHEMA_VERSION_STALE"
    | "MARKDOWN_PDF_PROFILE_SCHEMA_VERSION_FORWARD",
  state: "invalid" | "stale" | "forward",
): MarkdownPdfProjectCodexHandoffDiagnostic {
  const context = plainObject(diagnostic.context, "Project handoff diagnostic context");
  const hasDeclaredRevision = state !== "invalid";
  assertExactKeys(
    context,
    [
      "kind",
      "state",
      ...(hasDeclaredRevision ? ["declaredRevision"] : []),
      "inferredRevision",
      "currentRevision",
    ],
    "Project handoff diagnostic context",
  );
  if (context.kind !== "profile-schema-version" || context.state !== state) {
    return invalidProjection("Project handoff Profile revision diagnostic is inconsistent.");
  }
  return {
    conditionId,
    severity: "warning",
    context: {
      kind: context.kind,
      state,
      ...(hasDeclaredRevision
        ? {
            declaredRevision: safeInteger(context.declaredRevision, {
              label: "Project handoff declared Profile revision",
              minimum: 1,
            }),
          }
        : {}),
      inferredRevision: safeInteger(context.inferredRevision, {
        label: "Project handoff inferred Profile revision",
        minimum: 1,
      }),
      currentRevision: safeInteger(context.currentRevision, {
        label: "Project handoff current Profile revision",
        minimum: 1,
      }),
    },
    message: sanitizeMdPdfProjectCodexReportText(
      stringValue(diagnostic.message, "Project handoff diagnostic message"),
    ),
  };
}

function projectDiagnostic(value: unknown): MarkdownPdfProjectCodexHandoffDiagnostic {
  const diagnostic = plainObject(value, "Project handoff diagnostic");
  assertExactKeys(
    diagnostic,
    ["conditionId", "severity", "context", "message"],
    "Project handoff diagnostic",
  );
  switch (diagnostic.conditionId) {
    case "MARKDOWN_PDF_PAGE_NUMBER_SLOT_OCCUPIED":
      if (diagnostic.severity !== "warning") {
        return invalidProjection("Project handoff diagnostic severity is unsupported.");
      }
      return occupiedSlotDiagnostic(diagnostic);
    case "MARKDOWN_PDF_LEGACY_PAGES_TOKEN_MIGRATION":
      if (diagnostic.severity !== "warning") {
        return invalidProjection("Project handoff diagnostic severity is unsupported.");
      }
      return legacyPagesMigrationDiagnostic(diagnostic);
    case "MARKDOWN_PDF_LEGACY_BODY_VISIBILITY_FALLBACK":
      if (diagnostic.severity !== "warning") {
        return invalidProjection("Project handoff diagnostic severity is unsupported.");
      }
      return legacyFallbackDiagnostic(diagnostic);
    case "MARKDOWN_PDF_BODY_BOUNDARY_REQUIRED":
      if (diagnostic.severity !== "error") {
        return invalidProjection("Project handoff diagnostic severity is unsupported.");
      }
      return missingBodyBoundaryDiagnostic(diagnostic);
    case "MARKDOWN_PDF_PROFILE_SCHEMA_VERSION_INVALID":
      if (diagnostic.severity !== "warning") {
        return invalidProjection("Project handoff diagnostic severity is unsupported.");
      }
      return profileRevisionDiagnostic(diagnostic, diagnostic.conditionId, "invalid");
    case "MARKDOWN_PDF_PROFILE_SCHEMA_VERSION_STALE":
      if (diagnostic.severity !== "warning") {
        return invalidProjection("Project handoff diagnostic severity is unsupported.");
      }
      return profileRevisionDiagnostic(diagnostic, diagnostic.conditionId, "stale");
    case "MARKDOWN_PDF_PROFILE_SCHEMA_VERSION_FORWARD":
      if (diagnostic.severity !== "warning") {
        return invalidProjection("Project handoff diagnostic severity is unsupported.");
      }
      return profileRevisionDiagnostic(diagnostic, diagnostic.conditionId, "forward");
    default:
      return invalidProjection("Project handoff diagnostic condition is unsupported.");
  }
}

function capabilityRequirement(
  value: unknown,
): MarkdownPdfProjectCodexHandoffCapabilityRequirement {
  const requirement = plainObject(value, "Project handoff capability requirement");
  assertExactKeys(
    requirement,
    ["capabilityId", "requestedBy", "minimumVersion"],
    "Project handoff capability requirement",
  );
  const capabilityId = stringValue(requirement.capabilityId, "Project handoff capability ID");
  if (!isMarkdownPdfRendererCapabilityId(capabilityId)) {
    return invalidProjection("Project handoff capability requirement is unsupported.");
  }
  const definition = CAPABILITY_DEFINITIONS.get(capabilityId);
  if (!definition || requirement.minimumVersion !== definition.minimumVersion) {
    return invalidProjection("Project handoff capability requirement is unsupported.");
  }
  if (!Array.isArray(requirement.requestedBy) || requirement.requestedBy.length === 0) {
    return invalidProjection("Project handoff capability requesting fields are required.");
  }
  const requestedBy = requirement.requestedBy.map((field) => {
    const value = stringValue(field, "Project handoff capability requesting field");
    if (!isMarkdownPdfRendererCapabilityField(value) || !definition.fields.includes(value)) {
      return invalidProjection("Project handoff capability requesting fields are unsupported.");
    }
    return value;
  });
  if (new Set(requestedBy).size !== requestedBy.length) {
    return invalidProjection("Project handoff capability requesting fields are unsupported.");
  }
  return {
    capabilityId: definition.id,
    requestedBy,
    minimumVersion: definition.minimumVersion,
  };
}

export function createMdPdfProjectCodexHandoffProjection(input: {
  outputPlan: MarkdownPdfProjectCodexOutputPlan;
  projectArtifactsWritten?: boolean;
  profilePhase: MdPdfProjectCodexProfilePhaseResult;
  runtime: CliRuntime;
  state: NormalizedMdPdfProjectCodexCommandState;
  validation: MarkdownPdfProjectCodexValidationSummary;
}): MarkdownPdfProjectCodexHandoffProjection {
  const base = {
    profile: {
      id: profileIdentity(input),
      bundlePath: "profile.yml" as const,
    },
    diagnostics: input.validation.diagnostics.conditions.map(projectDiagnostic),
    capabilityRequirements: input.validation.capabilityRequirements.map(capabilityRequirement),
  };

  if (input.validation.decisionMode === "no-usable-project") {
    return {
      ...base,
      artifacts: { availability: "unavailable" },
      render: { usability: "unavailable" },
    };
  }
  if (!input.validation.renderCommand) {
    return invalidProjection("Usable Project validation requires a follow-up render command.");
  }
  const command = createMdPdfProjectCodexRenderCommand(input);
  return input.projectArtifactsWritten
    ? {
        ...base,
        artifacts: { availability: "written" },
        render: { usability: "usable", command },
      }
    : {
        ...base,
        artifacts: { availability: "planned" },
        render: { usability: "planned", command },
      };
}
