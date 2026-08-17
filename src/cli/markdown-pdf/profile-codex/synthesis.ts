import { MARKDOWN_PDF_PROFILE_CURRENT_REVISION, validateMarkdownPdfProfileShape } from "../profile";
import type { NormalizedMarkdownPdfProfileIdentity } from "../profile";

export interface MarkdownPdfProfileCodexMaterializedProfile {
  finalProfile: Record<string, unknown>;
}

export function materializeMarkdownPdfProfileCodexProfile(input: {
  identity: NormalizedMarkdownPdfProfileIdentity;
  profile: Record<string, unknown>;
}): MarkdownPdfProfileCodexMaterializedProfile {
  const finalProfile = {
    ...input.profile,
    schemaVersion: MARKDOWN_PDF_PROFILE_CURRENT_REVISION,
    profile: input.identity,
  };
  validateMarkdownPdfProfileShape(finalProfile);
  return { finalProfile };
}
