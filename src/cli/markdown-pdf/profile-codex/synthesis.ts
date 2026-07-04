import {
  inferMarkdownPdfProfileFormat,
  serializeMarkdownPdfProfile,
  validateMarkdownPdfProfileShape,
} from "..";
import type { NormalizedMarkdownPdfProfileIdentity } from "../profile";

export interface MarkdownPdfProfileCodexMaterializedProfile {
  finalProfile: Record<string, unknown>;
  serialized: string;
}

export function materializeMarkdownPdfProfileCodexProfile(input: {
  identity: NormalizedMarkdownPdfProfileIdentity;
  outputPath: string;
  profile: Record<string, unknown>;
}): MarkdownPdfProfileCodexMaterializedProfile {
  const finalProfile = {
    ...input.profile,
    profile: input.identity,
  };
  validateMarkdownPdfProfileShape(finalProfile);
  const format = inferMarkdownPdfProfileFormat(input.outputPath);
  return {
    finalProfile,
    serialized: serializeMarkdownPdfProfile(finalProfile, format),
  };
}
