import { describe, expect, test } from "bun:test";

import { normalizeMarkdownPdfProfile } from "../../../src/cli/markdown-pdf/profile";
import { MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT } from "../../../src/cli/markdown-pdf/template-codex/families";
import { deriveMdPdfTemplateCodexFontOwnership } from "../../../src/cli/markdown-pdf/template-codex/font-ownership";
import {
  synthesizeMdPdfTemplateCodex,
  synthesizeMdPdfTemplateCodexFromDecision,
} from "../../../src/cli/markdown-pdf/template-codex/synthesize";
import {
  createSynthesisOutputPlan,
  createSynthesisSignals,
} from "../../markdown-pdf/actions/template-synthesis-fixtures";
import { cssDeclarationsForSelector } from "./css-assertions";

describe("cli action modules: md pdf-template codex template synthesis", () => {
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
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        fonts: {
          body: { default: "Profile Body" },
          heading: { default: "Profile Heading" },
        },
      },
    }).profile;
    const fontOwnership = deriveMdPdfTemplateCodexFontOwnership(normalizedProfile);
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
    const base = synthesizeMdPdfTemplateCodex({ fontOwnership, outputPlan, signals });
    const result = synthesizeMdPdfTemplateCodexFromDecision({
      fontOwnership,
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
    expect(cssDeclarationsForSelector(result.styleCss, "body")).not.toHaveProperty("font-family");
    expect(
      cssDeclarationsForSelector(result.styleCss, "h1, h2, h3, h4, h5, h6"),
    ).not.toHaveProperty("font-family");
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
});
