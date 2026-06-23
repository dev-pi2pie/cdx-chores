import type { NormalizedMarkdownPdfOptions } from "../validation";
import { MARKDOWN_PDF_TEMPLATE_CODEX_FAMILIES } from "./families";
import {
  validateMarkdownPdfTemplateCodexCssBlocks,
  type MarkdownPdfTemplateCodexCssBlock,
  type MarkdownPdfTemplateCodexCssBlockSlot,
} from "./css-blocks";
import type {
  MarkdownPdfTemplateCodexDecisionMode,
  MarkdownPdfTemplateCodexImageFit,
  MarkdownPdfTemplateCodexOutputPlan,
  MarkdownPdfTemplateCodexRecipePresetSource,
  MarkdownPdfTemplateCodexResolvedSlots,
  MarkdownPdfTemplateCodexTemplateFontDecision,
  MarkdownPdfTemplateCodexTemplateFontDecisionSource,
  MarkdownPdfTemplateCodexTemplateFamily,
  MdPdfTemplateCodexSignalCollection,
} from "./types";

export const MARKDOWN_PDF_TEMPLATE_CODEX_DECISION_MODES = [
  "adapted",
  "conservative-fallback",
  "no-usable-template",
] as const satisfies readonly MarkdownPdfTemplateCodexDecisionMode[];

export const MARKDOWN_PDF_TEMPLATE_CODEX_TEMPLATE_FAMILIES = [
  "document-layered",
  "cover-media-layered",
] as const satisfies readonly MarkdownPdfTemplateCodexTemplateFamily[];

export const MARKDOWN_PDF_TEMPLATE_CODEX_RECIPE_PRESETS = [
  "article",
  "report",
  "wide-table",
  "compact",
  "reader",
] as const satisfies readonly NormalizedMarkdownPdfOptions["preset"][];

export const MARKDOWN_PDF_TEMPLATE_CODEX_IMAGE_FITS = [
  "contain",
  "cover",
] as const satisfies readonly MarkdownPdfTemplateCodexImageFit[];

export const MARKDOWN_PDF_TEMPLATE_CODEX_RECIPE_PRESET_SOURCES = [
  "explicit-recipe",
  "base-profile",
  "renderer-default",
] as const satisfies readonly MarkdownPdfTemplateCodexRecipePresetSource[];

export const MARKDOWN_PDF_TEMPLATE_CODEX_FONT_ROLES = [
  "body",
  "heading",
  "code",
] as const satisfies readonly MarkdownPdfTemplateCodexTemplateFontDecision["role"][];

export const MARKDOWN_PDF_TEMPLATE_CODEX_FONT_DECISION_SOURCES = [
  "font-hint",
  "template-style",
] as const satisfies readonly MarkdownPdfTemplateCodexTemplateFontDecisionSource[];

export interface MarkdownPdfTemplateCodexDecisionManagedAsset {
  sourceLabel: string;
  bundlePath: string;
}

export interface MarkdownPdfTemplateCodexDecision {
  decisionMode: MarkdownPdfTemplateCodexDecisionMode;
  templateFamily?: MarkdownPdfTemplateCodexTemplateFamily;
  recipePreset?: NormalizedMarkdownPdfOptions["preset"];
  slots: MarkdownPdfTemplateCodexResolvedSlots;
  cssBlocks: MarkdownPdfTemplateCodexCssBlock[];
  fontDecisions: MarkdownPdfTemplateCodexTemplateFontDecision[];
  managedAssets: MarkdownPdfTemplateCodexDecisionManagedAsset[];
  warnings: string[];
  unsupportedDirections: string[];
  fallbackReason?: string;
}

function assertStringInDomain<T extends string>(
  value: string,
  accepted: readonly T[],
  context: string,
): T {
  if ((accepted as readonly string[]).includes(value)) {
    return value as T;
  }
  throw new Error(
    `Markdown PDF template Codex response ${context} must be one of: ${accepted.join(", ")}.`,
  );
}

function assertNonEmptyString(value: string, context: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`Markdown PDF template Codex response ${context} must not be empty.`);
  }
  return trimmed;
}

