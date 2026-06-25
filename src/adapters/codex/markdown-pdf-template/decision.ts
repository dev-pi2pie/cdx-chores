import {
  MARKDOWN_PDF_TEMPLATE_CODEX_CSS_BLOCK_SLOTS,
  MARKDOWN_PDF_TEMPLATE_CODEX_COVER_COMPOSITIONS,
  MARKDOWN_PDF_TEMPLATE_CODEX_COVER_IMAGE_ANCHORS,
  MARKDOWN_PDF_TEMPLATE_CODEX_COVER_MEDIA_ALIGNS,
  MARKDOWN_PDF_TEMPLATE_CODEX_COVER_MEDIA_SCALES,
  MARKDOWN_PDF_TEMPLATE_CODEX_COVER_TEXT_ALIGNS,
  MARKDOWN_PDF_TEMPLATE_CODEX_DECISION_MODES,
  MARKDOWN_PDF_TEMPLATE_CODEX_FONT_DECISION_SOURCES,
  MARKDOWN_PDF_TEMPLATE_CODEX_FONT_ROLES,
  MARKDOWN_PDF_TEMPLATE_CODEX_IMAGE_FITS,
  MARKDOWN_PDF_TEMPLATE_CODEX_RECIPE_PRESETS,
  MARKDOWN_PDF_TEMPLATE_CODEX_RECIPE_PRESET_SOURCES,
  MARKDOWN_PDF_TEMPLATE_CODEX_TEMPLATE_FAMILIES,
  validateMarkdownPdfTemplateCodexDecision,
  type MarkdownPdfTemplateCodexCssBlockSlot,
  type MarkdownPdfTemplateCodexCoverComposition,
  type MarkdownPdfTemplateCodexCoverLayout,
  type MarkdownPdfTemplateCodexCoverTitlePlacement,
  type MarkdownPdfTemplateCodexDecision,
  type MarkdownPdfTemplateCodexDecisionManagedAsset,
  type MarkdownPdfTemplateCodexImageFit,
  type MarkdownPdfTemplateCodexRecipePresetSource,
  type MarkdownPdfTemplateCodexResolvedSlots,
  type MarkdownPdfTemplateCodexTemplateFontDecision,
} from "../../../cli/markdown-pdf/template-codex";
import type { NormalizedMarkdownPdfOptions } from "../../../cli/markdown-pdf/validation";
import type { MarkdownPdfTemplateCodexRequest, MarkdownPdfTemplateCodexResult } from "./types";

type RawRecord = Record<string, unknown>;

const COVER_STYLE_VALUES = ["none", "media"] as const;
const ORIENTATION_BUCKET_VALUES = [
  "landscape",
  "portrait",
  "square",
  "panoramic",
  "tall",
  "unknown",
] as const;
const FIT_PRESSURE_VALUES = ["normal", "crop-risk", "letterbox-risk", "unknown"] as const;

function parseRecord(value: unknown, context: string): RawRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Markdown PDF template Codex response ${context} must be an object.`);
  }
  return value as RawRecord;
}

function parseString(value: unknown, context: string): string {
  if (typeof value !== "string") {
    throw new Error(`Markdown PDF template Codex response ${context} must be a string.`);
  }
  return value.trim();
}

function parseNonEmptyString(value: unknown, context: string): string {
  const parsed = parseString(value, context);
  if (parsed.length === 0) {
    throw new Error(`Markdown PDF template Codex response ${context} must not be empty.`);
  }
  return parsed;
}

function parseBoolean(value: unknown, context: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Markdown PDF template Codex response ${context} must be a boolean.`);
  }
  return value;
}

