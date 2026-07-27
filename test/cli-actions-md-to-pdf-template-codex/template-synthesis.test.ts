import { describe, expect, test } from "bun:test";

import {
  MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT,
  synthesizeMdPdfTemplateCodex,
  synthesizeMdPdfTemplateCodexFromDecision,
  type MarkdownPdfTemplateCodexDecision,
  type MdPdfTemplateCodexSignalCollection,
} from "../../src/cli/markdown-pdf/template-codex";
import {
  createMarkdownPdfFontCss,
  normalizeMarkdownPdfProfile,
} from "../../src/cli/markdown-pdf/profile";
import { createSynthesisOutputPlan, createSynthesisSignals } from "./synthesis-fixtures";

function readCssDeclarationBlock(
  styleCss: string,
  selectorIndex: number,
): { declarations: Record<string, string>; endIndex: number } {
  const openBraceIndex = styleCss.indexOf("{", selectorIndex);
  expect(openBraceIndex).toBeGreaterThanOrEqual(0);
  let closeBraceIndex = -1;
  let quote: '"' | "'" | undefined;
  let parenDepth = 0;
  for (let index = openBraceIndex + 1; index < styleCss.length; index += 1) {
    const char = styleCss[index];
    const previous = styleCss[index - 1];
    if (quote) {
      if (char === quote && previous !== "\\") {
        quote = undefined;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(") {
      parenDepth += 1;
      continue;
    }
    if (char === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }
    if (char === "}" && parenDepth === 0) {
      closeBraceIndex = index;
      break;
    }
  }
  expect(closeBraceIndex).toBeGreaterThan(openBraceIndex);
  return {
    declarations: parseCssDeclarations(styleCss.slice(openBraceIndex + 1, closeBraceIndex)),
    endIndex: closeBraceIndex,
  };
}

function parseCssDeclarations(block: string): Record<string, string> {
  const declarations: string[] = [];
  let declarationStart = 0;
  let quote: '"' | "'" | undefined;
  let parenDepth = 0;
  for (let index = 0; index < block.length; index += 1) {
    const char = block[index];
    const previous = block[index - 1];
    if (quote) {
      if (char === quote && previous !== "\\") {
        quote = undefined;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(") {
      parenDepth += 1;
      continue;
    }
    if (char === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }
    if (char === ";" && parenDepth === 0) {
      declarations.push(block.slice(declarationStart, index));
      declarationStart = index + 1;
    }
  }
  declarations.push(block.slice(declarationStart));
  return Object.fromEntries(
    declarations
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separatorIndex = line.indexOf(":");
        return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1).trim()];
      }),
  );
}

function cssDeclarationBlocksForSelector(
  styleCss: string,
  selector: string,
): Record<string, string>[] {
  const blocks: Record<string, string>[] = [];
  let searchIndex = 0;
  while (searchIndex < styleCss.length) {
    const selectorIndex = styleCss.indexOf(selector, searchIndex);
    if (selectorIndex < 0) {
      break;
    }
    const nextNonWhitespace = styleCss.slice(selectorIndex + selector.length).search(/\S/);
    const openBraceOffset = selectorIndex + selector.length + nextNonWhitespace;
    const previousNonWhitespace = styleCss.slice(0, selectorIndex).search(/\S\s*$/);
    const isExactSelector =
      nextNonWhitespace >= 0 &&
      styleCss[openBraceOffset] === "{" &&
      (previousNonWhitespace < 0 || styleCss[previousNonWhitespace] === "}");
    if (!isExactSelector) {
      searchIndex = selectorIndex + selector.length;
      continue;
    }
    const block = readCssDeclarationBlock(styleCss, selectorIndex);
    blocks.push(block.declarations);
    searchIndex = block.endIndex + 1;
  }
  expect(blocks.length).toBeGreaterThan(0);
  return blocks;
}

function cssDeclarationsForSelector(styleCss: string, selector: string): Record<string, string> {
  const [declarations] = cssDeclarationBlocksForSelector(styleCss, selector);
  expect(declarations).toBeDefined();
  return declarations!;
}

