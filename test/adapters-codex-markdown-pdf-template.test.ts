import { describe, expect, test } from "bun:test";

import {
  applyMarkdownPdfTemplateCodexDecision,
  buildMarkdownPdfTemplateCodexPrompt,
  MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA,
  parseMarkdownPdfTemplateCodexDecision,
  suggestMarkdownPdfTemplateWithCodex,
  type MarkdownPdfTemplateCodexRequest,
} from "../src/adapters/codex/markdown-pdf-template";
import type { MarkdownPdfTemplateCodexDecision } from "../src/cli/markdown-pdf/template-codex";
import {
  createSynthesisOutputPlan,
  createSynthesisSignals,
} from "./cli-actions-md-to-pdf-template-codex/synthesis-fixtures";

function requestBase(input: { coverImage?: boolean } = {}): MarkdownPdfTemplateCodexRequest {
  return {
    intent: "adapt this report with a local cover image",
    outputPlan: createSynthesisOutputPlan({ includeCoverAsset: input.coverImage }),
    signals: createSynthesisSignals(
      input.coverImage
        ? {
            coverImage: {
              fitPressure: "normal",
              height: 800,
              orientationBucket: "landscape",
              width: 1200,
            },
            signalMode: "codex-assisted",
          }
        : { signalMode: "codex-assisted" },
    ),
    workingDirectory: "/repo",
  };
}

function promptFacts(prompt: string): Record<string, unknown> {
  const marker = "Deterministic facts:\n";
  const index = prompt.indexOf(marker);
  if (index < 0) {
    throw new Error("prompt did not include deterministic facts");
  }
  return JSON.parse(prompt.slice(index + marker.length)) as Record<string, unknown>;
}

function responseFromDecision(input: {
  cssBlocks?: Array<{ css: string; slot: string }>;
  decisionMode?: string;
  managedAssets?: Array<{ bundle_path: string; source_label: string }>;
  recipePreset?: string;
  templateFamily?: string;
}): string {
  return JSON.stringify({
    decision_mode: input.decisionMode ?? "adapted",
    template_family: input.templateFamily ?? "cover-media-layered",
    recipe_preset: input.recipePreset ?? "article",
    slots: {
      recipe_preset: { preset: "article", source: "renderer-default" },
      cover: {
        enabled: true,
        image_fit: "cover",
        layout: "contained-media",
        title_placement: "below-media",
        style: "media",
        orientation_bucket: "landscape",
        fit_pressure: "normal",
      },
      tables: { density: "standard", repeat_header: true, width: "content" },
      code: { style: "shiki-compatible", line_wrap: "wrap", preserve_selectors: true },
      spacing: { density: "standard" },
      typography: { scale: "standard" },
      colors: { palette: "neutral" },
    },
    css_blocks: input.cssBlocks ?? [],
    managed_assets: input.managedAssets ?? [
      { bundle_path: "assets/cover.png", source_label: "cover.png" },
    ],
    warnings: [],
    unsupported_directions: [],
    fallback_reason: "",
  });
}

function assertStrictSchemaObjects(value: unknown, context = "schema"): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return;
  }
  const record = value as Record<string, unknown>;
  if (record.type === "object") {
    expect(record.additionalProperties, context).toBe(false);
    expect(record.required, context).toEqual(
      Object.keys(record.properties as Record<string, unknown>),
    );
  }
  const properties = record.properties as Record<string, unknown> | undefined;
  if (properties) {
    for (const [key, property] of Object.entries(properties)) {
      assertStrictSchemaObjects(property, `${context}.${key}`);
    }
  }
  const items = record.items;
  if (items) {
    assertStrictSchemaObjects(items, `${context}[]`);
  }
}

