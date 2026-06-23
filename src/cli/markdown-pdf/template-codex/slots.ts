import type {
  MarkdownPdfTemplateCodexImageFit,
  MarkdownPdfTemplateCodexRecipePresetSource,
  MarkdownPdfTemplateCodexResolvedSlots,
  MarkdownPdfTemplateCodexTemplateFamily,
  MarkdownPdfTemplateCodexThemeTokens,
  MdPdfTemplateCodexSignalCollection,
} from "./types";
import { MARKDOWN_PDF_TEMPLATE_CODEX_FAMILIES } from "./families";
import type { NormalizedMarkdownPdfOptions } from "../validation";

type TemplateCodexPresetDefaults = {
  bodySize: string;
  lineHeight: string;
  spacingDensity: MarkdownPdfTemplateCodexResolvedSlots["spacing"]["density"];
  tableDensity: MarkdownPdfTemplateCodexResolvedSlots["tables"]["density"];
  tableWidth: MarkdownPdfTemplateCodexResolvedSlots["tables"]["width"];
  typographyScale: MarkdownPdfTemplateCodexResolvedSlots["typography"]["scale"];
};

const PRESET_DEFAULTS: Record<NormalizedMarkdownPdfOptions["preset"], TemplateCodexPresetDefaults> =
  {
    article: {
      bodySize: "10.5pt",
      lineHeight: "1.5",
      spacingDensity: "standard",
      tableDensity: "standard",
      tableWidth: "content",
      typographyScale: "standard",
    },
    report: {
      bodySize: "10.5pt",
      lineHeight: "1.5",
      spacingDensity: "standard",
      tableDensity: "standard",
      tableWidth: "content",
      typographyScale: "standard",
    },
    "wide-table": {
      bodySize: "9.5pt",
      lineHeight: "1.5",
      spacingDensity: "standard",
      tableDensity: "wide",
      tableWidth: "full",
      typographyScale: "standard",
    },
    compact: {
      bodySize: "9.5pt",
      lineHeight: "1.5",
      spacingDensity: "compact",
      tableDensity: "compact",
      tableWidth: "content",
      typographyScale: "compact",
    },
    reader: {
      bodySize: "12pt",
      lineHeight: "1.65",
      spacingDensity: "spacious",
      tableDensity: "standard",
      tableWidth: "content",
      typographyScale: "reader",
    },
  };

function recipePresetSource(
  signals: MdPdfTemplateCodexSignalCollection,
): MarkdownPdfTemplateCodexRecipePresetSource {
  if (signals.recipe.explicitFields.includes("preset")) {
    return "explicit-recipe";
  }
  if (signals.baseProfile.available && signals.baseProfile.summary?.preset) {
    return "base-profile";
  }
  return "renderer-default";
}

function presetDefaults(signals: MdPdfTemplateCodexSignalCollection): TemplateCodexPresetDefaults {
  return PRESET_DEFAULTS[signals.recipe.effectiveOptions.preset];
}

function coverImageFit(
  signals: MdPdfTemplateCodexSignalCollection,
): MarkdownPdfTemplateCodexImageFit {
  if (
    signals.signalMode === "cover-image-only" ||
    signals.coverImage.fitPressure !== "normal" ||
    signals.coverImage.orientationBucket === "unknown"
  ) {
    return "contain";
  }
  return "cover";
}

export function resolveMdPdfTemplateCodexSlots(input: {
  family: MarkdownPdfTemplateCodexTemplateFamily;
  signals: MdPdfTemplateCodexSignalCollection;
}): MarkdownPdfTemplateCodexResolvedSlots {
  const family = MARKDOWN_PDF_TEMPLATE_CODEX_FAMILIES[input.family];
  const defaults = presetDefaults(input.signals);
  const hasCover = family.requiresCoverImage && input.signals.coverImage.available;

  return {
    recipePreset: {
      preset: input.signals.recipe.effectiveOptions.preset,
      source: recipePresetSource(input.signals),
    },
    cover: {
      enabled: hasCover,
      ...(hasCover
        ? {
            imageFit: coverImageFit(input.signals),
          }
        : {}),
      layout: hasCover ? family.defaultCoverLayout : "none",
      titlePlacement: hasCover ? family.defaultCoverTitlePlacement : "document-title",
      style: hasCover ? "media" : "none",
      orientationBucket: input.signals.coverImage.orientationBucket,
      fitPressure: input.signals.coverImage.fitPressure,
    },
    tables: {
      density: defaults.tableDensity,
      repeatHeader: true,
      width: defaults.tableWidth,
    },
    code: {
      style: "shiki-compatible",
      lineWrap: "wrap",
      preserveSelectors: true,
    },
    spacing: {
      density: defaults.spacingDensity,
    },
    typography: {
      scale: defaults.typographyScale,
    },
    color: {
      palette: "neutral",
    },
  };
}

export function resolveMdPdfTemplateCodexThemeTokens(
  signals: MdPdfTemplateCodexSignalCollection,
  slots: MarkdownPdfTemplateCodexResolvedSlots,
): MarkdownPdfTemplateCodexThemeTokens {
  const defaults = presetDefaults(signals);
  return {
    bodyFont: '"Noto Serif", "Georgia", serif',
    headingFont: '"Noto Sans", "Arial", sans-serif',
    monospaceFont: '"Noto Sans Mono", "SFMono-Regular", "Consolas", monospace',
    bodySize: defaults.bodySize,
    lineHeight: defaults.lineHeight,
    blockGap:
      slots.spacing.density === "compact"
        ? "0.35rem"
        : slots.spacing.density === "spacious"
          ? "0.8rem"
          : "0.55rem",
    text: "#171717",
    background: "#ffffff",
    muted: "#555555",
    accent: "#1f5f8b",
    border: "#d8d8d8",
    codeBackground: "#f5f5f5",
  };
}
