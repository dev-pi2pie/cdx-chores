import { assessCommandMinimumVersion, type CommandStatus } from "../deps";
import { CliError } from "../errors";
import {
  MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS,
  type MarkdownPdfDiagnosticConditionId,
} from "./diagnostics";
import type {
  NormalizedMarkdownPdfPageChromeArea,
  NormalizedMarkdownPdfPageNumbers,
  NormalizedMarkdownPdfProfile,
} from "./profile";
import {
  markdownPdfProfileRendererCapability,
  markdownPdfProfileRendererCapabilityFields,
} from "./profile";
import {
  MARKDOWN_PDF_RENDERER_CAPABILITY_IDS,
  type MarkdownPdfRendererCapabilityField,
  type MarkdownPdfRendererCapabilityId,
} from "./renderer-capability-contract";

export {
  MARKDOWN_PDF_RENDERER_CAPABILITY_FIELDS,
  MARKDOWN_PDF_RENDERER_CAPABILITY_IDS,
} from "./renderer-capability-contract";
export type {
  MarkdownPdfRendererCapabilityField,
  MarkdownPdfRendererCapabilityId,
} from "./renderer-capability-contract";

export const MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION = "65.1";

export type MarkdownPdfRendererCapabilityStatus =
  | "satisfied"
  | "missing"
  | "unsupported"
  | "unverified"
  | "probe-failed"
  | "unknown";

export interface MarkdownPdfRendererCapabilityDefinition {
  id: MarkdownPdfRendererCapabilityId;
  minimumVersion: string;
  fields: readonly MarkdownPdfRendererCapabilityField[];
}

export interface MarkdownPdfRendererCapabilityRequest {
  capabilityId: MarkdownPdfRendererCapabilityId;
  requestedBy: MarkdownPdfRendererCapabilityField[];
}

export interface MarkdownPdfRendererCapabilityResult extends MarkdownPdfRendererCapabilityDefinition {
  status: MarkdownPdfRendererCapabilityStatus;
  diagnosticConditionId?: MarkdownPdfDiagnosticConditionId;
}

export interface MarkdownPdfRendererCapabilityAssessment {
  renderer: {
    name: "weasyprint";
    available: boolean | null;
    version: string | null;
  };
  capabilities: MarkdownPdfRendererCapabilityResult[];
}

const PAGE_CHROME_AREAS = ["header", "footer"] as const;

function registryCapabilityFields(
  capabilityId: MarkdownPdfRendererCapabilityId,
): MarkdownPdfRendererCapabilityField[] {
  return [...markdownPdfProfileRendererCapabilityFields(capabilityId)];
}

export const MARKDOWN_PDF_RENDERER_CAPABILITY_MATRIX: readonly MarkdownPdfRendererCapabilityDefinition[] =
  [
    {
      id: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberStart,
      minimumVersion: MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION,
      fields: registryCapabilityFields(MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberStart),
    },
    {
      id: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberIncrement,
      minimumVersion: MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION,
      fields: registryCapabilityFields(MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberIncrement),
    },
    {
      id: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberDocumentScope,
      minimumVersion: MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION,
      fields: registryCapabilityFields(
        MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberDocumentScope,
      ),
    },
    {
      id: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberBodyOrigin,
      minimumVersion: MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION,
      fields: registryCapabilityFields(MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberBodyOrigin),
    },
    {
      id: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeFontSize,
      minimumVersion: MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION,
      fields: registryCapabilityFields(MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeFontSize),
    },
    {
      id: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeFontWeight,
      minimumVersion: MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION,
      fields: registryCapabilityFields(MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeFontWeight),
    },
    {
      id: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeLineHeight,
      minimumVersion: MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION,
      fields: registryCapabilityFields(MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeLineHeight),
    },
    {
      id: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeColor,
      minimumVersion: MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION,
      fields: registryCapabilityFields(MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeColor),
    },
    {
      id: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeSeparatorWidth,
      minimumVersion: MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION,
      fields: registryCapabilityFields(
        MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeSeparatorWidth,
      ),
    },
    {
      id: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeSeparatorStyle,
      minimumVersion: MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION,
      fields: registryCapabilityFields(
        MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeSeparatorStyle,
      ),
    },
    {
      id: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeSeparatorColor,
      minimumVersion: MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION,
      fields: registryCapabilityFields(
        MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeSeparatorColor,
      ),
    },
    {
      id: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeSeparatorGap,
      minimumVersion: MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION,
      fields: registryCapabilityFields(MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeSeparatorGap),
    },
  ];

function pageNumberTargetArea(
  position: NormalizedMarkdownPdfPageNumbers["position"],
): "header" | "footer" {
  return position.startsWith("top-") ? "header" : "footer";
}

function areaHasContent(area: NormalizedMarkdownPdfPageChromeArea): boolean {
  return [area.left, area.center, area.right].some((value) => value.trim().length > 0);
}

function appendRequest(
  requests: Map<MarkdownPdfRendererCapabilityId, MarkdownPdfRendererCapabilityField[]>,
  capabilityId: MarkdownPdfRendererCapabilityId,
  field: MarkdownPdfRendererCapabilityField,
): void {
  const fields = requests.get(capabilityId) ?? [];
  if (!fields.includes(field)) {
    fields.push(field);
  }
  requests.set(capabilityId, fields);
}

