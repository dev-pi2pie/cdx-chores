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
  input: { frontmatter?: Record<string, unknown> | null } = {},
): MarkdownPdfProfileAuthoringReview {
  const normalizedProfile = normalizeMarkdownPdfProfile({
    profile,
    ...(input.frontmatter !== undefined ? { frontmatter: input.frontmatter } : {}),
  }).profile;
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
  const { cover, titleBlock } = review.normalizedProfile;
  const lines = [
    "Reusable Profile cover page:",
    `- Enabled: ${cover.enabled ? "yes" : "no"}`,
    `- Style: ${cover.style}`,
    `- Fields: title=${JSON.stringify(cover.fields.title)}, subtitle=${JSON.stringify(cover.fields.subtitle)}, author=${JSON.stringify(cover.fields.author)}, company=${JSON.stringify(cover.fields.company)}, date=${JSON.stringify(cover.fields.date)}`,
    `- Body metadata title: ${titleBlock.metadataTitle}${
      titleBlock.metadataTitle === "auto"
        ? cover.enabled
          ? " (suppressed while the cover page is enabled)"
          : " (shown when metadata supplies a title)"
        : ""
    }`,
    "",
    "Reusable Profile page numbering:",
    `- Enabled: ${pageNumbers.enabled ? "yes" : "no"}`,
    ...(pageNumbers.enabled
      ? [
          `- Scope: ${pageNumbers.scope}`,
          `- Count from: ${pageNumbers.countFrom}`,
          `- Start: ${pageNumbers.start}`,
          `- Increment: ${pageNumbers.increment}`,
          `- Position: ${pageNumbers.position}`,
          `- Label: ${JSON.stringify(pageNumbers.format)}`,
        ]
      : []),
    "",
    "Reusable Profile repeating page content:",
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
