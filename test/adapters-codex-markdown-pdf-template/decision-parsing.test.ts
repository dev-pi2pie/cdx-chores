import { describe, expect, test } from "bun:test";

import {
  applyMarkdownPdfTemplateCodexDecision,
  parseMarkdownPdfTemplateCodexDecision,
  suggestMarkdownPdfTemplateWithCodex,
  type MarkdownPdfTemplateCodexRequest,
} from "../../src/adapters/codex/markdown-pdf-template";

import { type MarkdownPdfTemplateCodexDecision } from "../../src/cli/markdown-pdf/template-codex";

import {
  requestBase,
  responseFromDecision,
  createSynthesisSignals,
} from "../markdown-pdf/adapters/template-codex-fixtures";

describe("Markdown PDF template Codex adapter: decision parsing", () => {
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
        cover: { enabled: true, byline: "none", imageFit: "cover" },
        code: { lineWrap: "wrap", preserveSelectors: true, style: "shiki-compatible" },
      },
    });
  });

  test("rejects unbounded cover composition values", () => {
    expect(() =>
      parseMarkdownPdfTemplateCodexDecision(
        responseFromDecision({
          composition: "image-above-title",
        }),
      ),
    ).toThrow("slots.cover.composition");
  });

  test("rejects unbounded cover byline values", () => {
    expect(() =>
      parseMarkdownPdfTemplateCodexDecision(
        responseFromDecision({
          byline: "author-under-image",
        }),
      ),
    ).toThrow("slots.cover.byline");
  });

  test("rejects recipe decisions that drift from document-derived wide-table ownership", async () => {
    const request = requestBase({
      signals: createSynthesisSignals({
        signalMode: "codex-assisted",
        tableSignals: { maxColumns: 8, maxLineWidth: 120, scannedRows: 2 },
      }),
    });

    expect(() =>
      applyMarkdownPdfTemplateCodexDecision({
        decision: parseMarkdownPdfTemplateCodexDecision(
          responseFromDecision({
            coverEnabled: false,
            recipePreset: "article",
            templateFamily: "document-layered",
          }),
        ),
        request,
      }),
    ).toThrow("recipe_preset must match the effective recipe preset: wide-table");
  });

  test("accepts recipe decisions that match document-derived wide-table ownership", async () => {
    const request = requestBase({
      signals: createSynthesisSignals({
        signalMode: "codex-assisted",
        tableSignals: { maxColumns: 8, maxLineWidth: 120, scannedRows: 2 },
      }),
    });
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...request,
      runner: async () =>
        responseFromDecision({
          coverEnabled: false,
          recipePreset: "wide-table",
          recipeSource: "document-signal",
          templateFamily: "document-layered",
        }),
    });

    expect(result.decision.slots.recipePreset).toEqual({
      preset: "wide-table",
      source: "document-signal",
    });
  });

  test("derives managed asset labels from the output plan instead of Codex text", async () => {
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase({ coverImage: true }),
      runner: async () =>
        responseFromDecision({
          managedAssets: [{ bundle_path: "assets/cover.png", source_label: "/Users/me/cover.png" }],
        }),
    });

    expect(result.decision.managedAssets).toEqual([
      { bundlePath: "assets/cover.png", sourceLabel: "cover.png" },
    ]);
  });

  test("accepts document-layered decisions without cover assets", async () => {
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase(),
      runner: async () =>
        responseFromDecision({
          coverEnabled: false,
          templateFamily: "document-layered",
        }),
    });

    expect(result.decision).toMatchObject({
      decisionMode: "adapted",
      managedAssets: [],
      templateFamily: "document-layered",
      slots: { cover: { enabled: false, imageFit: undefined } },
    });
  });

  test("rejects usable decisions that ignore an explicit cover image signal", async () => {
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase({ coverImage: true }),
      runner: async () =>
        responseFromDecision({
          coverEnabled: false,
          managedAssets: [],
          templateFamily: "document-layered",
        }),
    });

    expect(result.decision.decisionMode).toBe("no-usable-template");
    expect(result.decision.fallbackReason).toBe(
      "Codex template decision failed: invalid-application.",
    );
  });

  test("redacts model-originated paths and URLs in template free text", async () => {
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase(),
      runner: async () =>
        responseFromDecision({
          coverEnabled: false,
          decisionMode: "conservative-fallback",
          fallbackReason: "Could not use /Users/example/private.css or https://example.com/a.css",
          templateFamily: "document-layered",
          unsupportedDirections: ["Read file:///Users/example/secret.css"],
          warnings: ["Skipped C:\\Users\\example\\secret.css"],
        }),
    });

    expect(result.decision).toMatchObject({
      decisionMode: "conservative-fallback",
      fallbackReason: "Could not use [local-path] or [remote-url]",
      unsupportedDirections: ["Read [local-path]"],
      warnings: ["Skipped [local-path]"],
    });
    expect(JSON.stringify(result.decision)).not.toContain("/Users/example");
    expect(JSON.stringify(result.decision)).not.toContain("C:\\Users\\example");
    expect(JSON.stringify(result.decision)).not.toContain("https://example.com");
  });

  test("accepts bounded template font decisions", async () => {
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase(),
      runner: async () =>
        responseFromDecision({
          coverEnabled: false,
          templateFamily: "document-layered",
          fontDecisions: [
            {
              family: "Inter",
              key: "default",
              role: "heading",
              source: "font-hint",
              template_level: false,
            },
          ],
        }),
    });

    expect(result.decision.fontDecisions).toEqual([
      {
        family: "Inter",
        key: "default",
        role: "heading",
        source: "font-hint",
        templateLevel: false,
      },
    ]);
  });

  test("validates template font decision role keys", () => {
    const request = requestBase();
    const validDecision = parseMarkdownPdfTemplateCodexDecision(
      responseFromDecision({
        coverEnabled: false,
        templateFamily: "document-layered",
        fontDecisions: [
          {
            family: "Noto Serif JP",
            key: "ja",
            role: "body",
            source: "font-hint",
            template_level: false,
          },
          {
            family: "Noto Sans Symbols 2",
            key: "symbols",
            role: "code",
            source: "font-hint",
            template_level: false,
          },
        ],
      }),
    );
    expect(
      applyMarkdownPdfTemplateCodexDecision({
        decision: validDecision,
        request,
      }).decision.fontDecisions,
    ).toEqual([
      expect.objectContaining({ key: "ja", role: "body" }),
      expect.objectContaining({ key: "symbols", role: "code" }),
    ]);

    const invalidCases: Array<{
      decision: MarkdownPdfTemplateCodexDecision["fontDecisions"][number];
      message: string;
    }> = [
      {
        decision: {
          family: "Inter",
          key: "body font",
          role: "body",
          source: "font-hint",
          templateLevel: false,
        },
        message: "key must be default or a valid language tag for body fonts",
      },
      {
        decision: {
          family: "Inter",
          key: "ja",
          role: "code",
          source: "font-hint",
          templateLevel: false,
        },
        message: "key must be default or symbols for code fonts",
      },
      {
        decision: {
          family: "Inter",
          key: "ja",
          role: "heading",
          source: "font-hint",
          templateLevel: false,
        },
        message: "key must be default for heading fonts",
      },
    ];
    for (const invalidCase of invalidCases) {
      expect(() =>
        applyMarkdownPdfTemplateCodexDecision({
          decision: {
            ...validDecision,
            fontDecisions: [invalidCase.decision],
          },
          request,
        }),
      ).toThrow(invalidCase.message);
    }

    expect(() =>
      applyMarkdownPdfTemplateCodexDecision({
        decision: {
          ...validDecision,
          fontDecisions: [
            {
              family: "Noto Serif TC",
              key: "zh-Hant",
              role: "body",
              source: "font-hint",
              templateLevel: false,
            },
            {
              family: "Noto Serif TC Alt",
              key: "zh-hant",
              role: "body",
              source: "font-hint",
              templateLevel: false,
            },
          ],
        },
        request,
      }),
    ).toThrow("duplicates font role/key body.zh-Hant");
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
    expect(result.decision.fallbackReason).toBe(
      "Codex template decision failed: invalid-application.",
    );
  });

  test("completes omitted profile-style font-hint role keys locally", async () => {
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase({
        signals: createSynthesisSignals({
          fontHints: [
            "prefer Source Serif 4 for English body and Noto Serif JP for Japanese, Noto Serif TC for Traditional Chinese, JetBrains Mono for code and Noto Sans Symbols 2 for symbols",
          ],
          pdfContentLangs: ["en", "ja", "zh-Hant"],
          signalMode: "codex-assisted",
        }),
      }),
      runner: async () =>
        responseFromDecision({
          coverEnabled: false,
          fontDecisions: [],
          templateFamily: "document-layered",
        }),
    });

    expect(result.decision.fontDecisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ family: "Source Serif 4", key: "default", role: "body" }),
        expect.objectContaining({ family: "Noto Serif JP", key: "ja", role: "body" }),
        expect.objectContaining({ family: "Noto Serif TC", key: "zh-Hant", role: "body" }),
        expect.objectContaining({ family: "JetBrains Mono", key: "default", role: "code" }),
        expect.objectContaining({ family: "Noto Sans Symbols 2", key: "symbols", role: "code" }),
      ]),
    );
    expect(result.decision.fontDecisions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ family: "prefer Source Serif 4" })]),
    );
  });

  test("rejects planned managed asset paths that are not bundle-relative", () => {
    const request = requestBase({ coverImage: true });
    const malformedRequest: MarkdownPdfTemplateCodexRequest = {
      ...request,
      outputPlan: {
        ...request.outputPlan,
        assets: request.outputPlan.assets.map((asset) => ({
          ...asset,
          bundlePath: "/absolute/cover.png",
        })),
      },
    };
    const decision = parseMarkdownPdfTemplateCodexDecision(
      responseFromDecision({
        managedAssets: [{ bundle_path: "/absolute/cover.png", source_label: "cover.png" }],
      }),
    );

    expect(() =>
      applyMarkdownPdfTemplateCodexDecision({
        decision,
        request: malformedRequest,
      }),
    ).toThrow("bundle-relative");
  });

  test("rejects cover-media family when no cover image is available", async () => {
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase(),
      runner: async () => responseFromDecision({ templateFamily: "cover-media-layered" }),
    });

    expect(result.decision.decisionMode).toBe("no-usable-template");
    expect(result.decision.fallbackReason).toBe(
      "Codex template decision failed: invalid-application.",
    );
  });

  test("rejects enabled cover slots when no managed cover asset is planned", async () => {
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase(),
      runner: async () =>
        responseFromDecision({
          templateFamily: "document-layered",
          coverEnabled: true,
        }),
    });

    expect(result.decision.decisionMode).toBe("no-usable-template");
    expect(result.decision.fallbackReason).toBe(
      "Codex template decision failed: invalid-application.",
    );
  });

  test("rejects enabled cover slots without an image-fit decision", async () => {
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase({ coverImage: true }),
      runner: async () => responseFromDecision({ imageFit: "" }),
    });

    expect(result.decision.decisionMode).toBe("no-usable-template");
    expect(result.decision.fallbackReason).toBe(
      "Codex template decision failed: invalid-application.",
    );
  });

  test("rejects unsafe or duplicated template font decisions", async () => {
    const duplicateRole = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase(),
      runner: async () =>
        responseFromDecision({
          coverEnabled: false,
          fontDecisions: [
            {
              family: "Inter",
              key: "default",
              role: "body",
              source: "font-hint",
              template_level: false,
            },
            {
              family: "Georgia",
              key: "default",
              role: "body",
              source: "font-hint",
              template_level: false,
            },
          ],
          templateFamily: "document-layered",
        }),
    });
    expect(duplicateRole.decision.decisionMode).toBe("no-usable-template");

    const rawCssFamily = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase(),
      runner: async () =>
        responseFromDecision({
          coverEnabled: false,
          fontDecisions: [
            {
              family: "Inter, sans-serif",
              key: "default",
              role: "heading",
              source: "font-hint",
              template_level: false,
            },
          ],
          templateFamily: "document-layered",
        }),
    });
    expect(rawCssFamily.decision.decisionMode).toBe("no-usable-template");
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

    expect(() =>
      applyMarkdownPdfTemplateCodexDecision({
        decision: {
          ...decision,
          fontDecisions: [
            {
              family: "Inter",
              key: "default",
              role: "heading",
              source: "font-hint",
              templateLevel: "yes" as unknown as boolean,
            },
          ],
        },
        request,
      }),
    ).toThrow("font_decisions[0].template_level");

    expect(() =>
      applyMarkdownPdfTemplateCodexDecision({
        decision: {
          ...decision,
          fontDecisions: [
            {
              family: "Inter",
              key: "default",
              role: "heading",
              source: "font-hint",
              templateLevel: true,
            },
          ],
        },
        request,
      }),
    ).toThrow("requires source template-style");
  });
});
