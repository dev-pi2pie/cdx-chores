import { describe, expect, test } from "bun:test";

import {
  synthesizeMdPdfTemplateCodex,
  type MarkdownPdfTemplateCodexSynthesisResult,
} from "../../src/cli/markdown-pdf/template-codex";
import { createSynthesisOutputPlan, createSynthesisSignals } from "./synthesis-fixtures";

function synthesize(
  input: {
    includeCoverAsset?: boolean;
    signals?: Parameters<typeof synthesizeMdPdfTemplateCodex>[0]["signals"];
  } = {},
): MarkdownPdfTemplateCodexSynthesisResult {
  return synthesizeMdPdfTemplateCodex({
    outputPlan: createSynthesisOutputPlan({ includeCoverAsset: input.includeCoverAsset }),
    signals: input.signals ?? createSynthesisSignals(),
  });
}

describe("cli action modules: md pdf-template codex slots", () => {
  test("resolves explicit recipe preset provenance", () => {
    const result = synthesize({
      signals: createSynthesisSignals({
        preset: "report",
        explicitFields: ["preset"],
      }),
    });

    expect(result.templateFamily).toBe("document-layered");
    expect(result.slots.recipePreset).toEqual({
      preset: "report",
      source: "explicit-recipe",
    });
  });

  test("resolves base profile preset provenance", () => {
    const result = synthesize({
      signals: createSynthesisSignals({
        baseProfilePreset: "reader",
        signalMode: "base-profile-only",
      }),
    });

    expect(result.templateFamily).toBe("document-layered");
    expect(result.slots.recipePreset).toEqual({
      preset: "reader",
      source: "base-profile",
    });
  });

  test("uses conservative contained cover layout for cover-image-only synthesis", () => {
    const result = synthesize({
      includeCoverAsset: true,
      signals: createSynthesisSignals({
        coverImage: {
          orientationBucket: "landscape",
          fitPressure: "normal",
          width: 2400,
          height: 1600,
        },
        signalMode: "cover-image-only",
      }),
    });

    expect(result.templateFamily).toBe("cover-media-layered");
    expect(result.slots.cover).toMatchObject({
      enabled: true,
      imageFit: "contain",
      layout: "contained-media",
      titlePlacement: "below-media",
      style: "media",
    });
    expect(result.managedAssets).toEqual([
      {
        role: "cover-image",
        bundlePath: "assets/cover.png",
        sourceBasename: "cover.png",
      },
    ]);
  });

  test("uses cover fit for normal deterministic cover media", () => {
    const result = synthesize({
      includeCoverAsset: true,
      signals: createSynthesisSignals({
        coverImage: {
          orientationBucket: "landscape",
          fitPressure: "normal",
        },
        signalMode: "deterministic",
      }),
    });

    expect(result.templateFamily).toBe("cover-media-layered");
    expect(result.decisionMode).toBe("deterministic");
    expect(result.slots.cover.imageFit).toBe("cover");
  });

  test("maps preset-driven slots and theme tokens", () => {
    const compact = synthesize({
      signals: createSynthesisSignals({ preset: "compact", explicitFields: ["preset"] }),
    });
    expect(compact.slots.tables).toMatchObject({
      density: "compact",
      width: "content",
    });
    expect(compact.slots.spacing.density).toBe("compact");
    expect(compact.slots.typography.scale).toBe("compact");
    expect(compact.themeTokens).toMatchObject({
      bodySize: "9.5pt",
      lineHeight: "1.5",
      blockGap: "0.35rem",
    });

    const wideTable = synthesize({
      signals: createSynthesisSignals({ preset: "wide-table", explicitFields: ["preset"] }),
    });
    expect(wideTable.slots.tables).toMatchObject({
      density: "wide",
      width: "full",
    });
    expect(wideTable.themeTokens.bodySize).toBe("9.5pt");
    expect(wideTable.styleCss).toContain("width: 100%;");

    const reader = synthesize({
      signals: createSynthesisSignals({ preset: "reader", explicitFields: ["preset"] }),
    });
    expect(reader.slots.spacing.density).toBe("spacious");
    expect(reader.slots.typography.scale).toBe("reader");
    expect(reader.themeTokens).toMatchObject({
      bodySize: "12pt",
      lineHeight: "1.65",
      blockGap: "0.8rem",
    });
  });

  test("uses contained fit for risky deterministic cover metadata", () => {
    const result = synthesize({
      includeCoverAsset: true,
      signals: createSynthesisSignals({
        coverImage: {
          orientationBucket: "panoramic",
          fitPressure: "letterbox-risk",
          width: 4200,
          height: 1200,
        },
        signalMode: "deterministic",
      }),
    });

    expect(result.slots.cover.imageFit).toBe("contain");
    expect(result.templateHtml).toContain('data-fit-pressure="letterbox-risk"');
    expect(result.styleCss).toContain("object-fit: contain;");
  });
});