describe("Markdown PDF template Codex adapter", () => {
  test("builds bounded prompt facts with families, slots, hooks, and asset sizing signals", () => {
    const prompt = buildMarkdownPdfTemplateCodexPrompt(requestBase({ coverImage: true }));
    const facts = promptFacts(prompt);

    expect(prompt).toContain("Return JSON only");
    expect(prompt).toContain("Use cover.image_fit contain or cover");
    expect(prompt).toContain("Always include fallback_reason");
    expect(prompt).not.toContain("source-cover.png");
    expect(facts).toMatchObject({
      assetSizingPolicy: {
        rule: "Use bounded cover.image_fit values, not raw pixel width or height directives.",
      },
      hookRequirements: {
        css: {
          codeLineSelector: ".cdx-code-line",
          coverMediaSelector: ".pdf-cover-media",
          tocSelector: "#TOC",
        },
      },
      outputPlan: {
        managedAssets: [
          {
            bundlePath: "assets/cover.png",
            role: "cover-image",
            sourceBasename: "cover.png",
          },
        ],
      },
    });
  });

  test("keeps the structured output schema strict for nested objects", () => {
    assertStrictSchemaObjects(MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA);
    expect(MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA.required).toContain("fallback_reason");
    expect(MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA.required).toContain("css_blocks");
  });

  test("parses and applies an adapted decision with managed cover asset references", async () => {
    const request = requestBase({ coverImage: true });
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...request,
      runner: async () => responseFromDecision({}),
    });

    expect(result.decision).toMatchObject({
      decisionMode: "adapted",
      recipePreset: "article",
      templateFamily: "cover-media-layered",
      managedAssets: [{ bundlePath: "assets/cover.png", sourceLabel: "cover.png" }],
      slots: {
        cover: { enabled: true, imageFit: "cover" },
        code: { lineWrap: "wrap", preserveSelectors: true, style: "shiki-compatible" },
      },
    });
  });

  test("accepts conservative fallback decisions with bounded slot-owned CSS", async () => {
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase({ coverImage: true }),
      runner: async () =>
        responseFromDecision({
          cssBlocks: [{ css: ".pdf-cover-caption { color: #555555; }", slot: "cover" }],
          decisionMode: "conservative-fallback",
        }),
    });

    expect(result.decision.decisionMode).toBe("conservative-fallback");
    expect(result.decision.cssBlocks).toEqual([
      { css: ".pdf-cover-caption { color: #555555; }", slot: "cover" },
    ]);
  });

  test("turns invalid structured output into no-usable-template", async () => {
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase({ coverImage: true }),
      runner: async () => "{not json",
    });

    expect(result.decision.decisionMode).toBe("no-usable-template");
    expect(result.decision.fallbackReason).toContain("JSON");
    expect(result.decision.cssBlocks).toEqual([]);
    expect(result.decision.managedAssets).toEqual([]);
  });

  test("turns unavailable Codex into no-usable-template", async () => {
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase({ coverImage: true }),
      runner: async () => {
        throw new Error("Codex unavailable");
      },
    });

    expect(result.decision).toMatchObject({
      decisionMode: "no-usable-template",
      fallbackReason: "Codex unavailable",
      managedAssets: [],
    });
  });

  test("rejects managed assets outside the planned bundle and falls back", async () => {
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase({ coverImage: true }),
      runner: async () =>
        responseFromDecision({
          managedAssets: [{ bundle_path: "assets/other.png", source_label: "other.png" }],
        }),
    });

    expect(result.decision.decisionMode).toBe("no-usable-template");
    expect(result.decision.fallbackReason).toContain("not in the output plan");
  });

  test("rejects unsafe CSS blocks and falls back", async () => {
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase({ coverImage: true }),
      runner: async () =>
        responseFromDecision({
          cssBlocks: [{ css: ".pdf-cover-media { width: 2400px; }", slot: "cover" }],
        }),
    });

    expect(result.decision.decisionMode).toBe("no-usable-template");
    expect(result.decision.fallbackReason).toContain("raw pixel sizing");
  });

  test("direct application validates enum domains before synthesis", () => {
    const request = requestBase({ coverImage: true });
    const decision = parseMarkdownPdfTemplateCodexDecision(
      responseFromDecision({ templateFamily: "cover-media-layered" }),
    );
    const invalidDecision: MarkdownPdfTemplateCodexDecision = {
      ...decision,
      slots: {
        ...decision.slots,
        cover: {
          ...decision.slots.cover,
          imageFit: "fill" as MarkdownPdfTemplateCodexDecision["slots"]["cover"]["imageFit"],
        },
      },
    };

    expect(() =>
      applyMarkdownPdfTemplateCodexDecision({
        decision: invalidDecision,
        request,
      }),
    ).toThrow("slots.cover.image_fit");
  });
});
