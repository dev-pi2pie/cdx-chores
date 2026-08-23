import { describe, expect, test } from "bun:test";

import {
  MARKDOWN_PDF_CODE_CLASSES,
  MARKDOWN_PDF_CODE_FONT_SELECTORS,
} from "../../../src/cli/markdown-pdf/code-style";
import {
  createMarkdownPdfFontCss,
  normalizeMarkdownPdfProfile,
} from "../../../src/cli/markdown-pdf/profile";
import type { MarkdownPdfTemplateCodexDecision } from "../../../src/cli/markdown-pdf/template-codex/codex-decision";
import { deriveMdPdfTemplateCodexFontOwnership } from "../../../src/cli/markdown-pdf/template-codex/font-ownership";
import {
  synthesizeMdPdfTemplateCodex,
  synthesizeMdPdfTemplateCodexFromDecision,
} from "../../../src/cli/markdown-pdf/template-codex/synthesize";
import type { MdPdfTemplateCodexSignalCollection } from "../../../src/cli/markdown-pdf/template-codex/types";
import { createSynthesisOutputPlan, createSynthesisSignals } from "../synthesis-fixtures";
import { cssDeclarationsForSelector } from "./css-assertions";

function bodyLanguageSelector(lang: string): string {
  return `:where(p, li, td, th, blockquote, figcaption, dd, dt):lang(${lang}),
:where(p, li, td, th, blockquote, figcaption, dd, dt) > :where(span):lang(${lang})`;
}

function explicitCodeFontSelector(): string {
  return `${MARKDOWN_PDF_CODE_FONT_SELECTORS},
pre.${MARKDOWN_PDF_CODE_CLASSES.plainBlock} code,
pre.${MARKDOWN_PDF_CODE_CLASSES.highlightedBlock} code`;
}

function createTemplateDecision(input: {
  cssBlocks?: MarkdownPdfTemplateCodexDecision["cssBlocks"];
  fontDecisions?: MarkdownPdfTemplateCodexDecision["fontDecisions"];
  signals: MdPdfTemplateCodexSignalCollection;
}): MarkdownPdfTemplateCodexDecision {
  const outputPlan = createSynthesisOutputPlan();
  const deterministic = synthesizeMdPdfTemplateCodex({
    outputPlan,
    signals: input.signals,
  });
  return {
    decisionMode: "adapted",
    templateFamily: "document-layered",
    recipePreset: "article",
    slots: deterministic.slots,
    cssBlocks: input.cssBlocks ?? [],
    fontDecisions: input.fontDecisions ?? [],
    managedAssets: [],
    warnings: [],
    unsupportedDirections: [],
  };
}