function assertBoolean(value: boolean, context: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Markdown PDF template Codex response ${context} must be a boolean.`);
  }
  return value;
}

function validateStringArray(values: readonly string[], context: string): string[] {
  return values.map((value, index) => assertNonEmptyString(value, `${context}[${index}]`));
}

function validateSlots(
  slots: MarkdownPdfTemplateCodexResolvedSlots,
): MarkdownPdfTemplateCodexResolvedSlots {
  assertStringInDomain(
    slots.recipePreset.preset,
    MARKDOWN_PDF_TEMPLATE_CODEX_RECIPE_PRESETS,
    "slots.recipe_preset.preset",
  );
  assertStringInDomain(
    slots.recipePreset.source,
    MARKDOWN_PDF_TEMPLATE_CODEX_RECIPE_PRESET_SOURCES,
    "slots.recipe_preset.source",
  );
  if (slots.cover.imageFit !== undefined) {
    assertStringInDomain(
      slots.cover.imageFit,
      MARKDOWN_PDF_TEMPLATE_CODEX_IMAGE_FITS,
      "slots.cover.image_fit",
    );
  }
  if (slots.cover.enabled && !slots.cover.imageFit) {
    throw new Error(
      "Markdown PDF template Codex response slots.cover.image_fit is required when cover is enabled.",
    );
  }
  if (!slots.code.preserveSelectors) {
    throw new Error(
      "Markdown PDF template Codex response slots.code.preserve_selectors must be true.",
    );
  }
  if (slots.code.style !== "shiki-compatible" || slots.code.lineWrap !== "wrap") {
    throw new Error(
      "Markdown PDF template Codex response slots.code must preserve the shiki-compatible wrap contract.",
    );
  }
  if (slots.color.palette !== "neutral") {
    throw new Error(
      "Markdown PDF template Codex response slots.colors.palette must use the neutral palette.",
    );
  }
  return slots;
}

function validateManagedAssets(input: {
  decisionMode: MarkdownPdfTemplateCodexDecisionMode;
  managedAssets: readonly MarkdownPdfTemplateCodexDecisionManagedAsset[];
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
}): MarkdownPdfTemplateCodexDecisionManagedAsset[] {
  if (input.decisionMode === "no-usable-template") {
    if (input.managedAssets.length > 0) {
      throw new Error(
        "Markdown PDF template Codex response managed_assets must be empty for no-usable-template.",
      );
    }
    return [];
  }
  const plannedAssetsByBundlePath = new Map(
    input.outputPlan.assets.map((asset) => [asset.bundlePath, asset]),
  );
  return input.managedAssets.map((asset, index) => {
    const bundlePath = assertNonEmptyString(
      asset.bundlePath,
      `managed_assets[${index}].bundle_path`,
    );
    const plannedAsset = plannedAssetsByBundlePath.get(bundlePath);
    if (!plannedAsset) {
      throw new Error(
        `Markdown PDF template Codex response managed_assets[${index}].bundle_path is not in the output plan: ${bundlePath}`,
      );
    }
    if (
      /^https?:\/\//iu.test(bundlePath) ||
      bundlePath.startsWith("/") ||
      bundlePath.includes("..")
    ) {
      throw new Error(
        `Markdown PDF template Codex response managed_assets[${index}].bundle_path must be bundle-relative.`,
      );
    }
    return {
      bundlePath,
      sourceLabel: plannedAsset.sourceBasename,
    };
  });
}

function validateTemplateFontFamily(value: string, context: string): string {
  const family = assertNonEmptyString(value, context);
  if (/[;{}(),\r\n]/u.test(family)) {
    throw new Error(
      `Markdown PDF template Codex response ${context} must be a single font family name, not raw CSS.`,
    );
  }
  return family;
}

function validateTemplateFontDecisions(
  decisions: readonly MarkdownPdfTemplateCodexTemplateFontDecision[],
): MarkdownPdfTemplateCodexTemplateFontDecision[] {
  const seenRoles = new Set<MarkdownPdfTemplateCodexTemplateFontDecision["role"]>();
  return decisions.map((decision, index) => {
    const role = assertStringInDomain(
      decision.role,
      MARKDOWN_PDF_TEMPLATE_CODEX_FONT_ROLES,
      `font_decisions[${index}].role`,
    );
    if (seenRoles.has(role)) {
      throw new Error(
        `Markdown PDF template Codex response font_decisions[${index}].role duplicates role ${role}.`,
      );
    }
    seenRoles.add(role);
    return {
      role,
      family: validateTemplateFontFamily(decision.family, `font_decisions[${index}].family`),
      source: assertStringInDomain(
        decision.source,
        MARKDOWN_PDF_TEMPLATE_CODEX_FONT_DECISION_SOURCES,
        `font_decisions[${index}].source`,
      ),
      templateLevel: assertBoolean(
        decision.templateLevel,
        `font_decisions[${index}].template_level`,
      ),
    };
  });
}

export function validateMarkdownPdfTemplateCodexDecision(input: {
  decision: MarkdownPdfTemplateCodexDecision;
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  signals: MdPdfTemplateCodexSignalCollection;
}): MarkdownPdfTemplateCodexDecision {
  const decisionMode = assertStringInDomain(
    input.decision.decisionMode,
    MARKDOWN_PDF_TEMPLATE_CODEX_DECISION_MODES,
    "decision_mode",
  );
  const cssBlocks =
    decisionMode === "no-usable-template"
      ? []
      : validateMarkdownPdfTemplateCodexCssBlocks(input.decision.cssBlocks);
  if (decisionMode === "no-usable-template") {
    if (input.decision.templateFamily) {
      throw new Error(
        "Markdown PDF template Codex response template_family must be none for no-usable-template.",
      );
    }
    if (input.decision.recipePreset) {
      throw new Error(
        "Markdown PDF template Codex response recipe_preset must be none for no-usable-template.",
      );
    }
    if (input.decision.cssBlocks.length > 0) {
      throw new Error(
        "Markdown PDF template Codex response css_blocks must be empty for no-usable-template.",
      );
    }
    if (input.decision.fontDecisions.length > 0) {
      throw new Error(
        "Markdown PDF template Codex response font_decisions must be empty for no-usable-template.",
      );
    }
    return {
      decisionMode,
      slots: validateSlots(input.decision.slots),
      cssBlocks,
      fontDecisions: [],
      managedAssets: validateManagedAssets({
        decisionMode,
        managedAssets: input.decision.managedAssets,
        outputPlan: input.outputPlan,
      }),
      warnings: validateStringArray(input.decision.warnings, "warnings"),
      unsupportedDirections: validateStringArray(
        input.decision.unsupportedDirections,
        "unsupported_directions",
      ),
      fallbackReason: input.decision.fallbackReason?.trim() || undefined,
    };
  }

  if (!input.decision.templateFamily) {
    throw new Error("Markdown PDF template Codex response template_family is required.");
  }
  const templateFamily = assertStringInDomain(
    input.decision.templateFamily,
    MARKDOWN_PDF_TEMPLATE_CODEX_TEMPLATE_FAMILIES,
    "template_family",
  );
  const family = MARKDOWN_PDF_TEMPLATE_CODEX_FAMILIES[templateFamily];
  if (family.requiresCoverImage && !input.signals.coverImage.available) {
    throw new Error(
      `Markdown PDF template Codex response template_family ${templateFamily} requires a managed cover image.`,
    );
  }
  if (!input.decision.recipePreset) {
    throw new Error("Markdown PDF template Codex response recipe_preset is required.");
  }
  const recipePreset = assertStringInDomain(
    input.decision.recipePreset,
    MARKDOWN_PDF_TEMPLATE_CODEX_RECIPE_PRESETS,
    "recipe_preset",
  );
  return {
    decisionMode,
    templateFamily,
    recipePreset,
    slots: validateSlots(input.decision.slots),
    cssBlocks,
    fontDecisions: validateTemplateFontDecisions(input.decision.fontDecisions),
    managedAssets: validateManagedAssets({
      decisionMode,
      managedAssets: input.decision.managedAssets,
      outputPlan: input.outputPlan,
    }),
    warnings: validateStringArray(input.decision.warnings, "warnings"),
    unsupportedDirections: validateStringArray(
      input.decision.unsupportedDirections,
      "unsupported_directions",
    ),
    fallbackReason: input.decision.fallbackReason?.trim() || undefined,
  };
}

export type { MarkdownPdfTemplateCodexCssBlock, MarkdownPdfTemplateCodexCssBlockSlot };