function parseStringArray(value: unknown, context: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Markdown PDF template Codex response ${context} must be an array of strings.`);
  }
  return value.map((item, index) => {
    const trimmed = item.trim();
    if (trimmed.length === 0) {
      throw new Error(
        `Markdown PDF template Codex response ${context}[${index}] must not be empty.`,
      );
    }
    return trimmed;
  });
}

function parseEnum<T extends string>(value: unknown, accepted: readonly T[], context: string): T {
  const parsed = parseNonEmptyString(value, context);
  if ((accepted as readonly string[]).includes(parsed)) {
    return parsed as T;
  }
  throw new Error(
    `Markdown PDF template Codex response ${context} must be one of: ${accepted.join(", ")}.`,
  );
}

function parseOptionalEnum<T extends string>(
  value: unknown,
  accepted: readonly T[],
  context: string,
): T | undefined {
  const parsed = parseString(value, context);
  if (parsed.length === 0) {
    return undefined;
  }
  if ((accepted as readonly string[]).includes(parsed)) {
    return parsed as T;
  }
  throw new Error(
    `Markdown PDF template Codex response ${context} must be one of: ${accepted.join(", ")}, or an empty string.`,
  );
}

function parseRecipePreset(
  value: unknown,
  context: string,
): NormalizedMarkdownPdfOptions["preset"] | undefined {
  const parsed = parseString(value, context);
  if (parsed === "none") {
    return undefined;
  }
  if ((MARKDOWN_PDF_TEMPLATE_CODEX_RECIPE_PRESETS as readonly string[]).includes(parsed)) {
    return parsed as NormalizedMarkdownPdfOptions["preset"];
  }
  throw new Error(
    `Markdown PDF template Codex response ${context} must be one of: ${MARKDOWN_PDF_TEMPLATE_CODEX_RECIPE_PRESETS.join(", ")}, none.`,
  );
}

function parseTemplateFamily(value: unknown): MarkdownPdfTemplateCodexDecision["templateFamily"] {
  const parsed = parseString(value, "template_family");
  if (parsed === "none") {
    return undefined;
  }
  if ((MARKDOWN_PDF_TEMPLATE_CODEX_TEMPLATE_FAMILIES as readonly string[]).includes(parsed)) {
    return parsed as MarkdownPdfTemplateCodexDecision["templateFamily"];
  }
  throw new Error(
    `Markdown PDF template Codex response template_family must be one of: ${MARKDOWN_PDF_TEMPLATE_CODEX_TEMPLATE_FAMILIES.join(", ")}, none.`,
  );
}

function coverLayoutFromComposition(input: {
  composition: MarkdownPdfTemplateCodexCoverComposition;
  enabled: boolean;
}): MarkdownPdfTemplateCodexCoverLayout {
  if (!input.enabled) {
    return "none";
  }
  return input.composition === "media-background-overlay" ? "full-bleed-media" : "contained-media";
}

function coverTitlePlacementFromComposition(
  enabled: boolean,
): MarkdownPdfTemplateCodexCoverTitlePlacement {
  return enabled ? "below-media" : "document-title";
}

function parseSlots(value: unknown): MarkdownPdfTemplateCodexResolvedSlots {
  const slots = parseRecord(value, "slots");
  const recipePreset = parseRecord(slots.recipe_preset, "slots.recipe_preset");
  const cover = parseRecord(slots.cover, "slots.cover");
  const tables = parseRecord(slots.tables, "slots.tables");
  const code = parseRecord(slots.code, "slots.code");
  const spacing = parseRecord(slots.spacing, "slots.spacing");
  const typography = parseRecord(slots.typography, "slots.typography");
  const colors = parseRecord(slots.colors, "slots.colors");
  const coverEnabled = parseBoolean(cover.enabled, "slots.cover.enabled");
  const coverComposition = parseEnum(
    cover.composition,
    MARKDOWN_PDF_TEMPLATE_CODEX_COVER_COMPOSITIONS,
    "slots.cover.composition",
  );

  return {
    recipePreset: {
      preset: parseEnum(
        recipePreset.preset,
        MARKDOWN_PDF_TEMPLATE_CODEX_RECIPE_PRESETS,
        "slots.recipe_preset.preset",
      ),
      source: parseEnum(
        recipePreset.source,
        MARKDOWN_PDF_TEMPLATE_CODEX_RECIPE_PRESET_SOURCES,
        "slots.recipe_preset.source",
      ) as MarkdownPdfTemplateCodexRecipePresetSource,
    },
    cover: {
      enabled: coverEnabled,
      composition: coverComposition,
      imageFit: parseOptionalEnum(
        cover.image_fit,
        MARKDOWN_PDF_TEMPLATE_CODEX_IMAGE_FITS,
        "slots.cover.image_fit",
      ) as MarkdownPdfTemplateCodexImageFit | undefined,
      imageAnchor: parseEnum(
        cover.image_anchor,
        MARKDOWN_PDF_TEMPLATE_CODEX_COVER_IMAGE_ANCHORS,
        "slots.cover.image_anchor",
      ),
      layout: coverLayoutFromComposition({
        composition: coverComposition,
        enabled: coverEnabled,
      }),
      mediaAlign: parseEnum(
        cover.media_align,
        MARKDOWN_PDF_TEMPLATE_CODEX_COVER_MEDIA_ALIGNS,
        "slots.cover.media_align",
      ),
      mediaScale: parseEnum(
        cover.media_scale,
        MARKDOWN_PDF_TEMPLATE_CODEX_COVER_MEDIA_SCALES,
        "slots.cover.media_scale",
      ),
      titlePlacement: coverTitlePlacementFromComposition(coverEnabled),
      textAlign: parseEnum(
        cover.text_align,
        MARKDOWN_PDF_TEMPLATE_CODEX_COVER_TEXT_ALIGNS,
        "slots.cover.text_align",
      ),
      style: parseEnum(cover.style, COVER_STYLE_VALUES, "slots.cover.style"),
      orientationBucket: parseEnum(
        cover.orientation_bucket,
        ORIENTATION_BUCKET_VALUES,
        "slots.cover.orientation_bucket",
      ),
      fitPressure: parseEnum(cover.fit_pressure, FIT_PRESSURE_VALUES, "slots.cover.fit_pressure"),
    },
    tables: {
      density: parseEnum(tables.density, ["compact", "standard", "wide"], "slots.tables.density"),
      repeatHeader: parseBoolean(tables.repeat_header, "slots.tables.repeat_header"),
      width: parseEnum(tables.width, ["content", "full"], "slots.tables.width"),
    },
    code: {
      style: parseEnum(code.style, ["shiki-compatible"], "slots.code.style"),
      lineWrap: parseEnum(code.line_wrap, ["wrap"], "slots.code.line_wrap"),
      preserveSelectors: parseBoolean(code.preserve_selectors, "slots.code.preserve_selectors"),
    },
    spacing: {
      density: parseEnum(
        spacing.density,
        ["compact", "standard", "spacious"],
        "slots.spacing.density",
      ),
    },
    typography: {
      scale: parseEnum(
        typography.scale,
        ["compact", "standard", "reader"],
        "slots.typography.scale",
      ),
    },
    color: {
      palette: parseEnum(colors.palette, ["neutral"], "slots.colors.palette"),
    },
  };
}

function parseCssBlocks(value: unknown): MarkdownPdfTemplateCodexDecision["cssBlocks"] {
  if (!Array.isArray(value)) {
    throw new Error("Markdown PDF template Codex response css_blocks must be an array.");
  }
  return value.map((item, index) => {
    const block = parseRecord(item, `css_blocks[${index}]`);
    return {
      css: parseNonEmptyString(block.css, `css_blocks[${index}].css`),
      slot: parseEnum(
        block.slot,
        MARKDOWN_PDF_TEMPLATE_CODEX_CSS_BLOCK_SLOTS,
        `css_blocks[${index}].slot`,
      ) as MarkdownPdfTemplateCodexCssBlockSlot,
    };
  });
}

function parseManagedAssets(value: unknown): MarkdownPdfTemplateCodexDecisionManagedAsset[] {
  if (!Array.isArray(value)) {
    throw new Error("Markdown PDF template Codex response managed_assets must be an array.");
  }
  return value.map((item, index) => {
    const asset = parseRecord(item, `managed_assets[${index}]`);
    return {
      bundlePath: parseNonEmptyString(asset.bundle_path, `managed_assets[${index}].bundle_path`),
      sourceLabel: parseNonEmptyString(asset.source_label, `managed_assets[${index}].source_label`),
    };
  });
}

function parseFontDecisions(value: unknown): MarkdownPdfTemplateCodexTemplateFontDecision[] {
  if (!Array.isArray(value)) {
    throw new Error("Markdown PDF template Codex response font_decisions must be an array.");
  }
  return value.map((item, index) => {
    const decision = parseRecord(item, `font_decisions[${index}]`);
    return {
      role: parseEnum(
        decision.role,
        MARKDOWN_PDF_TEMPLATE_CODEX_FONT_ROLES,
        `font_decisions[${index}].role`,
      ),
      key: parseNonEmptyString(decision.key, `font_decisions[${index}].key`),
      family: parseNonEmptyString(decision.family, `font_decisions[${index}].family`),
      source: parseEnum(
        decision.source,
        MARKDOWN_PDF_TEMPLATE_CODEX_FONT_DECISION_SOURCES,
        `font_decisions[${index}].source`,
      ),
      templateLevel: parseBoolean(
        decision.template_level,
        `font_decisions[${index}].template_level`,
      ),
    };
  });
}

export function parseMarkdownPdfTemplateCodexDecision(
  finalResponse: string,
): MarkdownPdfTemplateCodexDecision {
  const parsed = parseRecord(JSON.parse(finalResponse), "root");
  return {
    decisionMode: parseEnum(
      parsed.decision_mode,
      MARKDOWN_PDF_TEMPLATE_CODEX_DECISION_MODES,
      "decision_mode",
    ),
    templateFamily: parseTemplateFamily(parsed.template_family),
    recipePreset: parseRecipePreset(parsed.recipe_preset, "recipe_preset"),
    slots: parseSlots(parsed.slots),
    cssBlocks: parseCssBlocks(parsed.css_blocks),
    fontDecisions: parseFontDecisions(parsed.font_decisions),
    managedAssets: parseManagedAssets(parsed.managed_assets),
    warnings: parseStringArray(parsed.warnings, "warnings"),
    unsupportedDirections: parseStringArray(
      parsed.unsupported_directions,
      "unsupported_directions",
    ),
    fallbackReason: parseString(parsed.fallback_reason, "fallback_reason") || undefined,
  };
}

export function applyMarkdownPdfTemplateCodexDecision(input: {
  decision: MarkdownPdfTemplateCodexDecision;
  request: MarkdownPdfTemplateCodexRequest;
}): MarkdownPdfTemplateCodexResult {
  return {
    decision: validateMarkdownPdfTemplateCodexDecision({
      decision: input.decision,
      outputPlan: input.request.outputPlan,
      signals: input.request.signals,
    }),
  };
}
