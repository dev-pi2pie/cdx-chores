import {
  normalizeMarkdownPdfProfile,
  type NormalizedMarkdownPdfPageChromeArea,
  type NormalizedMarkdownPdfProfile,
} from "./profile";
import {
  collectMarkdownPdfRendererCapabilityRequests,
  MARKDOWN_PDF_RENDERER_CAPABILITY_MATRIX,
  type MarkdownPdfRendererCapabilityField,
  type MarkdownPdfRendererCapabilityId,
} from "./renderer-capabilities";

export interface MarkdownPdfProfileAuthoringCapabilityRequirement {
  capabilityId: MarkdownPdfRendererCapabilityId;
  requestedBy: MarkdownPdfRendererCapabilityField[];
  minimumVersion: string;
}

export interface MarkdownPdfProfileAuthoringReview {
  normalizedProfile: NormalizedMarkdownPdfProfile;
  capabilityRequirements: MarkdownPdfProfileAuthoringCapabilityRequirement[];
}

export function collectMarkdownPdfProfileAuthoringCapabilityRequirements(
  profile: NormalizedMarkdownPdfProfile,
): MarkdownPdfProfileAuthoringCapabilityRequirement[] {
  const requests = new Map(
    collectMarkdownPdfRendererCapabilityRequests({
      pageNumbers: profile.pageNumbers,
      profile,
    }).map((request) => [request.capabilityId, request]),
  );
  return MARKDOWN_PDF_RENDERER_CAPABILITY_MATRIX.flatMap((definition) => {
    const request = requests.get(definition.id);
    return request
      ? [
          {
            capabilityId: definition.id,
            requestedBy: request.requestedBy,
            minimumVersion: definition.minimumVersion,
          },
        ]
      : [];
  });
}

export function collectMarkdownPdfProfileAuthoringReview(
  profile: Record<string, unknown>,
): MarkdownPdfProfileAuthoringReview {
  const normalizedProfile = normalizeMarkdownPdfProfile({ profile }).profile;
  const capabilityRequirements =
    collectMarkdownPdfProfileAuthoringCapabilityRequirements(normalizedProfile);
  return { normalizedProfile, capabilityRequirements };
}

function formatPageChromeArea(
  label: "Header" | "Footer",
  area: Readonly<NormalizedMarkdownPdfPageChromeArea>,
): string[] {
  const lines = [
    `- ${label}: left=${JSON.stringify(area.left)}, center=${JSON.stringify(area.center)}, right=${JSON.stringify(area.right)}`,
  ];
  if (!area.style) {
    lines.push(`- ${label} style: default`);
    return lines;
  }

  const style = area.style;
  lines.push(
    `- ${label} style: fontSize=${style.fontSize ?? "default"}, fontWeight=${style.fontWeight ?? "default"}, lineHeight=${style.lineHeight ?? "default"}, color=${style.color ?? "default"}`,
  );
  const separator = style.separator;
  lines.push(
    separator
      ? `- ${label} separator: width=${separator.width ?? "default"}, style=${separator.style ?? "default"}, color=${separator.color ?? "default"}, gap=${separator.gap ?? "default"}`
      : `- ${label} separator: none`,
  );
  return lines;
}

export function formatMarkdownPdfProfileAuthoringReview(
  review: Readonly<MarkdownPdfProfileAuthoringReview>,
): string[] {
  const pageNumbers = review.normalizedProfile.pageNumbers;
  const lines = [
    "Reusable Profile page numbers:",
    `- Enabled: ${pageNumbers.enabled ? "yes" : "no"}`,
    `- Scope: ${pageNumbers.scope}`,
    `- Count from: ${pageNumbers.countFrom}`,
    `- Start: ${pageNumbers.start}`,
    `- Increment: ${pageNumbers.increment}`,
    `- Position: ${pageNumbers.position}`,
    `- Format: ${JSON.stringify(pageNumbers.format)}`,
    "",
    "Reusable Profile page chrome:",
    ...formatPageChromeArea("Header", review.normalizedProfile.header),
    ...formatPageChromeArea("Footer", review.normalizedProfile.footer),
  ];

  if (review.capabilityRequirements.length > 0) {
    lines.push("", "Advisory renderer capability requirements:");
    for (const requirement of review.capabilityRequirements) {
      lines.push(
        `- capabilityId: ${requirement.capabilityId}`,
        `  requestedBy: ${requirement.requestedBy.join(", ")}`,
        `  minimumVersion: ${requirement.minimumVersion}`,
      );
    }
  }

  return lines;
}
