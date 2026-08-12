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

export const MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION = "65.1";

export const MARKDOWN_PDF_RENDERER_CAPABILITY_IDS = {
  pageNumberStart: "pageNumbers.start",
  pageNumberIncrement: "pageNumbers.increment",
  pageNumberDocumentScope: "pageNumbers.scope.document",
  pageNumberBodyOrigin: "pageNumbers.countFrom.body",
  pageChromeFontSize: "pageChrome.fontSize",
  pageChromeFontWeight: "pageChrome.fontWeight",
  pageChromeLineHeight: "pageChrome.lineHeight",
  pageChromeColor: "pageChrome.color",
  pageChromeSeparatorWidth: "pageChrome.separator.width",
  pageChromeSeparatorStyle: "pageChrome.separator.style",
  pageChromeSeparatorColor: "pageChrome.separator.color",
  pageChromeSeparatorGap: "pageChrome.separator.gap",
} as const;

export type MarkdownPdfRendererCapabilityId =
  (typeof MARKDOWN_PDF_RENDERER_CAPABILITY_IDS)[keyof typeof MARKDOWN_PDF_RENDERER_CAPABILITY_IDS];

export type MarkdownPdfRendererCapabilityField =
  | "pageNumbers.start"
  | "pageNumbers.increment"
  | "pageNumbers.scope"
  | "pageNumbers.countFrom"
  | `header.style.${"fontSize" | "fontWeight" | "lineHeight" | "color"}`
  | `footer.style.${"fontSize" | "fontWeight" | "lineHeight" | "color"}`
  | `header.style.separator.${"width" | "style" | "color" | "gap"}`
  | `footer.style.separator.${"width" | "style" | "color" | "gap"}`;

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

function pageChromeFields(
  field:
    | "fontSize"
    | "fontWeight"
    | "lineHeight"
    | "color"
    | "separator.width"
    | "separator.style"
    | "separator.color"
    | "separator.gap",
): MarkdownPdfRendererCapabilityField[] {
  return PAGE_CHROME_AREAS.map(
    (area) => `${area}.style.${field}` as MarkdownPdfRendererCapabilityField,
  );
}

export const MARKDOWN_PDF_RENDERER_CAPABILITY_MATRIX: readonly MarkdownPdfRendererCapabilityDefinition[] =
  [
    {
      id: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberStart,
      minimumVersion: MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION,
      fields: ["pageNumbers.start"],
    },
    {
      id: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberIncrement,
      minimumVersion: MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION,
      fields: ["pageNumbers.increment"],
    },
    {
      id: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberDocumentScope,
      minimumVersion: MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION,
      fields: ["pageNumbers.scope"],
    },
    {
      id: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberBodyOrigin,
      minimumVersion: MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION,
      fields: ["pageNumbers.countFrom"],
    },
    {
      id: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeFontSize,
      minimumVersion: MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION,
      fields: pageChromeFields("fontSize"),
    },
    {
      id: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeFontWeight,
      minimumVersion: MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION,
      fields: pageChromeFields("fontWeight"),
    },
    {
      id: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeLineHeight,
      minimumVersion: MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION,
      fields: pageChromeFields("lineHeight"),
    },
    {
      id: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeColor,
      minimumVersion: MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION,
      fields: pageChromeFields("color"),
    },
    {
      id: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeSeparatorWidth,
      minimumVersion: MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION,
      fields: pageChromeFields("separator.width"),
    },
    {
      id: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeSeparatorStyle,
      minimumVersion: MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION,
      fields: pageChromeFields("separator.style"),
    },
    {
      id: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeSeparatorColor,
      minimumVersion: MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION,
      fields: pageChromeFields("separator.color"),
    },
    {
      id: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeSeparatorGap,
      minimumVersion: MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION,
      fields: pageChromeFields("separator.gap"),
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

function collectAreaStyleRequests(input: {
  area: "header" | "footer";
  profile: NormalizedMarkdownPdfProfile;
  requests: Map<MarkdownPdfRendererCapabilityId, MarkdownPdfRendererCapabilityField[]>;
}): void {
  const style = input.profile[input.area].style;
  if (!style) {
    return;
  }

  for (const [field, capabilityId] of [
    ["fontSize", MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeFontSize],
    ["fontWeight", MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeFontWeight],
    ["lineHeight", MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeLineHeight],
    ["color", MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeColor],
  ] as const) {
    if (style[field] !== undefined) {
      appendRequest(input.requests, capabilityId, `${input.area}.style.${field}`);
    }
  }

  for (const [field, capabilityId] of [
    ["width", MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeSeparatorWidth],
    ["style", MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeSeparatorStyle],
    ["color", MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeSeparatorColor],
    ["gap", MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeSeparatorGap],
  ] as const) {
    if (style.separator?.[field] !== undefined) {
      appendRequest(input.requests, capabilityId, `${input.area}.style.separator.${field}`);
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
      appendRequest(
        requests,
        MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberStart,
        "pageNumbers.start",
      );
    }
    if (input.pageNumbers.increment !== 1) {
      appendRequest(
        requests,
        MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberIncrement,
        "pageNumbers.increment",
      );
    }
    if (input.pageNumbers.scope === "document") {
      appendRequest(
        requests,
        MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberDocumentScope,
        "pageNumbers.scope",
      );
    }
    if (input.pageNumbers.countFrom === "body") {
      appendRequest(
        requests,
        MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberBodyOrigin,
        "pageNumbers.countFrom",
      );
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
  let status: MarkdownPdfRendererCapabilityStatus;
  if (input.probeFailed) {
    status = "probe-failed";
  } else if (!input.renderer) {
    status = "unknown";
  } else {
    status = assessCommandMinimumVersion(
      input.renderer,
      MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION,
    ).status;
  }

  const diagnosticConditionId = status === "satisfied" ? undefined : conditionIdForStatus(status);
  return {
    renderer: {
      name: "weasyprint",
      available: input.renderer?.available ?? null,
      version: input.renderer?.version ?? null,
    },
    capabilities: MARKDOWN_PDF_RENDERER_CAPABILITY_MATRIX.map((definition) => ({
      ...definition,
      status,
      ...(diagnosticConditionId ? { diagnosticConditionId } : {}),
    })),
  };
}

export function assertMarkdownPdfRendererCapabilities(input: {
  assessment: MarkdownPdfRendererCapabilityAssessment;
  requests: readonly MarkdownPdfRendererCapabilityRequest[];
}): void {
  const requestIds = new Set(input.requests.map(({ capabilityId }) => capabilityId));
  const unavailable = input.assessment.capabilities.filter(
    (capability) => requestIds.has(capability.id) && capability.status !== "satisfied",
  );
  if (unavailable.length === 0) {
    return;
  }

  const first = unavailable[0];
  const requested = input.requests
    .filter(({ capabilityId }) => unavailable.some(({ id }) => id === capabilityId))
    .map(({ capabilityId, requestedBy }) => `${capabilityId} (${requestedBy.join(", ")})`)
    .join("; ");
  const version = input.assessment.renderer.version ?? "unknown";
  throw new CliError(
    `WeasyPrint ${version} cannot provide the effectively requested Markdown PDF renderer capabilities: ${requested}. Required baseline: ${MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION}.`,
    {
      code:
        first?.diagnosticConditionId ??
        MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.rendererCapabilityUnknown,
      exitCode: 2,
    },
  );
}
