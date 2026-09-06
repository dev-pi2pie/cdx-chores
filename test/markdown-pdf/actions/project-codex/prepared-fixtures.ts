export const BASE_PROFILE = [
  "profile:",
  "  id: md-pdf-profile-20260101T000000Z-ba5e0001",
  "  source: deterministic",
  "  createdAt: 2026-01-01T00:00:00Z",
  "page:",
  "  size: Letter",
  "",
].join("\n");

export function adaptedProfileResponse(): string {
  return JSON.stringify({
    decision_mode: "adapted",
    selected_candidate_id: "base-profile",
    accepted_patches: [{ op: "replace", path: "/toc/enabled", value: true }],
    accepted_font_patches: [],
    reasoning: "Adapt the project profile to the document.",
    warnings: [],
    fallback_reason: "",
    unmatched_directions: ["cover image first"],
  });
}

export function adaptedTemplateResponse(): string {
  return JSON.stringify({
    decision_mode: "adapted",
    template_family: "document-layered",
    recipe_preset: "article",
    slots: {
      recipe_preset: { preset: "article", source: "renderer-default" },
      cover: {
        enabled: true,
        byline: "none",
        composition: "media-first-caption",
        image_fit: "cover",
        image_anchor: "center",
        media_align: "center",
        media_scale: "hero",
        text_align: "center",
        style: "media",
        orientation_bucket: "landscape",
        fit_pressure: "normal",
      },
      tables: { density: "standard", repeat_header: true, width: "content" },
      code: { style: "shiki-compatible", line_wrap: "wrap", preserve_selectors: true },
      spacing: { density: "standard" },
      typography: { scale: "standard" },
      colors: { palette: "neutral" },
    },
    css_blocks: [],
    font_decisions: [],
    managed_assets: [{ bundle_path: "assets/cover.png", source_label: "cover.png" }],
    warnings: [],
    unsupported_directions: [],
    fallback_reason: "",
  });
}
