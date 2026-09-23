import { CliError } from "../../errors";
import { normalizeMarkdownPdfProfile } from "../profile";
import { loadMarkdownPdfBaseProfileCandidate } from "../profile/candidates";

export const MD_PDF_PROJECT_COVER_CONFLICT_CODE = "MARKDOWN_PDF_PROJECT_COVER_CONFLICT";

type ProjectCoverIntent = "none" | "generic" | "text-only" | "image" | "no-cover" | "conflict";

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
  const text = intent ?? "";
  const noCover =
    /\b(?:no|without|skip|disable|avoid)\s+(?:(?:a|the|any)\s+)?(?:cover(?:\s+page)?|title[- ]page)\b/iu.test(
      text,
    );
  const textOnly =
    /\b(?:text[- ]only|textual|typographic)\s+(?:cover|title[- ]page)\b|\b(?:cover|title[- ]page)\s+(?:with\s+)?text(?:\s+only)?\b/iu.test(
      text,
    );
  const image =
    /\b(?:image|photo|picture|media)\s+(?:cover|title[- ]page)\b|\b(?:cover|title[- ]page)\s+(?:image|photo|picture)\b/iu.test(
      text,
    );
  const cover = /\b(?:cover|title[- ]page)\b/iu.test(text);
  if (Number(noCover) + Number(textOnly) + Number(image) > 1) return "conflict";
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
  if (intent === "conflict") {
    coverConflict(
      "PDF cover directions conflict. Revise the cover request before preparing a Project.",
    );
  }
  if (
    (input.coverImageAvailable && (intent === "text-only" || intent === "no-cover")) ||
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
