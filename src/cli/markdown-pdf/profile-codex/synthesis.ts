import { validateMarkdownPdfProfileShape } from "../profile";
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
    profile: input.identity,
  };
  validateMarkdownPdfProfileShape(finalProfile);
  return { finalProfile };
}
