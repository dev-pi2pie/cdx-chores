import type { MarkdownPdfTemplateCodexRequest } from "../../../src/adapters/codex/markdown-pdf-template";
import {
  createSynthesisOutputPlan,
  createSynthesisSignals,
} from "../actions/template-synthesis-fixtures";

export { createSynthesisSignals };

export function requestBase(
  input: {
    coverImage?: boolean;
    signals?: MarkdownPdfTemplateCodexRequest["signals"];
  } = {},
): MarkdownPdfTemplateCodexRequest {
  return {
    intent: "adapt this report with a local cover image",
    outputPlan: createSynthesisOutputPlan({ includeCoverAsset: input.coverImage }),
    signals:
      input.signals ??
      createSynthesisSignals(
        input.coverImage
          ? {
              coverImage: {
                fitPressure: "normal",
                height: 800,
                orientationBucket: "landscape",
                width: 1200,
              },
              signalMode: "codex-assisted",
            }
          : { signalMode: "codex-assisted" },
      ),
    workingDirectory: "/repo",
  };
}

export function promptFacts(prompt: string): Record<string, unknown> {
  const marker = "Deterministic facts:\n";
  const index = prompt.indexOf(marker);
  if (index < 0) {
    throw new Error("prompt did not include deterministic facts");
  }
  return JSON.parse(prompt.slice(index + marker.length)) as Record<string, unknown>;
}

export function responseFromDecision(input: {
  coverEnabled?: boolean;
  cssBlocks?: Array<{ css: string; slot: string }>;
  decisionMode?: string;
  fontDecisions?: Array<{
    family: string;
    key: string;
    role: string;
    source: string;
    template_level: boolean;
  }>;
  composition?: string;
  byline?: string;
  imageFit?: string;
  imageAnchor?: string;
  managedAssets?: Array<{ bundle_path: string; source_label: string }>;
  mediaAlign?: string;
  mediaScale?: string;
  recipePreset?: string;
  recipeSource?: string;
  templateFamily?: string;
  textAlign?: string;
  warnings?: string[];
  unsupportedDirections?: string[];
  fallbackReason?: string;
}): string {
  const coverEnabled = input.coverEnabled ?? true;
  const recipePreset = input.recipePreset ?? "article";
  const slotRecipePreset = recipePreset === "none" ? "article" : recipePreset;
  return JSON.stringify({
    decision_mode: input.decisionMode ?? "adapted",
    template_family: input.templateFamily ?? "cover-media-layered",
    recipe_preset: recipePreset,
    slots: {
      recipe_preset: {
        preset: slotRecipePreset,
        source: input.recipeSource ?? "renderer-default",
      },
      cover: {
        enabled: coverEnabled,
        byline: input.byline ?? "none",
        composition: input.composition ?? "media-first-caption",
        image_fit: input.imageFit ?? (coverEnabled ? "cover" : ""),
        image_anchor: input.imageAnchor ?? "center",
        media_align: input.mediaAlign ?? "center",
        media_scale: input.mediaScale ?? (coverEnabled ? "hero" : "balanced"),
        text_align: input.textAlign ?? "center",
        style: coverEnabled ? "media" : "none",
        orientation_bucket: coverEnabled ? "landscape" : "unknown",
        fit_pressure: coverEnabled ? "normal" : "unknown",
      },
      tables: { density: "standard", repeat_header: true, width: "content" },
      code: { style: "shiki-compatible", line_wrap: "wrap", preserve_selectors: true },
      spacing: { density: "standard" },
      typography: { scale: "standard" },
      colors: { palette: "neutral" },
    },
    css_blocks: input.cssBlocks ?? [],
    font_decisions: input.fontDecisions ?? [],
    managed_assets:
      input.managedAssets ??
      (coverEnabled ? [{ bundle_path: "assets/cover.png", source_label: "cover.png" }] : []),
    warnings: input.warnings ?? [],
    unsupported_directions: input.unsupportedDirections ?? [],
    fallback_reason: input.fallbackReason ?? "",
  });
}

export function noUsableResponse(
  input: {
    coverEnabled?: boolean;
    cssBlocks?: Array<{ css: string; slot: string }>;
    managedAssets?: Array<{ bundle_path: string; source_label: string }>;
  } = {},
): string {
  return responseFromDecision({
    coverEnabled: input.coverEnabled ?? false,
    cssBlocks: input.cssBlocks ?? [],
    decisionMode: "no-usable-template",
    managedAssets: input.managedAssets ?? [],
    recipePreset: "none",
    templateFamily: "none",
  });
}
