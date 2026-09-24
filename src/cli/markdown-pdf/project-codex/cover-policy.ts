import { CliError } from "../../errors";
import { normalizeMarkdownPdfProfile } from "../profile";
import { loadMarkdownPdfBaseProfileCandidate } from "../profile/candidates";

export const MD_PDF_PROJECT_COVER_CONFLICT_CODE = "MARKDOWN_PDF_PROJECT_COVER_CONFLICT";

type ProjectCoverIntent = "none" | "generic" | "text-only" | "image" | "no-cover" | "conflict";

const NEGATED_COVER_IMAGE =
  /\b(?:no|without|skip|avoid|exclude|omit|(?:do\s+not|don't|never)\s+(?:use|include|add|show))\s+(?:(?:a|an|the|any)\s+)?(?:(?:cover\s+)?(?:image|photo|picture)|(?:image|photo|picture)\s+cover)\b/giu;
const NEGATED_COVER =
  /\b(?:no|without|skip|disable|avoid|exclude|omit|(?:do\s+not|don't|never)\s+(?:include|use|add|create|show))\s+(?:(?:a|the|any)\s+)?(?:(?:text(?:[- ]only)?|textual|typographic)\s+)?(?:cover(?:\s+page)?|title[- ]page)(?:\s+(?:with\s+)?text(?:\s+only)?)?\b/giu;
const PAGE_NUMBER_COVER_REFERENCES = [
  /\b(?:skip|exclude|omit|ignore)\s+(?:the\s+)?cover(?:\s+page)?\s+(?:in|from|for)\s+(?:page\s+)?(?:number(?:s|ing)?|count(?:ing)?)\b/giu,
  /\b(?:no|without)\s+(?:page\s+)?(?:number(?:s|ing)?|count(?:ing)?)\s+(?:on|for)\s+(?:the\s+)?cover(?:\s+page)?\b/giu,
  /\b(?:do\s+not|don't|never)\s+(?:number|count)\s+(?:the\s+)?cover(?:\s+page)?\b/giu,
  /\b(?:keep|leave)\s+(?:the\s+)?(?:page\s+)?number(?:s|ing)?\s+off\s+(?:the\s+)?cover(?:\s+page)?\b/giu,
  /\b(?:do\s+not|don't|never)\s+(?:put|place|show|print|display|include)\s+(?:the\s+)?(?:page\s+)?number(?:s|ing)?\s+(?:on|in)\s+(?:the\s+)?cover(?:\s+page)?\b/giu,
  /\b(?:start|begin)\s+(?:page\s+)?number(?:s|ing)?\s+after\s+(?:the\s+)?cover(?:\s+page)?\b/giu,
];

export function explicitMdPdfProjectBaseCoverChoice(
  profile: Record<string, unknown> | undefined,
): boolean | undefined {
  const cover = profile?.cover;
  if (!cover || typeof cover !== "object" || Array.isArray(cover)) return undefined;
  const enabled = (cover as Record<string, unknown>).enabled;
  return typeof enabled === "boolean" ? enabled : undefined;
}

function coverConflict(message: string): never {
  throw new CliError(message, { code: MD_PDF_PROJECT_COVER_CONFLICT_CODE, exitCode: 2 });
}

export function classifyMdPdfProjectCoverIntent(intent: string | undefined): ProjectCoverIntent {
  const withoutNumbering = PAGE_NUMBER_COVER_REFERENCES.reduce(
    (text, reference) => text.replace(reference, " "),
    intent ?? "",
  );
  const withoutImageNegations = withoutNumbering.replace(NEGATED_COVER_IMAGE, " ");
  // A negative phrase must not also supply a positive cover match.
  const text = withoutImageNegations.replace(NEGATED_COVER, " ");
  const noCover = text !== withoutImageNegations;
  const textOnly =
    /\b(?:text(?:[- ]only)?|textual|typographic)\s+(?:cover|title[- ]page)\b|\b(?:cover|title[- ]page)\s+(?:with\s+)?text(?:\s+only)?\b/iu.test(
      text,
    );
  const image =
    /\b(?:image|photo|picture|media)\s+(?:cover|title[- ]page)\b|\b(?:cover|title[- ]page)\s+(?:image|photo|picture)\b/iu.test(
      text,
    );
  const cover = /\b(?:cover|title[- ]page)\b/iu.test(text);
  if ((noCover && cover) || (textOnly && image)) return "conflict";
  if (noCover) return "no-cover";
  if (textOnly) return "text-only";
  if (image) return "image";
  return cover ? "generic" : "none";
}

export function assertMdPdfProjectKnownCoverCompatibility(input: {
  coverImageAvailable: boolean;
  baseProfileCoverEnabled?: boolean;
}): void {
  if (input.coverImageAvailable && input.baseProfileCoverEnabled === false) {
    coverConflict(
      "A selected cover image conflicts with the base Profile's disabled cover. Enable its cover or clear the image.",
    );
  }
}

export async function assertMdPdfProjectKnownCoverSetup(input: {
  baseProfile?: string;
  coverImage?: string;
  cwd: string;
}): Promise<void> {
  if (!input.baseProfile || !input.coverImage) return;
  const baseProfile = await loadMarkdownPdfBaseProfileCandidate({
    cwd: input.cwd,
    path: input.baseProfile,
  });
  assertMdPdfProjectKnownCoverCompatibility({
    coverImageAvailable: true,
    baseProfileCoverEnabled: explicitMdPdfProjectBaseCoverChoice(baseProfile.fullProfile),
  });
}

export function applyMdPdfProjectCoverPolicy(input: {
  baseProfileCoverEnabled?: boolean;
  coverImageAvailable: boolean;
  finalProfile: Record<string, unknown>;
  intent?: string;
}): Record<string, unknown> {
  const intent = classifyMdPdfProjectCoverIntent(input.intent);
  const noImageRequested = (input.intent ?? "").match(NEGATED_COVER_IMAGE) !== null;
  if (intent === "conflict") {
    coverConflict(
      "PDF cover directions conflict. Revise the cover request before preparing a Project.",
    );
  }
  if (
    (input.coverImageAvailable &&
      (intent === "text-only" || intent === "no-cover" || noImageRequested)) ||
    (!input.coverImageAvailable && intent === "image") ||
    (input.baseProfileCoverEnabled === false &&
      (input.coverImageAvailable ||
        intent === "generic" ||
        intent === "text-only" ||
        intent === "image")) ||
    (input.baseProfileCoverEnabled === true && intent === "no-cover")
  ) {
    coverConflict(
      "PDF cover choices conflict. Revise the cover image, PDF intent, or base Profile before preparing a Project.",
    );
  }

  const normalized = normalizeMarkdownPdfProfile({ profile: input.finalProfile });
  const enabled =
    input.coverImageAvailable ||
    input.baseProfileCoverEnabled === true ||
    intent === "generic" ||
    intent === "text-only";
  if (normalized.profile.cover.enabled === enabled) return input.finalProfile;
  const cover = (input.finalProfile.cover ?? {}) as Record<string, unknown>;
  return { ...input.finalProfile, cover: { ...cover, enabled } };
}
