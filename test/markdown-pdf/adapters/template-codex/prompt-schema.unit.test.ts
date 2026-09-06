import { describe, expect, test } from "bun:test";

import {
  buildMarkdownPdfTemplateCodexPrompt,
  MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA,
} from "../../../../src/adapters/codex/markdown-pdf-template";

import { requestBase, promptFacts, createSynthesisSignals } from "../template-codex-fixtures";

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

describe("Markdown PDF template Codex adapter: prompt schema", () => {
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
});
