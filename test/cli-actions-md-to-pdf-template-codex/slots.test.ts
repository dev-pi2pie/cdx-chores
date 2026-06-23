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
});
