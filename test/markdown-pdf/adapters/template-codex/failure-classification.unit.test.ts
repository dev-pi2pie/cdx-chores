import { describe, expect, test } from "bun:test";

import {
  applyMarkdownPdfTemplateCodexDecision,
  parseMarkdownPdfTemplateCodexDecision,
  suggestMarkdownPdfTemplateWithCodex,
} from "../../../../src/adapters/codex/markdown-pdf-template";

import { type MarkdownPdfTemplateCodexDecision } from "../../../../src/cli/markdown-pdf/template-codex";

import { requestBase, responseFromDecision, noUsableResponse } from "../template-codex-fixtures";

describe("Markdown PDF template Codex adapter: failure classification", () => {
  test("turns invalid structured output into no-usable-template", async () => {
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase({ coverImage: true }),
      runner: async () => "{not json",
    });

    expect(result.decision.decisionMode).toBe("no-usable-template");
    expect(result.decision.fallbackReason).toBe(
      "Codex template decision failed: malformed-output.",
    );
    expect(result.decision.cssBlocks).toEqual([]);
    expect(result.decision.managedAssets).toEqual([]);
  });

  test("parses no-usable-template sentinels and enforces empty fallback branches", () => {
    const request = requestBase();
    const decision = parseMarkdownPdfTemplateCodexDecision(noUsableResponse());

    expect(decision).toMatchObject({
      cssBlocks: [],
      decisionMode: "no-usable-template",
      managedAssets: [],
      recipePreset: undefined,
      templateFamily: undefined,
    });
    expect(() =>
      applyMarkdownPdfTemplateCodexDecision({
        decision: parseMarkdownPdfTemplateCodexDecision(
          noUsableResponse({
            cssBlocks: [{ css: "body { color: #222222; }", slot: "colors" }],
          }),
        ),
        request,
      }),
    ).toThrow("css_blocks must be empty");
    expect(() =>
      applyMarkdownPdfTemplateCodexDecision({
        decision: parseMarkdownPdfTemplateCodexDecision(
          noUsableResponse({
            managedAssets: [{ bundle_path: "assets/cover.png", source_label: "cover.png" }],
          }),
        ),
        request,
      }),
    ).toThrow("managed_assets must be empty");
    expect(() =>
      applyMarkdownPdfTemplateCodexDecision({
        decision: parseMarkdownPdfTemplateCodexDecision(
          noUsableResponse({
            coverEnabled: true,
          }),
        ),
        request,
      }),
    ).toThrow("slots.cover.enabled must be false");
    expect(() =>
      applyMarkdownPdfTemplateCodexDecision({
        decision: parseMarkdownPdfTemplateCodexDecision(
          responseFromDecision({
            coverEnabled: false,
            decisionMode: "no-usable-template",
            fontDecisions: [
              {
                family: "Inter",
                key: "default",
                role: "body",
                source: "font-hint",
                template_level: false,
              },
            ],
            recipePreset: "none",
            templateFamily: "none",
          }),
        ),
        request,
      }),
    ).toThrow("font_decisions must be empty");
    expect(() =>
      applyMarkdownPdfTemplateCodexDecision({
        decision: parseMarkdownPdfTemplateCodexDecision(
          responseFromDecision({
            coverEnabled: false,
            decisionMode: "no-usable-template",
            recipePreset: "article",
            templateFamily: "none",
          }),
        ),
        request,
      }),
    ).toThrow("recipe_preset must be none");
    expect(() =>
      applyMarkdownPdfTemplateCodexDecision({
        decision: parseMarkdownPdfTemplateCodexDecision(
          responseFromDecision({
            coverEnabled: false,
            decisionMode: "no-usable-template",
            recipePreset: "none",
            templateFamily: "document-layered",
          }),
        ),
        request,
      }),
    ).toThrow("template_family must be none");
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
      fallbackReason: "Codex template decision failed: unavailable.",
      managedAssets: [],
    });
    expect(result.decision.slots.cover.enabled).toBe(false);
    expect(result.decision.slots.cover.imageFit).toBeUndefined();
  });

  test("classifies structured-output schema runner failures without leaking raw messages", async () => {
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase({ coverImage: true }),
      runner: async () => {
        throw new Error("invalid_json_schema at /private/tmp/local-schema.json");
      },
    });

    expect(result.decision).toMatchObject({
      decisionMode: "no-usable-template",
      fallbackReason: "Codex template decision failed: structured-output-schema.",
      managedAssets: [],
    });
    expect(result.decision.slots.cover.enabled).toBe(false);
    expect(result.decision.slots.cover.imageFit).toBeUndefined();
    expect(result.decision.fallbackReason).not.toContain("/private/tmp");
  });
});
