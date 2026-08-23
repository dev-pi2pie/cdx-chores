import { afterEach, describe, expect, mock, test } from "bun:test";

import {
  applyMarkdownPdfTemplateCodexDecision,
  buildMarkdownPdfTemplateCodexPrompt,
  MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA,
  MARKDOWN_PDF_TEMPLATE_CODEX_TIMEOUT_MS,
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

function requestBase(
  input: {
    coverImage?: boolean;
    signals?: MarkdownPdfTemplateCodexRequest["signals"];
  } = {},
): MarkdownPdfTemplateCodexRequest {
  return {
    intent: "adapt this report with a local cover image",
    outputPlan: createSynthesisOutputPlan({ includeCoverAsset: input.coverImage }),
    signals:
      input.signals ??
      createSynthesisSignals(
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
    key: string;
    role: string;
    source: string;
    template_level: boolean;
  }>;
  composition?: string;
  byline?: string;
  imageFit?: string;
  imageAnchor?: string;
  managedAssets?: Array<{ bundle_path: string; source_label: string }>;
  mediaAlign?: string;
  mediaScale?: string;
  recipePreset?: string;
  recipeSource?: string;
  templateFamily?: string;
  textAlign?: string;
  warnings?: string[];
  unsupportedDirections?: string[];
  fallbackReason?: string;
}): string {
  const coverEnabled = input.coverEnabled ?? true;
  const recipePreset = input.recipePreset ?? "article";
  const slotRecipePreset = recipePreset === "none" ? "article" : recipePreset;
  return JSON.stringify({
    decision_mode: input.decisionMode ?? "adapted",
    template_family: input.templateFamily ?? "cover-media-layered",
    recipe_preset: recipePreset,
    slots: {
      recipe_preset: {
        preset: slotRecipePreset,
        source: input.recipeSource ?? "renderer-default",
      },
      cover: {
        enabled: coverEnabled,
        byline: input.byline ?? "none",
        composition: input.composition ?? "media-first-caption",
        image_fit: input.imageFit ?? (coverEnabled ? "cover" : ""),
        image_anchor: input.imageAnchor ?? "center",
        media_align: input.mediaAlign ?? "center",
        media_scale: input.mediaScale ?? (coverEnabled ? "hero" : "balanced"),
        text_align: input.textAlign ?? "center",
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
    warnings: input.warnings ?? [],
    unsupported_directions: input.unsupportedDirections ?? [],
    fallback_reason: input.fallbackReason ?? "",
  });
}

function noUsableResponse(
  input: {
    coverEnabled?: boolean;
    cssBlocks?: Array<{ css: string; slot: string }>;
    managedAssets?: Array<{ bundle_path: string; source_label: string }>;
  } = {},
): string {
  return responseFromDecision({
    coverEnabled: input.coverEnabled ?? false,
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
  afterEach(() => {
    mock.restore();
  });

  test("builds bounded prompt facts with families, slots, hooks, and asset sizing signals", () => {
    const prompt = buildMarkdownPdfTemplateCodexPrompt(requestBase({ coverImage: true }));
    const facts = promptFacts(prompt);

    expect(prompt).toContain("Return JSON only");
    expect(prompt).toContain("Use cover.image_fit contain or cover");
    expect(prompt).toContain("Use cover.composition for title/image/subtitle ordering");
    expect(prompt).toContain("Use cover.byline none unless intent asks for author");
    expect(prompt).toContain("title-media-subtitle");
    expect(prompt).toContain("Use font_decisions []");
    expect(prompt).toContain("Always include fallback_reason");
    expect(prompt).not.toContain("source-cover.png");
    expect(facts).toMatchObject({
      assetSizingPolicy: {
        rule: "Use bounded cover.image_fit values, not raw pixel width or height directives.",
      },
      fontDecisionPolicy: {
        roleKeyMatrix: {
          body: ["default", "<valid-language-tag>"],
          code: ["default", "symbols"],
          heading: ["default"],
        },
        roles: ["body", "heading", "code"],
        sources: ["font-hint", "template-style"],
      },
      coverCompositionPolicy: {
        byline: ["none", "author", "date", "author-date"],
        compositions: [
          "media-first-caption",
          "title-media-subtitle",
          "title-subtitle-media",
          "media-background-overlay",
        ],
        textAlign: ["left", "center", "right"],
      },
      layoutDecisionPolicy: {
        recipePresetPolicy: {
          status: "not-needed",
          source: "document-table-signal",
        },
      },
      titleDecisionPolicy: {
        templateTitleSignal: {
          explicitKeepMetadataTitleIntent: false,
          explicitHideMetadataTitleIntent: false,
        },
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

  test("keeps internal full-Profile font ownership out of bounded prompt facts", () => {
    const signals = {
      ...createSynthesisSignals({
        fontHints: ["Editorial"],
        profileFonts: {
          families: [{ family: "Bounded Profile Body", key: "default", role: "body" }],
          overflowFamilyCount: 2,
        },
        signalMode: "codex-assisted",
      }),
      fontOwnership: {
        ownedKeys: [{ key: "ja", role: "body" }],
      },
      normalizedProfile: {
        fonts: {
          body: { ja: "Private Full Profile Sentinel" },
        },
      },
    };
    const prompt = buildMarkdownPdfTemplateCodexPrompt(requestBase({ signals }));
    const facts = promptFacts(prompt) as {
      fontFacts: Record<string, unknown>;
    };

    expect(facts.fontFacts).toEqual({
      hints: ["Editorial"],
      profileFonts: {
        families: [{ family: "Bounded Profile Body", key: "default", role: "body" }],
        overflowFamilyCount: 2,
      },
    });
    expect(Object.keys(facts.fontFacts).sort()).toEqual(["hints", "profileFonts"]);
    expect(prompt).not.toContain("fontOwnership");
    expect(prompt).not.toContain("ownedKeys");
    expect(prompt).not.toContain("normalizedProfile");
    expect(prompt).not.toContain("Private Full Profile Sentinel");
  });

  test("uses schema-valid recipe source facts for document-derived wide-table prompts", () => {
    const prompt = buildMarkdownPdfTemplateCodexPrompt(
      requestBase({
        signals: createSynthesisSignals({
          signalMode: "codex-assisted",
          tableSignals: { maxColumns: 8, maxLineWidth: 120, scannedRows: 2 },
        }),
      }),
    );
    const facts = promptFacts(prompt) as {
      layoutDecisionPolicy: {
        recipePresetPolicy: { source: string; status: string };
        schemaRecipePresetSource: string;
        tableLayoutSignal: { level: string };
      };
      recipeSignal: { effectiveOptions: { preset: string } };
    };

    expect(facts.layoutDecisionPolicy).toMatchObject({
      recipePresetPolicy: {
        status: "applied",
        source: "document-table-signal",
      },
      schemaRecipePresetSource: "document-signal",
      tableLayoutSignal: { level: "strong" },
    });
    expect(facts.recipeSignal.effectiveOptions.preset).toBe("wide-table");
    expect(prompt).toContain("layoutDecisionPolicy.schemaRecipePresetSource");
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
      MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA.properties.slots.properties.cover.properties.byline
        .enum,
    ).toEqual(["none", "author", "date", "author-date"]);
    expect(
      MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA.properties.slots.properties.cover.properties
        .composition.enum,
    ).toEqual([
      "media-first-caption",
      "title-media-subtitle",
      "title-subtitle-media",
      "media-background-overlay",
    ]);
    expect(
      MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA.properties.slots.properties.cover.properties,
    ).not.toHaveProperty("title_placement");
    expect(
      MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA.properties.slots.properties.cover.properties,
    ).not.toHaveProperty("layout");
    expect(
      MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA.properties.font_decisions.items.properties.role
        .enum,
    ).toEqual(["body", "heading", "code"]);
    expect(
      MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA.properties.font_decisions.items.required,
    ).toContain("key");
    expect(
      MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA.properties.slots.properties.recipe_preset.properties
        .source.enum,
    ).toContain("document-signal");
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
        cover: { enabled: true, byline: "none", imageFit: "cover" },
        code: { lineWrap: "wrap", preserveSelectors: true, style: "shiki-compatible" },
      },
    });
  });

  test("starts the default Codex runner in the request working directory", async () => {
    let capturedThreadOptions: unknown;
    let capturedRunMessages: unknown;
    let capturedRunOptions: unknown;
    const originalTimeoutDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, "timeout");
    const timeoutCalls: number[] = [];
    if (!originalTimeoutDescriptor || typeof originalTimeoutDescriptor.value !== "function") {
      throw new Error("AbortSignal.timeout is not available");
    }
    const originalTimeout = originalTimeoutDescriptor.value as typeof AbortSignal.timeout;
    Object.defineProperty(AbortSignal, "timeout", {
      ...originalTimeoutDescriptor,
      value: (milliseconds: number) => {
        timeoutCalls.push(milliseconds);
        return originalTimeout.call(AbortSignal, milliseconds);
      },
    });

    mock.module("@openai/codex-sdk", () => ({
      Codex: class {
        startThread(options: unknown) {
          capturedThreadOptions = options;
          return {
            run: async (messages: unknown, options: unknown) => {
              capturedRunMessages = messages;
              capturedRunOptions = options;
              return {
                finalResponse: responseFromDecision({
                  coverEnabled: false,
                  templateFamily: "document-layered",
                }),
              };
            },
          };
        }
      },
    }));

    let result: Awaited<ReturnType<typeof suggestMarkdownPdfTemplateWithCodex>>;
    try {
      result = await suggestMarkdownPdfTemplateWithCodex(requestBase());
    } finally {
      Object.defineProperty(AbortSignal, "timeout", originalTimeoutDescriptor);
    }

    const threadOptions = capturedThreadOptions as {
      approvalPolicy: string;
      modelReasoningEffort: string;
      networkAccessEnabled: boolean;
      sandboxMode: string;
      webSearchMode: string;
      workingDirectory: string;
    };
    const runMessages = capturedRunMessages as Array<{ text: string; type: string }>;
    const runOptions = capturedRunOptions as { outputSchema: unknown; signal: AbortSignal };
    expect(result.decision.decisionMode).toBe("adapted");
    expect(threadOptions).toMatchObject({
      approvalPolicy: "never",
      modelReasoningEffort: "low",
      networkAccessEnabled: true,
      sandboxMode: "read-only",
      webSearchMode: "disabled",
    });
    expect(threadOptions.workingDirectory).toBe("/repo");
    expect(runMessages).toEqual([
      expect.objectContaining({
        text: expect.stringContaining("Deterministic facts:"),
        type: "text",
      }),
    ]);
    expect(runOptions.outputSchema).toBe(MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA);
    expect(runOptions.signal).toBeInstanceOf(AbortSignal);
    expect(timeoutCalls).toEqual([MARKDOWN_PDF_TEMPLATE_CODEX_TIMEOUT_MS]);
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

  test("accepts conservative fallback decisions with bounded slot-owned CSS", async () => {
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase({ coverImage: true }),
      runner: async () =>
        responseFromDecision({
          cssBlocks: [{ css: ".pdf-cover-media__caption { color: #555555; }", slot: "cover" }],
          decisionMode: "conservative-fallback",
        }),
    });

    expect(result.decision.decisionMode).toBe("conservative-fallback");
    expect(result.decision.cssBlocks).toEqual([
      { css: ".pdf-cover-media__caption { color: #555555; }", slot: "cover" },
    ]);
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

  test("repairs schema-valid responses that fail local application once", async () => {
    const prompts: string[] = [];
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase(),
      runner: async ({ prompt }) => {
        prompts.push(prompt);
        return prompts.length === 1
          ? responseFromDecision({
              coverEnabled: false,
              managedAssets: [
                {
                  bundle_path: "/workspace/client/private-cover.png",
                  source_label: "cover.png",
                },
              ],
              templateFamily: "document-layered",
            })
          : responseFromDecision({
              coverEnabled: false,
              fontDecisions: [
                {
                  family: "Source Serif 4",
                  key: "default",
                  role: "body",
                  source: "font-hint",
                  template_level: false,
                },
              ],
              templateFamily: "document-layered",
            });
      },
    });

    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("Correction request:");
    expect(prompts[1]).toContain("not in the output plan");
    expect(prompts[1]).toContain("[local-path]");
    expect(prompts[1]).not.toContain("/workspace/client");
    expect(prompts[1]).not.toContain("private-cover.png");
    expect(result.decision.decisionMode).toBe("adapted");
    expect(result.decision.fontDecisions).toEqual([
      expect.objectContaining({
        family: "Source Serif 4",
        key: "default",
        role: "body",
      }),
    ]);
  });

  test("stops after one application repair attempt", async () => {
    let callCount = 0;
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase(),
      runner: async () => {
        callCount += 1;
        return responseFromDecision({
          coverEnabled: false,
          managedAssets: [
            {
              bundle_path: "/workspace/client/private-cover.png",
              source_label: "cover.png",
            },
          ],
          templateFamily: "document-layered",
        });
      },
    });

    expect(callCount).toBe(2);
    expect(result.decision.decisionMode).toBe("no-usable-template");
    expect(result.decision.fallbackReason).toBe(
      "Codex template decision failed: invalid-application.",
    );
  });

  test("reuses one configured timeout for the initial and application-repair requests", async () => {
    const timeoutCalls: Array<number | undefined> = [];
    let callCount = 0;
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase(),
      timeoutMs: 120_000,
      runner: async ({ timeoutMs }) => {
        timeoutCalls.push(timeoutMs);
        callCount += 1;
        return callCount === 1
          ? responseFromDecision({
              coverEnabled: false,
              managedAssets: [
                {
                  bundle_path: "/workspace/client/private-cover.png",
                  source_label: "cover.png",
                },
              ],
              templateFamily: "document-layered",
            })
          : responseFromDecision({
              coverEnabled: false,
              templateFamily: "document-layered",
            });
      },
    });

    expect(result.decision.decisionMode).toBe("adapted");
    expect(timeoutCalls).toEqual([120_000, 120_000]);
  });

  test("formats only structurally preserved template timeouts as timeout failures", async () => {
    const timeoutError = new Error("private transport details");
    timeoutError.name = "TimeoutError";
    const timeoutResult = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase(),
      timeoutMs: 120_000,
      runner: async () => {
        throw timeoutError;
      },
    });
    const genericResult = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase(),
      timeoutMs: 120_000,
      runner: async () => {
        throw new Error("request timed out after two minutes");
      },
    });

    expect(timeoutResult.decision.fallbackReason).toBe(
      "Codex Markdown PDF template request timed out after the 2m per-attempt limit.",
    );
    expect(timeoutResult.decision.fallbackReason).not.toContain("private transport details");
    expect(genericResult.decision.fallbackReason).toBe(
      "Codex template decision failed: unavailable.",
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
        css: ".pdf-cover-media { background-image: url(foo.png); }",
        slot: "cover",
      }),
    ).toThrow("remote URLs or absolute local paths");
    expect(() =>
      validateMarkdownPdfTemplateCodexCssBlock({
        css: '.pdf-cover-media { background-image: u\\72l("h\\74tps://example.com/a.png"); }',
        slot: "cover",
      }),
    ).toThrow("remote URLs or absolute local paths");
    expect(() =>
      validateMarkdownPdfTemplateCodexCssBlock({
        css: '.pdf-cover-media { background-image: u/**/rl("\\2fUsers/me/a.png"); }',
        slot: "cover",
      }),
    ).toThrow("remote URLs or absolute local paths");
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
        css: ".pdf-cover-media__caption { color: #555555;",
        slot: "cover",
      }),
    ).toThrow("unbalanced braces");
    expect(() =>
      validateMarkdownPdfTemplateCodexCssBlock({
        css: ".pdf-cover-caption { color: #555555; }",
        slot: "cover",
      }),
    ).toThrow("outside the cover slot");
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

  test("rejects generated CSS declarations that can override font families", () => {
    const familyOverrides = [
      {
        css: 'body { font-family: "Late Override"; }',
        slot: "typography" as const,
      },
      {
        css: '.pdf-cover-media__title { font: 700 22pt/1.15 "Cover Display"; }',
        slot: "cover" as const,
      },
      {
        css: ':root { --template-body-font: "Late Variable"; }',
        slot: "colors" as const,
      },
      {
        css: 'body { FoNt-FaMiLy: "Case Override"; }',
        slot: "typography" as const,
      },
      {
        css: 'body { f/**/ont-fa/**/mily: "Comment Override"; }',
        slot: "typography" as const,
      },
      {
        css: 'body { \\66 ont-family: "Escaped Override"; }',
        slot: "typography" as const,
      },
      {
        css: ':root { --TeMpLaTe-CoDe-FoNt: "Case Variable"; }',
        slot: "colors" as const,
      },
      {
        css: 'body { font-\\\nfamily: "Line Continuation Override"; }',
        slot: "typography" as const,
      },
      {
        css: ':root { --template-body-\\\nfont: "Line Continuation Variable"; }',
        slot: "colors" as const,
      },
      {
        css: "body { all: initial; }",
        slot: "typography" as const,
      },
      {
        css: "p { all: unset; }",
        slot: "typography" as const,
      },
    ];

    for (const block of familyOverrides) {
      expect(() => validateMarkdownPdfTemplateCodexCssBlock(block)).toThrow(
        "must not declare all, font, font-family, or Template font custom properties",
      );
    }
  });

  test("rejects nested generated CSS rules instead of inspecting partial branches", () => {
    const nestedBlocks = [
      'body { p { font-family: "Nested Override"; } }',
      'body { h1 { font: 12pt "Nested Shorthand"; } }',
      'body { p { --template-body-font: "Nested Variable"; } }',
      'body { p { color: red; } font-family: "Post-nesting Override"; }',
      "body { p { color: red; } all: initial; }",
      'body { p { color: red; } --template-body-font: "Post-nesting Variable"; }',
    ];

    for (const css of nestedBlocks) {
      expect(() =>
        validateMarkdownPdfTemplateCodexCssBlock({
          css,
          slot: "typography",
        }),
      ).toThrow("must use plain selector blocks only");
    }
  });

  test("ignores braces inside strings and comments when checking rule depth", () => {
    const flatBlocks = [
      {
        css: '.pdf-cover-media__caption { content: "{}"; }',
        slot: "cover" as const,
      },
      {
        css: "body { /* { } */ color: red; }",
        slot: "colors" as const,
      },
    ];

    for (const block of flatBlocks) {
      expect(validateMarkdownPdfTemplateCodexCssBlock(block)).toEqual(block);
    }
  });

  test("keeps the tolerant scanner-issue inspection policy", () => {
    const block = {
      css: "body { color: red; } /* unfinished generated note",
      slot: "colors" as const,
    };

    expect(validateMarkdownPdfTemplateCodexCssBlock(block)).toEqual(block);
    expect(() =>
      validateMarkdownPdfTemplateCodexCssBlock({
        css: 'body { content: "unfinished',
        slot: "colors",
      }),
    ).toThrow("has unbalanced braces");
  });

  test("allows non-family typography declarations and Template font variable reads", () => {
    expect(
      validateMarkdownPdfTemplateCodexCssBlock({
        css: [
          "body {",
          "  font-size: 11pt;",
          "  font-weight: 400;",
          "  font-style: normal;",
          "  outline: var(--template-body-font);",
          "}",
        ].join("\n"),
        slot: "typography",
      }),
    ).toEqual({
      css: [
        "body {",
        "  font-size: 11pt;",
        "  font-weight: 400;",
        "  font-style: normal;",
        "  outline: var(--template-body-font);",
        "}",
      ].join("\n"),
      slot: "typography",
    });
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
