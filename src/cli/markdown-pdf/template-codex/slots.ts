import type {
  MarkdownPdfTemplateCodexImageFit,
  MarkdownPdfTemplateCodexMaterializedFontDecision,
  MarkdownPdfTemplateCodexRecipePresetSource,
  MarkdownPdfTemplateCodexResolvedSlots,
  MarkdownPdfTemplateCodexTemplateFontDecision,
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
  if (signals.recipe.layoutPolicy.recipePreset.status === "applied") {
    return "document-signal";
  }
  if (signals.baseProfile.available && signals.baseProfile.summary?.preset) {
    return "base-profile";
  }
  return "renderer-default";
}

function presetDefaults(signals: MdPdfTemplateCodexSignalCollection): TemplateCodexPresetDefaults {
  return PRESET_DEFAULTS[signals.recipe.effectiveOptions.preset];
}

function profileOwnsTemplateFontRole(
  signals: MdPdfTemplateCodexSignalCollection,
  decision: MarkdownPdfTemplateCodexTemplateFontDecision,
): boolean {
  if (!signals.baseProfile.available) {
    return false;
  }
  return signals.fonts.profileFonts.families.some(
    (family) => family.role === decision.role && family.key === decision.key,
  );
}

const GENERIC_FONT_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
]);

function cssFontFamilyName(family: string): string {
  const trimmed = family.trim();
  if (GENERIC_FONT_FAMILIES.has(trimmed.toLowerCase())) {
    return trimmed;
  }
  return JSON.stringify(trimmed);
}

function uniqueFontFamilies(fonts: readonly string[]): string[] {
  const seen = new Set<string>();
  return fonts.filter((font) => {
    const key = font.trim().toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function cssFontStack(fonts: readonly string[], generic: "monospace" | "sans-serif" | "serif") {
  const values = uniqueFontFamilies(fonts);
  if (!values.some((font) => font.toLowerCase() === generic)) {
    values.push(generic);
  }
  return values.map(cssFontFamilyName).join(", ");
}

function bodyLanguageDecisions(input: {
  contentLangs: readonly string[];
  decisions: readonly MarkdownPdfTemplateCodexMaterializedFontDecision[];
}): MarkdownPdfTemplateCodexMaterializedFontDecision[] {
  const bodyLanguageDecisionsByLang = new Map(
    input.decisions
      .filter((decision) => decision.role === "body" && decision.key !== "default")
      .map((decision) => [decision.key, decision]),
  );
  const ordered = input.contentLangs
    .map((lang) => bodyLanguageDecisionsByLang.get(lang))
    .filter((decision): decision is MarkdownPdfTemplateCodexMaterializedFontDecision =>
      Boolean(decision),
    );
  const orderedLangs = new Set(ordered.map((decision) => decision.key));
  return [
    ...ordered,
    ...input.decisions.filter(
      (decision) =>
        decision.role === "body" && decision.key !== "default" && !orderedLangs.has(decision.key),
    ),
  ];
}

function applyFontDecisionsToTokens(input: {
  fontDecisions: readonly MarkdownPdfTemplateCodexMaterializedFontDecision[];
  signals: MdPdfTemplateCodexSignalCollection;
  tokens: MarkdownPdfTemplateCodexThemeTokens;
}): MarkdownPdfTemplateCodexThemeTokens {
  const applied = input.fontDecisions.filter((decision) => decision.status === "applied");
  const bodyDefault = applied.find(
    (decision) => decision.role === "body" && decision.key === "default",
  );
  const bodyLanguages = bodyLanguageDecisions({
    contentLangs: input.signals.documentSignals.frontmatter.pdfContentLangs,
    decisions: applied,
  });
  const headingDefault = applied.find(
    (decision) => decision.role === "heading" && decision.key === "default",
  );
  const codeDefault = applied.find(
    (decision) => decision.role === "code" && decision.key === "default",
  );
  const codeSymbols = applied.find(
    (decision) => decision.role === "code" && decision.key === "symbols",
  );

  return {
    ...input.tokens,
    bodyFont:
      bodyDefault || bodyLanguages.length > 0
        ? cssFontStack(
            [
              bodyDefault?.family ?? "Noto Serif",
              ...(bodyDefault ? [] : ["Georgia"]),
              ...bodyLanguages.map((decision) => decision.family),
            ],
            "serif",
          )
        : input.tokens.bodyFont,
    bodyLanguageFonts: bodyLanguages.map((decision) => ({
      lang: decision.key,
      font: cssFontStack(
        [decision.family, bodyDefault?.family ?? "Noto Serif", ...(bodyDefault ? [] : ["Georgia"])],
        "serif",
      ),
    })),
    headingFont: headingDefault
      ? cssFontStack([headingDefault.family], "sans-serif")
      : input.tokens.headingFont,
    monospaceFont:
      codeDefault || codeSymbols
        ? cssFontStack(
            [
              codeDefault?.family ?? "Noto Sans Mono",
              ...(codeDefault ? [] : ["SFMono-Regular", "Consolas"]),
              ...(codeSymbols ? [codeSymbols.family] : []),
            ],
            "monospace",
          )
        : input.tokens.monospaceFont,
  };
}

export function materializeMdPdfTemplateCodexFontDecisions(input: {
  decisions: readonly MarkdownPdfTemplateCodexTemplateFontDecision[];
  signals: MdPdfTemplateCodexSignalCollection;
}): MarkdownPdfTemplateCodexMaterializedFontDecision[] {
  return input.decisions.map((decision) => {
    const profileOwned = profileOwnsTemplateFontRole(input.signals, decision);
    const overridesProfileFont = profileOwned && decision.templateLevel;
    const applied = !profileOwned || decision.templateLevel;
    return {
      ...decision,
      status: applied ? "applied" : "blocked",
      profileOwned,
      overridesProfileFont,
      reason: applied
        ? overridesProfileFont
          ? "template-level-override"
          : "applied"
        : "profile-font-owned",
    };
  });
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
  fontDecisions: readonly MarkdownPdfTemplateCodexMaterializedFontDecision[] = [],
): MarkdownPdfTemplateCodexThemeTokens {
  const defaults = presetDefaults(signals);
  const tokens = {
    bodyFont: '"Noto Serif", "Georgia", serif',
    bodyLanguageFonts: [],
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
  return applyFontDecisionsToTokens({ fontDecisions, signals, tokens });
}