function appendProfileFeatureRequest(
  requests: Map<MarkdownPdfRendererCapabilityId, MarkdownPdfRendererCapabilityField[]>,
  field: MarkdownPdfRendererCapabilityField,
  value?: unknown,
): void {
  const capabilityId = markdownPdfProfileRendererCapability(field, value);
  if (capabilityId) {
    appendRequest(requests, capabilityId, field);
  }
}

function collectAreaStyleRequests(input: {
  area: "header" | "footer";
  profile: NormalizedMarkdownPdfProfile;
  requests: Map<MarkdownPdfRendererCapabilityId, MarkdownPdfRendererCapabilityField[]>;
}): void {
  const style = input.profile[input.area].style;
  if (!style) {
    return;
  }

  for (const field of ["fontSize", "fontWeight", "lineHeight", "color"] as const) {
    if (style[field] !== undefined) {
      appendProfileFeatureRequest(input.requests, `${input.area}.style.${field}`, style[field]);
    }
  }

  for (const field of ["width", "style", "color", "gap"] as const) {
    if (style.separator?.[field] !== undefined) {
      appendProfileFeatureRequest(
        input.requests,
        `${input.area}.style.separator.${field}`,
        style.separator[field],
      );
    }
  }
}

export function collectMarkdownPdfRendererCapabilityRequests(input: {
  profile: NormalizedMarkdownPdfProfile;
  pageNumbers: NormalizedMarkdownPdfPageNumbers;
}): MarkdownPdfRendererCapabilityRequest[] {
  const requests = new Map<MarkdownPdfRendererCapabilityId, MarkdownPdfRendererCapabilityField[]>();

  if (input.pageNumbers.enabled) {
    if (input.pageNumbers.start !== 1) {
      appendProfileFeatureRequest(requests, "pageNumbers.start", input.pageNumbers.start);
    }
    if (input.pageNumbers.increment !== 1) {
      appendProfileFeatureRequest(requests, "pageNumbers.increment", input.pageNumbers.increment);
    }
    if (input.pageNumbers.scope === "document") {
      appendProfileFeatureRequest(requests, "pageNumbers.scope", input.pageNumbers.scope);
    }
    if (input.pageNumbers.countFrom === "body") {
      appendProfileFeatureRequest(requests, "pageNumbers.countFrom", input.pageNumbers.countFrom);
    }
  }

  const pageNumberArea = input.pageNumbers.enabled
    ? pageNumberTargetArea(input.pageNumbers.position)
    : undefined;
  for (const area of PAGE_CHROME_AREAS) {
    if (!areaHasContent(input.profile[area]) && pageNumberArea !== area) {
      continue;
    }
    collectAreaStyleRequests({ area, profile: input.profile, requests });
  }

  return MARKDOWN_PDF_RENDERER_CAPABILITY_MATRIX.flatMap(({ id }) => {
    const requestedBy = requests.get(id);
    return requestedBy ? [{ capabilityId: id, requestedBy }] : [];
  });
}

function conditionIdForStatus(
  status: Exclude<MarkdownPdfRendererCapabilityStatus, "satisfied">,
): MarkdownPdfDiagnosticConditionId {
  const ids = MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS;
  switch (status) {
    case "missing":
      return ids.rendererCapabilityMissing;
    case "unsupported":
      return ids.rendererCapabilityUnsupported;
    case "unverified":
      return ids.rendererCapabilityUnverified;
    case "probe-failed":
      return ids.rendererCapabilityProbeFailed;
    case "unknown":
      return ids.rendererCapabilityUnknown;
  }
}

export function assessMarkdownPdfRendererCapabilities(input: {
  renderer?: CommandStatus;
  probeFailed?: boolean;
}): MarkdownPdfRendererCapabilityAssessment {
  return {
    renderer: {
      name: "weasyprint",
      available: input.renderer?.available ?? null,
      version: input.renderer?.version ?? null,
    },
    capabilities: MARKDOWN_PDF_RENDERER_CAPABILITY_MATRIX.map((definition) => {
      const status: MarkdownPdfRendererCapabilityStatus = input.probeFailed
        ? "probe-failed"
        : !input.renderer
          ? "unknown"
          : assessCommandMinimumVersion(input.renderer, definition.minimumVersion).status;
      const diagnosticConditionId =
        status === "satisfied" ? undefined : conditionIdForStatus(status);
      return {
        ...definition,
        status,
        ...(diagnosticConditionId ? { diagnosticConditionId } : {}),
      };
    }),
  };
}

export function assertMarkdownPdfRendererCapabilities(input: {
  assessment: MarkdownPdfRendererCapabilityAssessment;
  requests: readonly MarkdownPdfRendererCapabilityRequest[];
}): void {
  const capabilities = new Map(
    input.assessment.capabilities.map((capability) => [capability.id, capability]),
  );
  const unavailable = input.requests.flatMap((request) => {
    const capability = capabilities.get(request.capabilityId);
    return !capability || capability.status !== "satisfied" ? [{ request, capability }] : [];
  });
  if (unavailable.length === 0) {
    return;
  }

  const first = unavailable[0];
  const requested = unavailable
    .map(({ request, capability }) => {
      const minimum = capability ? capability.minimumVersion : "unknown";
      return `${request.capabilityId} (${request.requestedBy.join(", ")}; minimum ${minimum})`;
    })
    .join("; ");
  const version = input.assessment.renderer.version ?? "unknown";
  throw new CliError(
    `WeasyPrint ${version} cannot provide the effectively requested Markdown PDF renderer capabilities: ${requested}.`,
    {
      code:
        first?.capability?.diagnosticConditionId ??
        MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.rendererCapabilityUnknown,
      exitCode: 2,
    },
  );
}