describe("cli action modules: md pdf-template codex template synthesis", () => {
  test("omits competing document families for Profile-owned CSS slots", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        pdf: { "content-langs": ["ja"] },
        fonts: {
          body: {
            default: "Profile Body",
            ja: "Profile Japanese",
          },
          heading: { default: "Profile Heading" },
          code: {
            default: "Profile Code",
            symbols: "Profile Symbols",
          },
          pageChrome: { default: "Profile Chrome" },
        },
      },
    }).profile;
    const profileCss = createMarkdownPdfFontCss(normalizedProfile);
    const profileFonts: MdPdfTemplateCodexSignalCollection["fonts"]["profileFonts"] = {
      families: [
        { family: "Profile Body", key: "default", role: "body" },
        { family: "Profile Japanese", key: "ja", role: "body" },
        { family: "Profile Heading", key: "default", role: "heading" },
        { family: "Profile Code", key: "default", role: "code" },
        { family: "Profile Symbols", key: "symbols", role: "code" },
        { family: "Profile Chrome", key: "default", role: "pageChrome" },
      ],
      overflowFamilyCount: 0,
    };
    const withProfile = synthesizeMdPdfTemplateCodex({
      fontOwnership: deriveMdPdfTemplateCodexFontOwnership(normalizedProfile),
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        baseProfilePreset: "article",
        pdfContentLangs: ["ja"],
        profileFonts,
      }),
    });
    const withoutProfile = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({ preset: "article" }),
    });

    expect(profileCss).toContain(
      'body {\n  font-family: "Profile Body", "Profile Japanese", serif;',
    );
    expect(profileCss).toContain(":lang(ja)");
    expect(profileCss).toContain('font-family: "Profile Heading", sans-serif;');
    expect(profileCss).toContain('font-family: "Profile Code", "Profile Symbols", monospace;');
    expect(profileCss).toContain('@page {\n  font-family: "Profile Chrome", sans-serif;');

    expect(cssDeclarationsForSelector(withProfile.styleCss, ":root")).toMatchObject({
      "--template-body-font": '"Noto Serif", "Georgia", serif',
      "--template-heading-font": '"Noto Sans", "Arial", sans-serif',
      "--template-monospace-font": '"Noto Sans Mono", "SFMono-Regular", "Consolas", monospace',
    });
    expect(cssDeclarationsForSelector(withProfile.styleCss, "body")).toMatchObject({
      "font-size": "10.5pt",
      "line-height": "1.5",
    });
    expect(cssDeclarationsForSelector(withProfile.styleCss, "body")).not.toHaveProperty(
      "font-family",
    );
    expect(
      cssDeclarationsForSelector(withProfile.styleCss, "h1, h2, h3, h4, h5, h6"),
    ).not.toHaveProperty("font-family");
    expect(withProfile.styleCss).not.toContain("font-family: var(--template-monospace-font);");
    expect(withProfile.styleCss).not.toContain("Profile Chrome");
    expect(withProfile.styleCss).toContain("@page {\n  size:");

    expect(cssDeclarationsForSelector(withoutProfile.styleCss, ":root")).toMatchObject(
      cssDeclarationsForSelector(withProfile.styleCss, ":root"),
    );
    expect(cssDeclarationsForSelector(withoutProfile.styleCss, "body")).toMatchObject({
      "font-family": "var(--template-body-font)",
      "font-size": "10.5pt",
      "line-height": "1.5",
    });
    expect(
      cssDeclarationsForSelector(withoutProfile.styleCss, "h1, h2, h3, h4, h5, h6"),
    ).toMatchObject({
      "font-family": "var(--template-heading-font)",
    });
    expect(cssDeclarationsForSelector(withoutProfile.styleCss, "code")).toMatchObject({
      "font-family": "var(--template-monospace-font)",
    });
    expect(withoutProfile.styleCss).not.toContain("Profile Chrome");
  });

  test("materializes bounded font hint decisions into template CSS variables", () => {
    const signals = createSynthesisSignals({ fontHints: ["Inter"] });
    const outputPlan = createSynthesisOutputPlan();
    const result = synthesizeMdPdfTemplateCodexFromDecision({
      decision: createTemplateDecision({
        signals,
        fontDecisions: [
          {
            family: "Inter",
            key: "default",
            role: "heading",
            source: "font-hint",
            templateLevel: false,
          },
        ],
      }),
      outputPlan,
      signals,
    });

    expect(cssDeclarationsForSelector(result.styleCss, ":root")).toMatchObject({
      "--template-heading-font": '"Inter", sans-serif',
    });
    expect(result.fontDecisions).toEqual([
      {
        family: "Inter",
        key: "default",
        role: "heading",
        source: "font-hint",
        templateLevel: false,
        status: "applied",
        profileOwned: false,
        overridesProfileFont: false,
        reason: "applied",
      },
    ]);
  });

  test("materializes language and symbol font decisions into bounded CSS", () => {
    const signals = createSynthesisSignals({
      fontHints: ["mixed CJK body and symbol code fallback"],
      pdfContentLangs: ["ja", "zh-Hant"],
    });
    const result = synthesizeMdPdfTemplateCodexFromDecision({
      decision: createTemplateDecision({
        signals,
        fontDecisions: [
          {
            family: "Source Serif 4",
            key: "default",
            role: "body",
            source: "font-hint",
            templateLevel: false,
          },
          {
            family: "Noto Serif TC",
            key: "zh-Hant",
            role: "body",
            source: "font-hint",
            templateLevel: false,
          },
          {
            family: "Noto Serif JP",
            key: "ja",
            role: "body",
            source: "font-hint",
            templateLevel: false,
          },
          {
            family: "Noto Sans Symbols 2",
            key: "symbols",
            role: "code",
            source: "font-hint",
            templateLevel: false,
          },
          {
            family: "Source Sans 3",
            key: "default",
            role: "heading",
            source: "font-hint",
            templateLevel: false,
          },
        ],
      }),
      outputPlan: createSynthesisOutputPlan(),
      signals,
    });

    expect(cssDeclarationsForSelector(result.styleCss, ":root")).toMatchObject({
      "--template-body-font": '"Source Serif 4", "Noto Serif JP", "Noto Serif TC", serif',
      "--template-heading-font": '"Source Sans 3", sans-serif',
      "--template-monospace-font":
        '"Noto Sans Mono", "SFMono-Regular", "Consolas", "Noto Sans Symbols 2", monospace',
    });
    expect(cssDeclarationsForSelector(result.styleCss, bodyLanguageSelector("ja"))).toMatchObject({
      "font-family": '"Noto Serif JP", "Source Serif 4", serif',
    });
    expect(
      cssDeclarationsForSelector(result.styleCss, bodyLanguageSelector("zh-Hant")),
    ).toMatchObject({
      "font-family": '"Noto Serif TC", "Source Serif 4", serif',
    });
    expect(result.styleCss).not.toContain("\n:lang(ja) {\n");
    expect(result.styleCss).not.toContain(
      ":where(p, li, td, th, blockquote, figcaption, dd, dt) :where(span):lang(ja)",
    );
    expect(result.themeTokens.bodyLanguageFonts).toEqual([
      { lang: "ja", font: '"Noto Serif JP", "Source Serif 4", serif' },
      { lang: "zh-Hant", font: '"Noto Serif TC", "Source Serif 4", serif' },
    ]);
  });

  test("does not let loose font hints override base-profile font ownership", () => {
    const signals = createSynthesisSignals({
      baseProfilePreset: "article",
      fontHints: ["Inter"],
      profileFonts: {
        families: [{ family: "Aptos", key: "default", role: "heading" }],
        overflowFamilyCount: 0,
      },
    });
    const outputPlan = createSynthesisOutputPlan();
    const result = synthesizeMdPdfTemplateCodexFromDecision({
      decision: createTemplateDecision({
        signals,
        fontDecisions: [
          {
            family: "Inter",
            key: "default",
            role: "heading",
            source: "font-hint",
            templateLevel: false,
          },
        ],
      }),
      outputPlan,
      signals,
    });

    expect(cssDeclarationsForSelector(result.styleCss, ":root")).toMatchObject({
      "--template-heading-font": '"Noto Sans", "Arial", sans-serif',
    });
    expect(result.fontDecisions).toEqual([
      expect.objectContaining({
        family: "Inter",
        key: "default",
        profileOwned: true,
        reason: "profile-font-owned",
        role: "heading",
        status: "blocked",
      }),
    ]);
  });

  test("blocks only the exact base-profile font role key", () => {
    const signals = createSynthesisSignals({
      baseProfilePreset: "article",
      fontHints: ["body default and Japanese body"],
      profileFonts: {
        families: [{ family: "Profile Serif JP", key: "ja", role: "body" }],
        overflowFamilyCount: 0,
      },
    });
    const result = synthesizeMdPdfTemplateCodexFromDecision({
      decision: createTemplateDecision({
        signals,
        fontDecisions: [
          {
            family: "Source Serif 4",
            key: "default",
            role: "body",
            source: "font-hint",
            templateLevel: false,
          },
          {
            family: "Noto Serif JP",
            key: "ja",
            role: "body",
            source: "font-hint",
            templateLevel: false,
          },
        ],
      }),
      outputPlan: createSynthesisOutputPlan(),
      signals,
    });

    expect(cssDeclarationsForSelector(result.styleCss, ":root")).toMatchObject({
      "--template-body-font": '"Source Serif 4", serif',
    });
    expect(result.styleCss).not.toContain(":lang(ja)");
    expect(result.fontDecisions).toEqual([
      expect.objectContaining({
        key: "default",
        profileOwned: false,
        role: "body",
        status: "applied",
      }),
      expect.objectContaining({
        key: "ja",
        profileOwned: true,
        reason: "profile-font-owned",
        role: "body",
        status: "blocked",
      }),
    ]);
  });

  test("canonicalizes body language keys for ordering and profile ownership", () => {
    const signals = createSynthesisSignals({
      baseProfilePreset: "article",
      fontHints: ["Traditional Chinese body font"],
      pdfContentLangs: ["zh-hant"],
      profileFonts: {
        families: [{ family: "Profile Serif TC", key: "zh-hant", role: "body" }],
        overflowFamilyCount: 0,
      },
    });
    const result = synthesizeMdPdfTemplateCodexFromDecision({
      decision: createTemplateDecision({
        signals,
        fontDecisions: [
          {
            family: "Noto Serif TC",
            key: "zh-Hant",
            role: "body",
            source: "font-hint",
            templateLevel: false,
          },
        ],
      }),
      outputPlan: createSynthesisOutputPlan(),
      signals,
    });

    expect(result.styleCss).not.toContain(bodyLanguageSelector("zh-Hant"));
    expect(result.fontDecisions).toEqual([
      expect.objectContaining({
        key: "zh-Hant",
        profileOwned: true,
        reason: "profile-font-owned",
        role: "body",
        status: "blocked",
      }),
    ]);
  });

  test("blocks loose font hints when base-profile font signals are truncated", () => {
    const signals = createSynthesisSignals({
      baseProfilePreset: "article",
      fontHints: ["late profile font may own this role key"],
      profileFonts: {
        families: Array.from({ length: 20 }, (_, index) => ({
          family: `Profile Body ${index}`,
          key: `und-x-${index}`,
          role: "body" as const,
        })),
        overflowFamilyCount: 3,
      },
    });
    const result = synthesizeMdPdfTemplateCodexFromDecision({
      decision: createTemplateDecision({
        signals,
        fontDecisions: [
          {
            family: "Noto Serif JP",
            key: "ja",
            role: "body",
            source: "font-hint",
            templateLevel: false,
          },
        ],
      }),
      outputPlan: createSynthesisOutputPlan(),
      signals,
    });

    expect(result.styleCss).not.toContain(bodyLanguageSelector("ja"));
    expect(result.fontDecisions).toEqual([
      expect.objectContaining({
        key: "ja",
        profileOwned: true,
        reason: "profile-font-owned",
        role: "body",
        status: "blocked",
      }),
    ]);
  });

  test("uses the full ownership mask instead of coarse bounded-summary overflow", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        fonts: {
          body: { ja: "Profile Japanese" },
        },
      },
    }).profile;
    const signals = createSynthesisSignals({
      baseProfilePreset: "article",
      fontHints: ["body default"],
      profileFonts: {
        families: [],
        overflowFamilyCount: 3,
      },
    });
    const result = synthesizeMdPdfTemplateCodexFromDecision({
      decision: createTemplateDecision({
        signals,
        fontDecisions: [
          {
            family: "Source Serif 4",
            key: "default",
            role: "body",
            source: "font-hint",
            templateLevel: false,
          },
        ],
      }),
      fontOwnership: deriveMdPdfTemplateCodexFontOwnership(normalizedProfile),
      outputPlan: createSynthesisOutputPlan(),
      signals,
    });

    expect(cssDeclarationsForSelector(result.styleCss, "body")).toMatchObject({
      "font-family": "var(--template-body-font)",
    });
    expect(result.fontDecisions).toEqual([
      expect.objectContaining({
        key: "default",
        profileOwned: false,
        reason: "applied",
        role: "body",
        status: "applied",
      }),
    ]);
  });

  test("blocks exact full-Profile keys omitted from the bounded prompt summary", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        fonts: {
          body: { ja: "Profile Japanese" },
        },
      },
    }).profile;
    const signals = createSynthesisSignals({
      baseProfilePreset: "article",
      fontHints: ["Japanese body"],
      pdfContentLangs: ["ja"],
      profileFonts: {
        families: [],
        overflowFamilyCount: 1,
      },
    });
    const result = synthesizeMdPdfTemplateCodexFromDecision({
      decision: createTemplateDecision({
        signals,
        fontDecisions: [
          {
            family: "Noto Serif JP",
            key: "ja",
            role: "body",
            source: "font-hint",
            templateLevel: false,
          },
        ],
      }),
      fontOwnership: deriveMdPdfTemplateCodexFontOwnership(normalizedProfile),
      outputPlan: createSynthesisOutputPlan(),
      signals,
    });

    expect(result.styleCss).not.toContain(bodyLanguageSelector("ja"));
    expect(result.fontDecisions).toEqual([
      expect.objectContaining({
        key: "ja",
        profileOwned: true,
        reason: "profile-font-owned",
        role: "body",
        status: "blocked",
      }),
    ]);
  });

  test("emits only unowned language families under one exact ownership mask", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        fonts: {
          body: { ja: "Profile Japanese" },
        },
      },
    }).profile;
    const signals = createSynthesisSignals({
      baseProfilePreset: "article",
      fontHints: ["Japanese and Traditional Chinese body"],
      pdfContentLangs: ["ja", "zh-Hant"],
      profileFonts: {
        families: [{ family: "Profile Japanese", key: "ja", role: "body" }],
        overflowFamilyCount: 0,
      },
    });
    const result = synthesizeMdPdfTemplateCodexFromDecision({
      decision: createTemplateDecision({
        signals,
        fontDecisions: [
          {
            family: "Noto Serif JP",
            key: "ja",
            role: "body",
            source: "font-hint",
            templateLevel: false,
          },
          {
            family: "Noto Serif TC",
            key: "zh-Hant",
            role: "body",
            source: "font-hint",
            templateLevel: false,
          },
        ],
      }),
      fontOwnership: deriveMdPdfTemplateCodexFontOwnership(normalizedProfile),
      outputPlan: createSynthesisOutputPlan(),
      signals,
    });

    expect(result.styleCss).not.toContain(bodyLanguageSelector("ja"));
    expect(
      cssDeclarationsForSelector(result.styleCss, bodyLanguageSelector("zh-Hant")),
    ).toMatchObject({
      "font-family": '"Noto Serif TC", "Noto Serif", "Georgia", serif',
    });
    expect(result.fontDecisions).toEqual([
      expect.objectContaining({
        key: "ja",
        profileOwned: true,
        status: "blocked",
      }),
      expect.objectContaining({
        key: "zh-Hant",
        profileOwned: false,
        status: "applied",
      }),
    ]);
  });

  test("allows explicit template-level font decisions to override base-profile fonts", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        fonts: {
          heading: { default: "Aptos" },
        },
      },
    }).profile;
    const signals = createSynthesisSignals({
      baseProfilePreset: "article",
      profileFonts: {
        families: [{ family: "Aptos", key: "default", role: "heading" }],
        overflowFamilyCount: 0,
      },
    });
    const outputPlan = createSynthesisOutputPlan();
    const result = synthesizeMdPdfTemplateCodexFromDecision({
      decision: createTemplateDecision({
        signals,
        fontDecisions: [
          {
            family: "Editorial Sans",
            key: "default",
            role: "heading",
            source: "template-style",
            templateLevel: true,
          },
        ],
      }),
      fontOwnership: deriveMdPdfTemplateCodexFontOwnership(normalizedProfile),
      outputPlan,
      signals,
    });

    expect(cssDeclarationsForSelector(result.styleCss, ":root")).toMatchObject({
      "--template-heading-font": '"Editorial Sans", sans-serif',
    });
    expect(cssDeclarationsForSelector(result.styleCss, "h1, h2, h3, h4, h5, h6")).toMatchObject({
      "font-family": "var(--template-heading-font)",
    });
    expect(result.fontDecisions).toEqual([
      expect.objectContaining({
        overridesProfileFont: true,
        profileOwned: true,
        reason: "template-level-override",
        status: "applied",
      }),
    ]);
  });

  test("restores the body family for an explicit template-level default override", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        fonts: {
          body: { default: "Profile Serif" },
        },
      },
    }).profile;
    const signals = createSynthesisSignals({
      baseProfilePreset: "article",
      profileFonts: {
        families: [{ family: "Profile Serif", key: "default", role: "body" }],
        overflowFamilyCount: 0,
      },
    });
    const result = synthesizeMdPdfTemplateCodexFromDecision({
      decision: createTemplateDecision({
        signals,
        fontDecisions: [
          {
            family: "Editorial Serif",
            key: "default",
            role: "body",
            source: "template-style",
            templateLevel: true,
          },
        ],
      }),
      fontOwnership: deriveMdPdfTemplateCodexFontOwnership(normalizedProfile),
      outputPlan: createSynthesisOutputPlan(),
      signals,
    });

    expect(cssDeclarationsForSelector(result.styleCss, ":root")).toMatchObject({
      "--template-body-font": '"Editorial Serif", serif',
    });
    expect(cssDeclarationsForSelector(result.styleCss, "body")).toMatchObject({
      "font-family": "var(--template-body-font)",
      "font-size": "10.5pt",
      "line-height": "1.5",
    });
    expect(result.fontDecisions).toEqual([
      expect.objectContaining({
        key: "default",
        overridesProfileFont: true,
        profileOwned: true,
        reason: "template-level-override",
        role: "body",
        status: "applied",
      }),
    ]);
  });

  test("canonicalizes explicit language overrides before restoring their selector", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        fonts: {
          body: { "zh-hant": "Profile Serif TC" },
        },
      },
    }).profile;
    const signals = createSynthesisSignals({
      baseProfilePreset: "article",
      fontHints: ["Traditional Chinese body"],
      pdfContentLangs: ["zh-Hant"],
      profileFonts: {
        families: [{ family: "Profile Serif TC", key: "zh-hant", role: "body" }],
        overflowFamilyCount: 0,
      },
    });
    const result = synthesizeMdPdfTemplateCodexFromDecision({
      decision: createTemplateDecision({
        signals,
        fontDecisions: [
          {
            family: "Editorial Serif TC",
            key: "zh-Hant",
            role: "body",
            source: "template-style",
            templateLevel: true,
          },
        ],
      }),
      fontOwnership: deriveMdPdfTemplateCodexFontOwnership(normalizedProfile),
      outputPlan: createSynthesisOutputPlan(),
      signals,
    });

    expect(
      cssDeclarationsForSelector(result.styleCss, bodyLanguageSelector("zh-Hant")),
    ).toMatchObject({
      "font-family": '"Editorial Serif TC", "Noto Serif", "Georgia", serif',
    });
    expect(result.fontDecisions).toEqual([
      expect.objectContaining({
        key: "zh-Hant",
        overridesProfileFont: true,
        profileOwned: true,
        reason: "template-level-override",
        status: "applied",
      }),
    ]);
  });

  test("treats either Profile code key as ownership of the combined code family", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        fonts: {
          code: { symbols: "Profile Symbols" },
        },
      },
    }).profile;
    const signals = createSynthesisSignals({
      baseProfilePreset: "article",
      fontHints: ["code face"],
      profileFonts: {
        families: [{ family: "Profile Symbols", key: "symbols", role: "code" }],
        overflowFamilyCount: 0,
      },
    });
    const decision = createTemplateDecision({
      signals,
      fontDecisions: [
        {
          family: "Source Code Pro",
          key: "default",
          role: "code",
          source: "font-hint",
          templateLevel: false,
        },
      ],
    });
    const ownership = deriveMdPdfTemplateCodexFontOwnership(normalizedProfile);
    const blocked = synthesizeMdPdfTemplateCodexFromDecision({
      decision,
      fontOwnership: ownership,
      outputPlan: createSynthesisOutputPlan(),
      signals,
    });
    const explicit = synthesizeMdPdfTemplateCodexFromDecision({
      decision: {
        ...decision,
        fontDecisions: [
          {
            family: "Editorial Symbols",
            key: "symbols",
            role: "code",
            source: "template-style",
            templateLevel: true,
          },
        ],
      },
      fontOwnership: ownership,
      outputPlan: createSynthesisOutputPlan(),
      signals,
    });

    expect(blocked.styleCss).not.toContain("font-family: var(--template-monospace-font);");
    expect(blocked.fontDecisions).toEqual([
      expect.objectContaining({
        key: "default",
        profileOwned: true,
        reason: "profile-font-owned",
        status: "blocked",
      }),
    ]);
    expect(cssDeclarationsForSelector(explicit.styleCss, explicitCodeFontSelector())).toMatchObject(
      {
        "font-family": "var(--template-monospace-font)",
      },
    );
    expect(explicit.fontDecisions).toEqual([
      expect.objectContaining({
        key: "symbols",
        overridesProfileFont: true,
        profileOwned: true,
        reason: "template-level-override",
        status: "applied",
      }),
    ]);
  });

  test("lets code.default reopen every combined code-family surface", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        fonts: {
          code: { default: "Profile Code" },
        },
      },
    }).profile;
    const signals = createSynthesisSignals({
      baseProfilePreset: "article",
      fontHints: ["explicit code face"],
      profileFonts: {
        families: [{ family: "Profile Code", key: "default", role: "code" }],
        overflowFamilyCount: 0,
      },
    });
    const result = synthesizeMdPdfTemplateCodexFromDecision({
      decision: createTemplateDecision({
        signals,
        fontDecisions: [
          {
            family: "Editorial Code",
            key: "default",
            role: "code",
            source: "template-style",
            templateLevel: true,
          },
        ],
      }),
      fontOwnership: deriveMdPdfTemplateCodexFontOwnership(normalizedProfile),
      outputPlan: createSynthesisOutputPlan(),
      signals,
    });
    const selector = explicitCodeFontSelector();

    expect(cssDeclarationsForSelector(result.styleCss, selector)).toEqual({
      "font-family": "var(--template-monospace-font)",
    });
    for (const codeSelector of ["pre", "code", ".cdx-code-line", ".cdx-code-line-content"]) {
      expect(selector).toContain(codeSelector);
    }
    expect(result.fontDecisions).toEqual([
      expect.objectContaining({
        key: "default",
        overridesProfileFont: true,
        profileOwned: true,
        reason: "template-level-override",
        status: "applied",
      }),
    ]);
  });
});
