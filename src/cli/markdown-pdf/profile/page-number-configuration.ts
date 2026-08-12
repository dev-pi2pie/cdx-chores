import type { NormalizedMarkdownPdfPageNumbers } from "./types";

export type MarkdownPdfPageNumberConfigurationSource = "direct-override" | "profile" | "default";

export interface ResolvedMarkdownPdfPageNumberConfiguration {
  profileEnabled: boolean;
  override?: boolean;
  source: MarkdownPdfPageNumberConfigurationSource;
  effective: NormalizedMarkdownPdfPageNumbers;
}

export function resolveMarkdownPdfPageNumberConfiguration(input: {
  profile: NormalizedMarkdownPdfPageNumbers;
  profileSource: Exclude<MarkdownPdfPageNumberConfigurationSource, "direct-override">;
  override?: boolean;
}): ResolvedMarkdownPdfPageNumberConfiguration {
  return {
    profileEnabled: input.profile.enabled,
    override: input.override,
    source: input.override === undefined ? input.profileSource : "direct-override",
    effective: {
      ...input.profile,
      enabled: input.override ?? input.profile.enabled,
    },
  };
}
