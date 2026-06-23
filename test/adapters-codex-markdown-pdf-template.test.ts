import { describe, expect, test } from "bun:test";

import {
  applyMarkdownPdfTemplateCodexDecision,
  buildMarkdownPdfTemplateCodexPrompt,
  MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA,
  parseMarkdownPdfTemplateCodexDecision,
  suggestMarkdownPdfTemplateWithCodex,
  type MarkdownPdfTemplateCodexRequest,
} from "../src/adapters/codex/markdown-pdf-template";
import {
  validateMarkdownPdfTemplateCodexCssBlock,
  type MarkdownPdfTemplateCodexDecision,
} from "../src/cli/markdown-pdf/template-codex";
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
  coverEnabled?: boolean;
  cssBlocks?: Array<{ css: string; slot: string }>;
  decisionMode?: string;
  fontDecisions?: Array<{
    family: string;
    role: string;
    source: string;
    template_level: boolean;
  }>;
  imageFit?: string;
  managedAssets?: Array<{ bundle_path: string; source_label: string }>;
  recipePreset?: string;
  templateFamily?: string;
}): string {
  const coverEnabled = input.coverEnabled ?? true;
  return JSON.stringify({
    decision_mode: input.decisionMode ?? "adapted",
    template_family: input.templateFamily ?? "cover-media-layered",
    recipe_preset: input.recipePreset ?? "article",
    slots: {
      recipe_preset: { preset: "article", source: "renderer-default" },
      cover: {
        enabled: coverEnabled,
        image_fit: input.imageFit ?? (coverEnabled ? "cover" : ""),
        layout: coverEnabled ? "contained-media" : "none",
        title_placement: coverEnabled ? "below-media" : "document-title",
        style: coverEnabled ? "media" : "none",
        orientation_bucket: coverEnabled ? "landscape" : "unknown",
        fit_pressure: coverEnabled ? "normal" : "unknown",
      },
      tables: { density: "standard", repeat_header: true, width: "content" },
      code: { style: "shiki-compatible", line_wrap: "wrap", preserve_selectors: true },
      spacing: { density: "standard" },
      typography: { scale: "standard" },
      colors: { palette: "neutral" },
    },
    css_blocks: input.cssBlocks ?? [],
    font_decisions: input.fontDecisions ?? [],
    managed_assets:
      input.managedAssets ??
      (coverEnabled ? [{ bundle_path: "assets/cover.png", source_label: "cover.png" }] : []),
    warnings: [],
    unsupported_directions: [],
    fallback_reason: "",
  });
}

function noUsableResponse(
  input: {
    cssBlocks?: Array<{ css: string; slot: string }>;
    managedAssets?: Array<{ bundle_path: string; source_label: string }>;
  } = {},
): string {
  return responseFromDecision({
    coverEnabled: false,
    cssBlocks: input.cssBlocks ?? [],
    decisionMode: "no-usable-template",
    managedAssets: input.managedAssets ?? [],
    recipePreset: "none",
    templateFamily: "none",
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
    expect(prompt).toContain("Use font_decisions []");
    expect(prompt).toContain("Always include fallback_reason");
    expect(prompt).not.toContain("source-cover.png");
    expect(facts).toMatchObject({
      assetSizingPolicy: {
        rule: "Use bounded cover.image_fit values, not raw pixel width or height directives.",
      },
      fontDecisionPolicy: {
        roles: ["body", "heading", "code"],
        sources: ["font-hint", "template-style"],
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
    expect(MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA.required).toContain("font_decisions");
    expect(MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA.properties.template_family.enum).toContain(
      "none",
    );
    expect(MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA.properties.recipe_preset.enum).toContain(
      "none",
    );
    expect(
      MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA.properties.slots.properties.cover.properties
        .image_fit.enum,
    ).toContain("");
    expect(
      MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA.properties.font_decisions.items.properties.role
        .enum,
    ).toEqual(["body", "heading", "code"]);
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
        role: "heading",
        source: "font-hint",
        templateLevel: false,
      },
    ]);
  });

  test("turns invalid structured output into no-usable-template", async () => {
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase({ coverImage: true }),
      runner: async () => "{not json",
    });

    expect(result.decision.decisionMode).toBe("no-usable-template");
    expect(result.decision.fallbackReason).toBe(
      "Codex template decision was rejected by validation.",
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
          responseFromDecision({
            coverEnabled: false,
            decisionMode: "no-usable-template",
            fontDecisions: [
              {
                family: "Inter",
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
      fallbackReason: "Codex template decision unavailable.",
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
    expect(result.decision.fallbackReason).toBe(
      "Codex template decision was rejected by validation.",
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
      "Codex template decision was rejected by validation.",
    );
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
    expect(result.decision.fallbackReason).toBe(
      "Codex template decision was rejected by validation.",
    );
  });

  test("rejects enabled cover slots without an image-fit decision", async () => {
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase({ coverImage: true }),
      runner: async () => responseFromDecision({ imageFit: "" }),
    });

    expect(result.decision.decisionMode).toBe("no-usable-template");
    expect(result.decision.fallbackReason).toBe(
      "Codex template decision was rejected by validation.",
    );
  });

  test("rejects unsafe or duplicated template font decisions", async () => {
    const duplicateRole = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase(),
      runner: async () =>
        responseFromDecision({
          coverEnabled: false,
          fontDecisions: [
            { family: "Inter", role: "body", source: "font-hint", template_level: false },
            { family: "Georgia", role: "body", source: "font-hint", template_level: false },
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

  test("rejects unsafe CSS block branches directly", () => {
    expect(() =>
      validateMarkdownPdfTemplateCodexCssBlock({
        css: ".pdf-cover-media { background-image: url(https://example.com/a.png); }",
        slot: "cover",
      }),
    ).toThrow("remote URLs");
    expect(() =>
      validateMarkdownPdfTemplateCodexCssBlock({
        css: ".pdf-cover-media { background-image: url(/Users/me/a.png); }",
        slot: "cover",
      }),
    ).toThrow("absolute local paths");
    expect(() =>
      validateMarkdownPdfTemplateCodexCssBlock({
        css: "@import url(https://example.com/a.css);",
        slot: "colors",
      }),
    ).toThrow("@import");
    expect(() =>
      validateMarkdownPdfTemplateCodexCssBlock({
        css: "@media print { body { color: #222222; } }",
        slot: "colors",
      }),
    ).toThrow("plain selector blocks");
    expect(() =>
      validateMarkdownPdfTemplateCodexCssBlock({
        css: `body { color: #222222; }\n${"p { margin: 0; }\n".repeat(160)}`,
        slot: "spacing",
      }),
    ).toThrow("at most 2000 characters");
    expect(() =>
      validateMarkdownPdfTemplateCodexCssBlock({
        css: ".pdf-cover-caption { color: #555555;",
        slot: "cover",
      }),
    ).toThrow("unbalanced braces");
    expect(() =>
      validateMarkdownPdfTemplateCodexCssBlock({
        css: ".pdf-cover-media { display: none; }",
        slot: "cover",
      }),
    ).toThrow("preserve required template selectors");
    expect(() =>
      validateMarkdownPdfTemplateCodexCssBlock({
        css: "tbody { margin: 0; }",
        slot: "spacing",
      }),
    ).toThrow("outside the spacing slot");
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
              role: "heading",
              source: "font-hint",
              templateLevel: "yes" as unknown as boolean,
            },
          ],
        },
        request,
      }),
    ).toThrow("font_decisions[0].template_level");
  });
});