function expectTocPageBreakCss(
  styleCss: string,
  expected: { before?: "page"; after?: "page" },
): void {
  const tocBlocks = cssDeclarationBlocksForSelector(
    styleCss,
    MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.css.tocSelector,
  );
  expect(tocBlocks).toEqual(expect.arrayContaining([expect.objectContaining({ page: "toc" })]));
  const pageBreakBlock = tocBlocks.find(
    (block) => "break-before" in block || "break-after" in block,
  );
  if (!expected.before && !expected.after) {
    expect(pageBreakBlock).toBeUndefined();
    return;
  }
  expect(pageBreakBlock).toMatchObject({
    ...(expected.before ? { "break-before": expected.before } : {}),
    ...(expected.after ? { "break-after": expected.after } : {}),
  });
  if (!expected.before) {
    expect(pageBreakBlock).not.toHaveProperty("break-before");
  }
  if (!expected.after) {
    expect(pageBreakBlock).not.toHaveProperty("break-after");
  }
}

function bodyLanguageSelector(lang: string): string {
  return `:where(p, li, td, th, blockquote, figcaption, dd, dt):lang(${lang}),
:where(p, li, td, th, blockquote, figcaption, dd, dt) > :where(span):lang(${lang})`;
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
  test("preserves Pandoc document hooks and Shiki-compatible code selectors", () => {
    const result = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({ preset: "report", toc: true }),
    });

    expect(result.templateHtml).toContain("$body$");
    expect(result.templateHtml).toContain("$if(title)$");
    expect(result.templateHtml).toContain("$if(toc)$");
    expect(result.templateHtml).toContain(
      `<nav id="${MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.html.tocId}" role="doc-toc">`,
    );
    expect(result.templateHtml).toContain("$toc$");
    expect(result.templateHtml).toContain("family=document-layered");
    expect(result.styleCss).toContain("family=document-layered");
    expect(result.styleCss).toContain(MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.css.tocSelector);
    expect(result.styleCss).toContain(MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.css.codeLineSelector);
    expect(result.styleCss).toContain(".cdx-code-line-content");
  });

  test("omits cover media and ToC page-break CSS for plain document synthesis", () => {
    const result = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({ preset: "article" }),
    });

    expect(result.templateFamily).toBe("document-layered");
    expect(result.slots.cover.enabled).toBe(false);
    expect(result.templateHtml).not.toContain("pdf-cover");
    expect(result.styleCss).not.toContain("@page cover");
    expect(result.styleCss).not.toContain(".pdf-cover-media");
    expect(result.styleCss).not.toContain("break-before: page;");
    expect(result.styleCss).not.toContain("break-after: page;");
  });

  test("suppresses duplicate metadata title blocks like profile auto title policy", () => {
    const result = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        titleSignals: {
          frontmatterTitle: { present: true, charCount: 14 },
          firstH1: { present: true, charCount: 14 },
          normalizedTitleMatch: true,
          duplicateVisibleTitleRisk: true,
        },
      }),
    });

    expect(result.titlePolicy).toMatchObject({
      metadataTitle: "suppress-duplicate",
      visibleMetadataTitle: false,
      duplicateVisibleTitleRisk: true,
    });
    expect(result.templateHtml).not.toContain('<header class="document-title">');
    expect(result.templateHtml).toContain(
      "<title>$if(title)$$title$$else$Markdown PDF$endif$</title>",
    );
    expect(result.templateHtml).toContain("$body$");
  });

  test("keeps metadata title blocks when there is no duplicate title risk", () => {
    const result = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals(),
    });

    expect(result.titlePolicy).toMatchObject({
      metadataTitle: "show",
      visibleMetadataTitle: true,
    });
    expect(result.templateHtml).toContain('<header class="document-title">');
    expect(result.templateHtml).toContain('<h1 class="title">$title$</h1>');
  });

  test("lets cover-title placement own the visible title block", () => {
    const result = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan({ includeCoverAsset: true }),
      signals: createSynthesisSignals({
        coverImage: {
          orientationBucket: "landscape",
          fitPressure: "normal",
        },
      }),
    });

    expect(result.titlePolicy).toMatchObject({
      metadataTitle: "suppress-cover-title",
      visibleMetadataTitle: false,
      coverTitleOwnsPlacement: true,
    });
    expect(result.templateHtml).toContain("pdf-cover-media__title");
    expect(result.templateHtml).not.toContain('<header class="document-title">');
  });

  test("preserves base-profile metadata title show ownership", () => {
    const result = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        titleSignals: {
          frontmatterTitle: { present: true, charCount: 14 },
          firstH1: { present: true, charCount: 14 },
          normalizedTitleMatch: true,
          duplicateVisibleTitleRisk: true,
        },
        titlePolicySignals: { baseProfileMetadataTitle: "show" },
      }),
    });

    expect(result.titlePolicy).toMatchObject({
      metadataTitle: "show",
      visibleMetadataTitle: true,
    });
    expect(result.templateHtml).toContain('<header class="document-title">');
  });

  test("preserves base-profile metadata title hide ownership", () => {
    const result = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        titlePolicySignals: { baseProfileMetadataTitle: "hide" },
      }),
    });

    expect(result.titlePolicy).toMatchObject({
      metadataTitle: "hide",
      visibleMetadataTitle: false,
    });
    expect(result.templateHtml).not.toContain('<header class="document-title">');
  });

  test("lets explicit title intent override default duplicate suppression", () => {
    const keep = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        titleSignals: {
          frontmatterTitle: { present: true, charCount: 14 },
          firstH1: { present: true, charCount: 14 },
          normalizedTitleMatch: true,
          duplicateVisibleTitleRisk: true,
        },
        titlePolicySignals: { explicitKeepMetadataTitleIntent: true },
      }),
    });
    const hide = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        titlePolicySignals: { explicitHideMetadataTitleIntent: true },
      }),
    });

    expect(keep.titlePolicy).toMatchObject({
      metadataTitle: "show",
      visibleMetadataTitle: true,
    });
    expect(keep.templateHtml).toContain('<header class="document-title">');
    expect(hide.titlePolicy).toMatchObject({
      metadataTitle: "hide",
      visibleMetadataTitle: false,
    });
    expect(hide.templateHtml).not.toContain('<header class="document-title">');
  });

  test("reproduces preset families competing with a direct compatibility Profile", () => {
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
      font: "10.5pt/1.5 var(--template-body-font)",
    });
    expect(
      cssDeclarationsForSelector(withProfile.styleCss, "h1, h2, h3, h4, h5, h6"),
    ).toMatchObject({
      "font-family": "var(--template-heading-font)",
    });
    expect(cssDeclarationsForSelector(withProfile.styleCss, "code")).toMatchObject({
      "font-family": "var(--template-monospace-font)",
    });
    expect(withProfile.styleCss).not.toContain("Profile Chrome");
    expect(withProfile.styleCss).toContain("@page {\n  size:");

    expect(cssDeclarationsForSelector(withoutProfile.styleCss, ":root")).toMatchObject(
      cssDeclarationsForSelector(withProfile.styleCss, ":root"),
    );
    expect(cssDeclarationsForSelector(withoutProfile.styleCss, "body")).toMatchObject({
      font: "10.5pt/1.5 var(--template-body-font)",
    });
  });

  test("reproduces a bounded CSS block appending a later family override", () => {
    const signals = createSynthesisSignals({
      baseProfilePreset: "article",
      profileFonts: {
        families: [{ family: "Profile Body", key: "default", role: "body" }],
        overflowFamilyCount: 0,
      },
    });
    const result = synthesizeMdPdfTemplateCodexFromDecision({
      decision: createTemplateDecision({
        cssBlocks: [{ css: 'body { font-family: "Late Override"; }', slot: "typography" }],
        signals,
      }),
      outputPlan: createSynthesisOutputPlan(),
      signals,
    });

    const generatedBodyIndex = result.styleCss.indexOf("body {");
    const boundedBlockIndex = result.styleCss.indexOf("/* Codex bounded CSS blocks */");
    const overrideIndex = result.styleCss.indexOf('font-family: "Late Override"');
    expect(generatedBodyIndex).toBeGreaterThanOrEqual(0);
    expect(boundedBlockIndex).toBeGreaterThan(generatedBodyIndex);
    expect(overrideIndex).toBeGreaterThan(boundedBlockIndex);
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

  test("allows explicit template-level font decisions to override base-profile fonts", () => {
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
      outputPlan,
      signals,
    });

    expect(cssDeclarationsForSelector(result.styleCss, ":root")).toMatchObject({
      "--template-heading-font": '"Editorial Sans", sans-serif',
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

  test("maps contained cover media to page-relative CSS without source pixel sizing", () => {
    const result = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan({ includeCoverAsset: true }),
      signals: createSynthesisSignals({
        coverImage: {
          orientationBucket: "panoramic",
          fitPressure: "letterbox-risk",
          width: 4200,
          height: 1200,
        },
        signalMode: "cover-image-only",
      }),
    });

    expect(result.templateHtml).toContain('src="assets/cover.png"');
    expect(result.templateHtml).toContain('data-image-fit="contain"');
    expect(result.templateHtml).toContain('data-cover-composition="media-first-caption"');
    expect(result.templateHtml).toContain('data-cover-byline="none"');
    expect(result.templateHtml).toContain('data-cover-text-align="center"');
    expect(result.templateHtml).toContain('data-media-align="center"');
    expect(result.templateHtml).toContain('data-media-scale="balanced"');
    expect(result.templateHtml).toContain('data-image-anchor="center"');
    expect(result.templateHtml).toContain('data-orientation="panoramic"');
    expect(result.templateHtml).toContain('data-fit-pressure="letterbox-risk"');
    expect(result.styleCss).toContain("object-fit: contain;");
    expect(result.styleCss).toContain("@page cover");
    expect(result.templateHtml).toContain(
      '<img class="pdf-cover-media__image" src="assets/cover.png" alt="Cover image">',
    );
    expect(result.templateHtml).not.toContain("$title$ cover image");
    expect(cssDeclarationsForSelector(result.styleCss, ".pdf-cover")).toMatchObject({
      "break-after": "page",
      "min-height": "297mm",
      page: "cover",
    });
    expect(result.styleCss).not.toMatch(/\b\d+(?:\.\d+)?vh\b/);
    expect(
      cssDeclarationsForSelector(
        result.styleCss,
        MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.css.coverMediaSelector,
      ),
    ).toMatchObject({
      display: "flex",
      "min-height": "297mm",
      padding: "18mm",
    });
    expect(cssDeclarationsForSelector(result.styleCss, ".pdf-cover-media__image")).toEqual({
      "align-self": "center",
      display: "block",
      height: "201.96mm",
      "max-height": "201.96mm",
      "max-width": "88%",
      "object-fit": "contain",
      "object-position": "center",
      width: "100%",
    });
    expect(cssDeclarationsForSelector(result.styleCss, ".pdf-cover-media__caption")).toMatchObject({
      display: "flex",
      gap: "2mm",
      "margin-top": "8mm",
      "text-align": "center",
    });
    expect(result.styleCss).not.toContain("inset:");
    expect(
      cssDeclarationsForSelector(
        result.styleCss,
        '.pdf-cover[data-cover-composition="media-background-overlay"] .pdf-cover-media__caption',
      ),
    ).toMatchObject({
      bottom: "18mm",
      left: "18mm",
      right: "18mm",
      top: "18mm",
    });
    expect(result.styleCss).not.toMatch(
      /\b(?:width|height|max-height|max-width)\s*:\s*(?:4200|1200)(?:\b|[a-z%])/i,
    );
  });

  test("synthesizes title-image-subtitle cover composition with bounded alignment slots", () => {
    const outputPlan = createSynthesisOutputPlan({ includeCoverAsset: true });
    const signals = createSynthesisSignals({
      coverImage: {
        orientationBucket: "portrait",
        fitPressure: "crop-risk",
        width: 1200,
        height: 1800,
      },
      signalMode: "codex-assisted",
    });
    const base = synthesizeMdPdfTemplateCodex({ outputPlan, signals });
    const result = synthesizeMdPdfTemplateCodexFromDecision({
      outputPlan,
      signals,
      decision: {
        decisionMode: "adapted",
        templateFamily: "cover-media-layered",
        recipePreset: "article",
        slots: {
          ...base.slots,
          cover: {
            ...base.slots.cover,
            byline: "author-date",
            composition: "title-media-subtitle",
            imageAnchor: "bottom",
            imageFit: "contain",
            mediaAlign: "end",
            mediaScale: "compact",
            textAlign: "right",
          },
        },
        cssBlocks: [],
        fontDecisions: [],
        managedAssets: [{ bundlePath: "assets/cover.png", sourceLabel: "cover.png" }],
        warnings: [],
        unsupportedDirections: [],
      },
    });

    const titleIndex = result.templateHtml.indexOf("pdf-cover-media__caption--title");
    const imageIndex = result.templateHtml.indexOf('<img class="pdf-cover-media__image"');
    const subtitleIndex = result.templateHtml.indexOf("pdf-cover-media__caption--subtitle");
    const subtitleTextIndex = result.templateHtml.indexOf(
      '<span class="pdf-cover-media__subtitle">$subtitle$</span>',
    );
    const bylineIndex = result.templateHtml.indexOf("pdf-cover-media__byline");
    expect(titleIndex).toBeGreaterThanOrEqual(0);
    expect(imageIndex).toBeGreaterThan(titleIndex);
    expect(subtitleIndex).toBeGreaterThan(imageIndex);
    expect(bylineIndex).toBeGreaterThan(subtitleTextIndex);
    expect(result.templateHtml).toContain(
      '<div class="pdf-cover-media__caption pdf-cover-media__caption--title">',
    );
    expect(result.templateHtml).toContain(
      '<div class="pdf-cover-media__caption pdf-cover-media__caption--subtitle">',
    );
    expect(result.templateHtml).not.toContain("<figcaption");
    expect(result.templateHtml).toContain('data-cover-composition="title-media-subtitle"');
    expect(result.templateHtml).toContain('data-cover-byline="author-date"');
    expect(result.templateHtml).toContain('data-cover-text-align="right"');
    expect(result.templateHtml).toContain(
      '<span class="pdf-cover-media__byline">$for(author)$$author$$sep$, $endfor$</span>',
    );
    expect(result.templateHtml).toContain('<span class="pdf-cover-media__byline">$date$</span>');
    expect(result.templateHtml).toContain('data-media-align="end"');
    expect(result.templateHtml).toContain('data-media-scale="compact"');
    expect(result.templateHtml).toContain('data-image-anchor="bottom"');
    expect(cssDeclarationsForSelector(result.styleCss, ".pdf-cover-media__caption")).toMatchObject({
      "text-align": "right",
    });
    expect(cssDeclarationsForSelector(result.styleCss, ".pdf-cover-media__image")).toMatchObject({
      "align-self": "flex-end",
      height: "154.44mm",
      "max-height": "154.44mm",
      "max-width": "72%",
      "object-position": "center bottom",
    });
    expect(cssDeclarationsForSelector(result.styleCss, ".pdf-cover-media__title")).toMatchObject({
      font: "700 22pt/1.15 var(--template-heading-font)",
    });
    expect(cssDeclarationsForSelector(result.styleCss, ".pdf-cover-media__subtitle")).toMatchObject(
      {
        font: "12pt/1.35 var(--template-body-font)",
      },
    );
    expect(cssDeclarationsForSelector(result.styleCss, ".pdf-cover-media__byline")).toMatchObject({
      font: "10.5pt/1.35 var(--template-body-font)",
      display: "block",
      "margin-top": "2mm",
    });
  });

  test("maps cover media sizing to landscape inch page dimensions", () => {
    const result = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan({ includeCoverAsset: true }),
      signals: createSynthesisSignals({
        pageSize: "Letter",
        orientation: "landscape",
        coverImage: {
          orientationBucket: "panoramic",
          fitPressure: "letterbox-risk",
          width: 4200,
          height: 1200,
        },
        signalMode: "cover-image-only",
      }),
    });

    expect(cssDeclarationsForSelector(result.styleCss, ".pdf-cover")).toMatchObject({
      "min-height": "8.5in",
      page: "cover",
    });
    expect(
      cssDeclarationsForSelector(
        result.styleCss,
        MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.css.coverMediaSelector,
      ),
    ).toMatchObject({
      "min-height": "8.5in",
    });
    expect(cssDeclarationsForSelector(result.styleCss, ".pdf-cover-media__image")).toMatchObject({
      height: "5.78in",
      "max-height": "5.78in",
    });
    expect(result.styleCss).not.toMatch(/\b\d+(?:\.\d+)?vh\b/);
  });

  test("rejects cover-media synthesis when no cover asset is bound", () => {
    expect(() =>
      synthesizeMdPdfTemplateCodex({
        outputPlan: createSynthesisOutputPlan(),
        signals: createSynthesisSignals({
          coverImage: {
            orientationBucket: "landscape",
            fitPressure: "normal",
            width: 1800,
            height: 1200,
          },
          signalMode: "deterministic",
        }),
      }),
    ).toThrow(/template:cover-media-class/);
  });

  test("maps cover-fit cover media to page-relative CSS without source pixel sizing", () => {
    const result = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan({ includeCoverAsset: true }),
      signals: createSynthesisSignals({
        coverImage: {
          orientationBucket: "landscape",
          fitPressure: "normal",
          width: 1800,
          height: 1200,
        },
        signalMode: "deterministic",
      }),
    });

    expect(result.templateHtml).toContain('data-image-fit="cover"');
    expect(result.styleCss).toContain("object-fit: cover;");
    expect(cssDeclarationsForSelector(result.styleCss, ".pdf-cover-media__image")).toEqual({
      "align-self": "center",
      display: "block",
      height: "225.72mm",
      "max-height": "225.72mm",
      "max-width": "100%",
      "object-fit": "cover",
      "object-position": "center",
      width: "100%",
    });
    expect(result.styleCss).not.toMatch(/\b\d+(?:\.\d+)?vh\b/);
    expect(result.styleCss).not.toMatch(
      /\b(?:width|height|max-height|max-width)\s*:\s*(?:1800|1200)(?:\b|[a-z%])/i,
    );
  });

  test("maps unknown cover metadata to safe contained cover media", () => {
    const result = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan({ includeCoverAsset: true }),
      signals: createSynthesisSignals({
        coverImage: {
          orientationBucket: "unknown",
          fitPressure: "unknown",
        },
        signalMode: "cover-image-only",
      }),
    });

    expect(result.slots.cover).toMatchObject({
      enabled: true,
      composition: "media-first-caption",
      imageFit: "contain",
      layout: "contained-media",
      mediaScale: "balanced",
      orientationBucket: "unknown",
      fitPressure: "unknown",
    });
    expect(result.templateHtml).toContain('data-orientation="unknown"');
    expect(result.templateHtml).toContain('data-fit-pressure="unknown"');
    expect(cssDeclarationsForSelector(result.styleCss, ".pdf-cover-media__image")).toMatchObject({
      height: "201.96mm",
      "max-height": "201.96mm",
      "object-fit": "contain",
    });
    expect(result.styleCss).not.toMatch(/\b\d+(?:\.\d+)?vh\b/);
  });

  test("maps ToC page-break options into CSS branches", () => {
    const reportAuto = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({ preset: "report", toc: true }),
    });
    expectTocPageBreakCss(reportAuto.styleCss, { after: "page" });

    const articleAuto = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({ preset: "article", toc: true }),
    });
    expectTocPageBreakCss(articleAuto.styleCss, {});

    const explicitBefore = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        preset: "article",
        toc: true,
        tocPageBreak: "before",
      }),
    });
    expectTocPageBreakCss(explicitBefore.styleCss, { before: "page" });

    const explicitAfter = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        preset: "article",
        toc: true,
        tocPageBreak: "after",
      }),
    });
    expectTocPageBreakCss(explicitAfter.styleCss, { after: "page" });

    const explicitBoth = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        preset: "article",
        toc: true,
        tocPageBreak: "both",
      }),
    });
    expectTocPageBreakCss(explicitBoth.styleCss, { before: "page", after: "page" });

    const explicitNone = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        preset: "article",
        toc: true,
        tocPageBreak: "none",
      }),
    });
    expectTocPageBreakCss(explicitNone.styleCss, {});

    const tocDisabledAfter = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        preset: "article",
        toc: false,
        tocPageBreak: "after",
      }),
    });
    expectTocPageBreakCss(tocDisabledAfter.styleCss, {});
  });
});
