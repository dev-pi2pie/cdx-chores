import {
  MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT,
  MARKDOWN_PDF_TEMPLATE_CODEX_CSS_BLOCK_SLOTS,
  MARKDOWN_PDF_TEMPLATE_CODEX_FAMILIES,
  MARKDOWN_PDF_TEMPLATE_CODEX_IMAGE_FITS,
  MARKDOWN_PDF_TEMPLATE_CODEX_RECIPE_PRESETS,
  MARKDOWN_PDF_TEMPLATE_CODEX_RECIPE_PRESET_SOURCES,
  MARKDOWN_PDF_TEMPLATE_CODEX_TEMPLATE_FAMILIES,
  type MarkdownPdfTemplateCodexOutputPlan,
} from "../../../cli/markdown-pdf/template-codex";
import type { MarkdownPdfTemplateCodexRequest } from "./types";

function summarizeOutputPlan(outputPlan: MarkdownPdfTemplateCodexOutputPlan) {
  return {
    bundleId: outputPlan.bundleId,
    files: {
      styleCss: outputPlan.styleCss.bundlePath,
      templateHtml: outputPlan.templateHtml.bundlePath,
    },
    managedAssets: outputPlan.assets.map((asset) => ({
      bundlePath: asset.bundlePath,
      role: asset.role,
      sourceBasename: asset.sourceBasename,
    })),
    report: outputPlan.report
      ? {
          bundlePath:
            outputPlan.report.location === "in-bundle" ? outputPlan.report.bundlePath : undefined,
          location: outputPlan.report.location,
        }
      : undefined,
  };
}

function supportedFamilies() {
  return MARKDOWN_PDF_TEMPLATE_CODEX_TEMPLATE_FAMILIES.map((family) => {
    const spec = MARKDOWN_PDF_TEMPLATE_CODEX_FAMILIES[family];
    return {
      id: spec.id,
      label: spec.label,
      description: spec.description,
      requiresCoverImage: spec.requiresCoverImage,
      defaultCoverLayout: spec.defaultCoverLayout,
      defaultCoverTitlePlacement: spec.defaultCoverTitlePlacement,
      requiredTemplateHooks: spec.requiredTemplateHooks,
      requiredCssHooks: spec.requiredCssHooks,
    };
  });
}

export function buildMarkdownPdfTemplateCodexPrompt(
  request: MarkdownPdfTemplateCodexRequest,
): string {
  const facts = {
    assetSizingPolicy: {
      rule: "Use bounded cover.image_fit values, not raw pixel width or height directives.",
      supportedImageFits: MARKDOWN_PDF_TEMPLATE_CODEX_IMAGE_FITS,
      imageSignals: request.signals.coverImage,
    },
    disallowedBehavior: [
      "remote URLs",
      "absolute local paths",
      "raw copied asset bytes",
      "arbitrary extra files",
      "missing Pandoc placeholders",
      "missing required CSS hooks",
      "raw pixel image sizing directives",
    ],
    documentSignals: request.signals.documentSignals,
    fontFacts: {
      hints: request.signals.fonts.hints,
      profileFonts: request.signals.fonts.profileFonts,
    },
    hookRequirements: MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT,
    intent: request.intent ?? "",
    outputPlan: summarizeOutputPlan(request.outputPlan),
    recipeSignal: request.signals.recipe,
    selectedBaseProfile: request.signals.baseProfile,
    signalMode: request.signals.signalMode,
    slotEnums: {
      cssBlockSlots: MARKDOWN_PDF_TEMPLATE_CODEX_CSS_BLOCK_SLOTS,
      imageFits: MARKDOWN_PDF_TEMPLATE_CODEX_IMAGE_FITS,
      recipePresetSources: MARKDOWN_PDF_TEMPLATE_CODEX_RECIPE_PRESET_SOURCES,
      recipePresets: MARKDOWN_PDF_TEMPLATE_CODEX_RECIPE_PRESETS,
      templateFamilies: MARKDOWN_PDF_TEMPLATE_CODEX_TEMPLATE_FAMILIES,
    },
    supportedFamilies: supportedFamilies(),
  };

  return [
    "Review bounded Markdown PDF template facts and return a reusable template decision.",
    "Return JSON only following the provided structured-output schema.",
    "",
    "Rules:",
    "- Return decisions, slots, managed asset references, warnings, and optional bounded CSS blocks only.",
    "- Do not return template.html, style.css, recipe YAML, raw Markdown, copied asset bytes, or arbitrary files.",
    "- Use template_family none, recipe_preset none, css_blocks [], and managed_assets [] when decision_mode is no-usable-template.",
    "- Use managed_assets only for bundle_path values listed in outputPlan.managedAssets.",
    "- Managed asset references must be bundle-relative paths, never source-local absolute paths.",
    "- Use cover.image_fit contain or cover for image sizing; never use raw pixel width or height directives.",
    "- Keep code.style shiki-compatible, code.line_wrap wrap, and code.preserve_selectors true.",
    "- Preserve Pandoc ToC placeholders and required selectors such as #TOC, .cdx-code-line, and .pdf-cover-media.",
    "- Use conservative-fallback when facts are weak but a safe bounded template decision can still be made.",
    "- Use no-usable-template when requested directions require remote fetches, arbitrary files, absolute paths, or unsupported layout behavior.",
    "- Always include fallback_reason; use an empty string when no fallback reason applies.",
    "",
    "Deterministic facts:",
    JSON.stringify(facts, null, 2),
  ].join("\n");
}
