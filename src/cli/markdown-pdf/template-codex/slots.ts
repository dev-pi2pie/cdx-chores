import type {
  MarkdownPdfTemplateCodexImageFit,
  MarkdownPdfTemplateCodexRecipePresetSource,
  MarkdownPdfTemplateCodexResolvedSlots,
  MarkdownPdfTemplateCodexTemplateFamily,
  MarkdownPdfTemplateCodexThemeTokens,
  MdPdfTemplateCodexSignalCollection,
} from "./types";
import { MARKDOWN_PDF_TEMPLATE_CODEX_FAMILIES } from "./families";

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

function tableDensity(
  signals: MdPdfTemplateCodexSignalCollection,
): MarkdownPdfTemplateCodexResolvedSlots["tables"]["density"] {
  if (signals.recipe.effectiveOptions.preset === "wide-table") {
    return "wide";
  }
  if (signals.recipe.effectiveOptions.preset === "compact") {
    return "compact";
  }
  return "standard";
}

function spacingDensity(
  signals: MdPdfTemplateCodexSignalCollection,
): MarkdownPdfTemplateCodexResolvedSlots["spacing"]["density"] {
  if (signals.recipe.effectiveOptions.preset === "compact") {
    return "compact";
  }
  if (signals.recipe.effectiveOptions.preset === "reader") {
    return "spacious";
  }
  return "standard";
}

function typographyScale(
  signals: MdPdfTemplateCodexSignalCollection,
): MarkdownPdfTemplateCodexResolvedSlots["typography"]["scale"] {
  if (signals.recipe.effectiveOptions.preset === "reader") {
    return "reader";
  }
  if (signals.recipe.effectiveOptions.preset === "compact") {
    return "compact";
  }
  return "standard";
}

function bodySize(signals: MdPdfTemplateCodexSignalCollection): string {
  switch (signals.recipe.effectiveOptions.preset) {
    case "compact":
      return "9.5pt";
    case "reader":
      return "12pt";
    case "wide-table":
      return "9.5pt";
    default:
      return "10.5pt";
  }
}

function lineHeight(signals: MdPdfTemplateCodexSignalCollection): string {
  return signals.recipe.effectiveOptions.preset === "reader" ? "1.65" : "1.5";
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
  const hasCover = input.family === "cover-media-layered" && input.signals.coverImage.available;
  const spacing = spacingDensity(input.signals);

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
      density: tableDensity(input.signals),
      repeatHeader: true,
      width: input.signals.recipe.effectiveOptions.preset === "wide-table" ? "full" : "content",
    },
    code: {
      style: "shiki-compatible",
      lineWrap: "wrap",
      preserveSelectors: true,
    },
    spacing: {
      density: spacing,
    },
    typography: {
      scale: typographyScale(input.signals),
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
  return {
    bodyFont: '"Noto Serif", "Georgia", serif',
    headingFont: '"Noto Sans", "Arial", sans-serif',
    monospaceFont: '"Noto Sans Mono", "SFMono-Regular", "Consolas", monospace',
    bodySize: bodySize(signals),
    lineHeight: lineHeight(signals),
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
