import type { NormalizedMarkdownPdfOptions } from "../validation";
import { MARKDOWN_PDF_TEMPLATE_CODEX_FAMILIES } from "./families";
import { validateMarkdownPdfBodyFontKey } from "../profile/schema";
import { canonicalizeMdPdfTemplateFontKey } from "./font-keys";
import {
  validateMarkdownPdfTemplateCodexCssBlocks,
  type MarkdownPdfTemplateCodexCssBlock,
  type MarkdownPdfTemplateCodexCssBlockSlot,
} from "./css-blocks";
import type {
  MarkdownPdfTemplateCodexDecisionMode,
  MarkdownPdfTemplateCodexFontRole,
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
  "document-signal",
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

function validateTemplateFontKey(input: {
  context: string;
  key: string;
  role: MarkdownPdfTemplateCodexTemplateFontDecision["role"];
}): string {
  const key = assertNonEmptyString(input.key, `${input.context}.key`);
  if (input.role === "body") {
    try {
      validateMarkdownPdfBodyFontKey(key);
    } catch {
      throw new Error(
        `Markdown PDF template Codex response ${input.context}.key must be default or a valid language tag for body fonts.`,
      );
    }
    return key;
  }
  if (input.role === "code" && (key === "default" || key === "symbols")) {
    return key;
  }
  if (input.role === "heading" && key === "default") {
    return key;
  }
  if (input.role === "code") {
    throw new Error(
      `Markdown PDF template Codex response ${input.context}.key must be default or symbols for code fonts.`,
    );
  }
  throw new Error(
    `Markdown PDF template Codex response ${input.context}.key must be default for ${input.role} fonts.`,
  );
}

function validateTemplateFontDecisions(
  decisions: readonly MarkdownPdfTemplateCodexTemplateFontDecision[],
): MarkdownPdfTemplateCodexTemplateFontDecision[] {
  const seenRoleKeys = new Set<string>();
  return decisions.map((decision, index) => {
    const context = `font_decisions[${index}]`;
    const role = assertStringInDomain(
      decision.role,
      MARKDOWN_PDF_TEMPLATE_CODEX_FONT_ROLES,
      `${context}.role`,
    );
    const key = validateTemplateFontKey({
      context,
      key: decision.key,
      role,
    });
    const canonicalKey = canonicalizeMdPdfTemplateFontKey(role, key);
    const roleKey = `${role}.${canonicalKey}`;
    if (seenRoleKeys.has(roleKey)) {
      throw new Error(
        `Markdown PDF template Codex response ${context}.key duplicates font role/key ${roleKey}.`,
      );
    }
    seenRoleKeys.add(roleKey);
    const source = assertStringInDomain(
      decision.source,
      MARKDOWN_PDF_TEMPLATE_CODEX_FONT_DECISION_SOURCES,
      `${context}.source`,
    );
    const templateLevel = assertBoolean(decision.templateLevel, `${context}.template_level`);
    if (templateLevel && source !== "template-style") {
      throw new Error(
        `Markdown PDF template Codex response ${context}.template_level requires source template-style.`,
      );
    }
    return {
      role,
      key: canonicalKey,
      family: validateTemplateFontFamily(decision.family, `${context}.family`),
      source,
      templateLevel,
    };
  });
}

function fontRoleKey(role: MarkdownPdfTemplateCodexFontRole, key: string): string {
  return `${role}.${canonicalizeMdPdfTemplateFontKey(role, key)}`;
}

function fontHintTargetForDescription(
  description: string,
): Pick<MarkdownPdfTemplateCodexTemplateFontDecision, "key" | "role"> | undefined {
  const normalized = description.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (/\bsymbols?\b/u.test(normalized)) {
    return { role: "code", key: "symbols" };
  }
  if (/\b(?:code|monospace|mono)\b/u.test(normalized)) {
    return { role: "code", key: "default" };
  }
  if (/\b(?:heading|headings|title|titles)\b/u.test(normalized)) {
    return { role: "heading", key: "default" };
  }
  if (/\b(?:japanese|ja|jp)\b/u.test(normalized)) {
    return { role: "body", key: "ja" };
  }
  if (
    /\b(?:traditional chinese|traditional-chinese|繁體|繁体|zh-hant|zh_hant)\b/u.test(normalized)
  ) {
    return { role: "body", key: "zh-Hant" };
  }
  if (/\b(?:english|en|body|text|serif)\b/u.test(normalized)) {
    return { role: "body", key: "default" };
  }
  return undefined;
}

function templateFontDecisionsFromFontHints(
  hints: readonly string[],
): MarkdownPdfTemplateCodexTemplateFontDecision[] {
  const decisions: MarkdownPdfTemplateCodexTemplateFontDecision[] = [];
  const seen = new Set<string>();
  for (const hint of hints) {
    for (const rawSegment of hint.split(/[;,]/u)) {
      const segment = rawSegment.trim().replace(/^(?:use|and)\s+/iu, "");
      const match = /^(?<family>.+?)\s+for\s+(?<target>.+)$/iu.exec(segment);
      const family = match?.groups?.family?.trim();
      const target = match?.groups?.target
        ? fontHintTargetForDescription(match.groups.target)
        : undefined;
      if (!family || !target) {
        continue;
      }
      const roleKey = fontRoleKey(target.role, target.key);
      if (seen.has(roleKey)) {
        continue;
      }
      seen.add(roleKey);
      decisions.push({
        family: validateTemplateFontFamily(family, `font hint ${roleKey}`),
        key: canonicalizeMdPdfTemplateFontKey(target.role, target.key),
        role: target.role,
        source: "font-hint",
        templateLevel: false,
      });
    }
  }
  return decisions;
}

function completeFontHintDecisions(input: {
  decisions: readonly MarkdownPdfTemplateCodexTemplateFontDecision[];
  signals: MdPdfTemplateCodexSignalCollection;
}): MarkdownPdfTemplateCodexTemplateFontDecision[] {
  const completed = [...input.decisions];
  const seen = new Set(completed.map((decision) => fontRoleKey(decision.role, decision.key)));
  for (const decision of templateFontDecisionsFromFontHints(input.signals.fonts.hints)) {
    const roleKey = fontRoleKey(decision.role, decision.key);
    if (seen.has(roleKey)) {
      continue;
    }
    seen.add(roleKey);
    completed.push(decision);
  }
  return completed;
}

function expectedRecipePresetSource(
  signals: MdPdfTemplateCodexSignalCollection,
): MarkdownPdfTemplateCodexRecipePresetSource {
  if (signals.recipe.explicitFields.includes("preset")) {
    return "explicit-recipe";
  }
  if (signals.recipe.layoutPolicy.recipePreset.status === "applied") {
    return "document-signal";
  }
  if (signals.baseProfile.available && signals.baseProfile.summary?.preset) {
    return "base-profile";
  }
  return "renderer-default";
}

function validateRecipeOwnership(input: {
  recipePreset: NormalizedMarkdownPdfOptions["preset"];
  slots: MarkdownPdfTemplateCodexResolvedSlots;
  signals: MdPdfTemplateCodexSignalCollection;
}): void {
  const expectedPreset = input.signals.recipe.effectiveOptions.preset;
  if (input.recipePreset !== expectedPreset || input.slots.recipePreset.preset !== expectedPreset) {
    throw new Error(
      `Markdown PDF template Codex response recipe_preset must match the effective recipe preset: ${expectedPreset}.`,
    );
  }
  const expectedSource = expectedRecipePresetSource(input.signals);
  if (input.slots.recipePreset.source !== expectedSource) {
    throw new Error(
      `Markdown PDF template Codex response slots.recipe_preset.source must match the effective recipe source: ${expectedSource}.`,
    );
  }
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
  const slots = validateSlots(input.decision.slots);
  validateRecipeOwnership({
    recipePreset,
    slots,
    signals: input.signals,
  });
  const fontDecisions = completeFontHintDecisions({
    decisions: validateTemplateFontDecisions(input.decision.fontDecisions),
    signals: input.signals,
  });
  return {
    decisionMode,
    templateFamily,
    recipePreset,
    slots,
    cssBlocks,
    fontDecisions,
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
