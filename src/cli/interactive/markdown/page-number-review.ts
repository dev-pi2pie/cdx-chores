import type { PreparedMarkdownPdfRender } from "../../actions/markdown/to-pdf-service";
import {
  DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
  normalizeMarkdownPdfProfile,
  resolveMarkdownPdfPageNumberConfiguration,
  type ResolvedMarkdownPdfPageNumberConfiguration,
} from "../../markdown-pdf/profile";
import {
  MARKDOWN_PDF_RENDERER_CAPABILITY_MATRIX,
  type MarkdownPdfRendererCapabilityRequest,
} from "../../markdown-pdf/renderer-capabilities";
import type { PreparedMarkdownPdfGeneratedCandidate } from "./codex-types";
import {
  compileMarkdownPdfRenderPageNumberChoice,
  type MarkdownPdfRenderPageNumberChoice,
} from "./render-page-numbers";

export type MarkdownPdfPageNumberReviewInput = Pick<
  PreparedMarkdownPdfRender,
  "pageNumberConfiguration" | "rendererCapabilityRequests" | "resolvedInputs"
>;

const CAPABILITY_ORDER = new Map(
  MARKDOWN_PDF_RENDERER_CAPABILITY_MATRIX.map((definition, index) => [definition.id, index]),
);

const CAPABILITY_MINIMUM_VERSIONS = new Map(
  MARKDOWN_PDF_RENDERER_CAPABILITY_MATRIX.map((definition) => [
    definition.id,
    definition.minimumVersion,
  ]),
);

function enabledLabel(enabled: boolean): "enabled" | "disabled" {
  return enabled ? "enabled" : "disabled";
}

function recipeSourceLabel(source: "default" | "profile"): string {
  return source === "profile" ? "reusable Profile" : "normalized default";
}

function overrideLabel(override: boolean | undefined): string {
  if (override === undefined) {
    return "use recipe setting";
  }
  return override ? "enable for this PDF" : "disable for this PDF";
}

function generatedProfile(
  generated: PreparedMarkdownPdfGeneratedCandidate,
): Record<string, unknown> | undefined {
  if (generated.kind === "deterministic") {
    return generated.candidate.artifact === "profile"
      ? generated.candidate.prepared.profile
      : undefined;
  }
  const candidate = generated.candidate;
  if (candidate.artifact === "profile") {
    return candidate.prepared.kind === "profile" ? candidate.prepared.finalProfile : undefined;
  }
  if (candidate.artifact === "template-bundle") {
    return undefined;
  }
  return candidate.prepared.profilePhase.finalProfile;
}

export function resolveGeneratedMarkdownPdfPageNumberConfiguration(
  generated: PreparedMarkdownPdfGeneratedCandidate,
  choice: MarkdownPdfRenderPageNumberChoice,
): { configuration: ResolvedMarkdownPdfPageNumberConfiguration; profileSource: boolean } {
  const profile = generatedProfile(generated);
  const normalized = profile
    ? normalizeMarkdownPdfProfile({ profile }).profile.pageNumbers
    : DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers;
  return {
    configuration: resolveMarkdownPdfPageNumberConfiguration({
      profile: normalized,
      profileSource: profile ? "profile" : "default",
      override: compileMarkdownPdfRenderPageNumberChoice(choice),
    }),
    profileSource: profile !== undefined,
  };
}

export function formatMarkdownPdfPageNumberConfigurationReview(input: {
  configuration: ResolvedMarkdownPdfPageNumberConfiguration;
  profileSource: boolean;
}): string[] {
  const { configuration } = input;
  const recipeSource = input.profileSource ? "profile" : "default";
  const effectiveSource =
    configuration.source === "direct-override"
      ? "one-render override"
      : recipeSourceLabel(recipeSource);
  return [
    "Page numbers:",
    `- Recipe setting: ${enabledLabel(configuration.profileEnabled)} (${recipeSourceLabel(recipeSource)})`,
    `- One-render override: ${overrideLabel(configuration.override)}`,
    `- Effective result: ${enabledLabel(configuration.effective.enabled)}`,
    `- Effective source: ${effectiveSource}`,
  ];
}

function sortedCapabilityRequests(
  requests: readonly MarkdownPdfRendererCapabilityRequest[],
): MarkdownPdfRendererCapabilityRequest[] {
  return [...requests].sort((left, right) => {
    const order =
      (CAPABILITY_ORDER.get(left.capabilityId) ?? Number.MAX_SAFE_INTEGER) -
      (CAPABILITY_ORDER.get(right.capabilityId) ?? Number.MAX_SAFE_INTEGER);
    return order || left.capabilityId.localeCompare(right.capabilityId);
  });
}

export function formatMarkdownPdfPageNumberReview(
  input: Readonly<MarkdownPdfPageNumberReviewInput>,
): string[] {
  const configuration = input.pageNumberConfiguration;
  const recipeSource = input.resolvedInputs.profile ? "profile" : "default";
  const lines = formatMarkdownPdfPageNumberConfigurationReview({
    configuration,
    profileSource: recipeSource === "profile",
  });

  const requests = sortedCapabilityRequests(input.rendererCapabilityRequests);
  if (requests.length === 0) {
    return lines;
  }

  lines.push("", "Renderer capabilities requested by this recipe:");
  for (const request of requests) {
    const minimumVersion = CAPABILITY_MINIMUM_VERSIONS.get(request.capabilityId);
    lines.push(
      `- ${request.capabilityId}: minimum WeasyPrint ${minimumVersion ?? "unknown"}`,
      `  requested by: ${[...request.requestedBy].sort().join(", ")}`,
    );
  }
  return lines;
}
