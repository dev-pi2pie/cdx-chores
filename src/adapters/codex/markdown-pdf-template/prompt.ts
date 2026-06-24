import {
  MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT,
  MARKDOWN_PDF_TEMPLATE_CODEX_CSS_BLOCK_SLOTS,
  MARKDOWN_PDF_TEMPLATE_CODEX_FAMILIES,
  MARKDOWN_PDF_TEMPLATE_CODEX_FONT_DECISION_SOURCES,
  MARKDOWN_PDF_TEMPLATE_CODEX_FONT_ROLES,
  MARKDOWN_PDF_TEMPLATE_CODEX_IMAGE_FITS,
  MARKDOWN_PDF_TEMPLATE_CODEX_RECIPE_PRESETS,
  MARKDOWN_PDF_TEMPLATE_CODEX_RECIPE_PRESET_SOURCES,
  MARKDOWN_PDF_TEMPLATE_CODEX_TEMPLATE_FAMILIES,
  type MarkdownPdfTemplateCodexOutputPlan,
  type MarkdownPdfTemplateCodexRecipePresetSource,
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

function expectedRecipePresetSource(
  request: MarkdownPdfTemplateCodexRequest,
): MarkdownPdfTemplateCodexRecipePresetSource {
  if (request.signals.recipe.explicitFields.includes("preset")) {
    return "explicit-recipe";
  }
  if (request.signals.recipe.layoutPolicy.recipePreset.status === "applied") {
    return "document-signal";
  }
  if (request.signals.baseProfile.available && request.signals.baseProfile.summary?.preset) {
    return "base-profile";
  }
  return "renderer-default";
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
      "template-owned page-number margin boxes",
    ],
    documentSignals: request.signals.documentSignals,
    fontFacts: {
      hints: request.signals.fonts.hints,
      profileFonts: request.signals.fonts.profileFonts,
    },
    fontDecisionPolicy: {
      roles: MARKDOWN_PDF_TEMPLATE_CODEX_FONT_ROLES,
      sources: MARKDOWN_PDF_TEMPLATE_CODEX_FONT_DECISION_SOURCES,
      rule: "Return font_decisions only for bounded body, heading, or code family choices. Loose font hints must not override concrete base-profile fonts unless template_level is true and the choice is explicitly template-owned.",
    },
    hookRequirements: MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT,
    intent: request.intent ?? "",
    layoutDecisionPolicy: {
      tableLayoutSignal: request.signals.recipe.layoutPolicy.tableLayoutSignal,
      recipePresetPolicy: request.signals.recipe.layoutPolicy.recipePreset,
      schemaRecipePresetSource: expectedRecipePresetSource(request),
      rules: [
        "Strong tableLayoutSignal may derive wide-table only when no explicit recipe or base-profile page recipe owner exists.",
        "Weak tableLayoutSignal supports table density/styling only and must not force landscape.",
        "Returned recipe_preset and slots.recipe_preset must match recipeSignal.effectiveOptions and schemaRecipePresetSource.",
      ],
    },
    titleDecisionPolicy: {
      documentTitleSignal: request.signals.documentSignals.title,
      templateTitleSignal: request.signals.title,
      rules: [
        "Explicit keep/hide metadata title intent outranks duplicate-title default behavior.",
        "Base-profile titleBlock.metadataTitle show or hide must be preserved because custom templates replace profile-generated HTML.",
        "When cover slots own visible title placement, suppress the separate metadata title block unless explicit/base-profile show ownership says otherwise.",
        "Do not rewrite Markdown H1 content or mutate frontmatter title.",
      ],
    },
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
    "- Use font_decisions [] when no bounded template font choice is needed or when decision_mode is no-usable-template.",
    "- font_decisions may name one family per body, heading, or code role; do not return raw font-family CSS stacks.",
    "- Set font_decisions[].template_level true only with source template-style, when the template should explicitly own that font role over a base-profile font.",
    "- Use managed_assets only for bundle_path values listed in outputPlan.managedAssets.",
    "- Managed asset references must be bundle-relative paths, never source-local absolute paths.",
    "- Use cover.image_fit contain or cover for image sizing; never use raw pixel width or height directives.",
    "- Do not emit page-number CSS or @page margin boxes; page numbers remain profile-owned.",
    "- Follow layoutDecisionPolicy for table pressure, wide-table derivation, and recipe ownership.",
    "- Return recipe_preset and slots.recipe_preset exactly matching recipeSignal.effectiveOptions.preset and layoutDecisionPolicy.schemaRecipePresetSource.",
    "- Follow titleDecisionPolicy; preserve explicit title intent and base-profile titleBlock.metadataTitle ownership.",
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
