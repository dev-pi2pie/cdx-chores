import { describe, expect, test } from "bun:test";

import {
  MARKDOWN_PDF_CODEX_PATCH_VALUE_CONSTRAINTS,
  MARKDOWN_PDF_CODEX_PATCH_VALUE_DOMAINS,
  MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA,
} from "../../src/adapters/codex/markdown-pdf-profile";
import { buildMarkdownPdfProfileCodexPrompt } from "../../src/adapters/codex/markdown-pdf-profile/prompt";
import {
  MARKDOWN_PDF_CODEX_PATCH_PATHS,
  type MarkdownPdfCodexProfileFontPatch,
} from "../../src/adapters/codex/markdown-pdf-profile/types";
import { createMarkdownPdfProfileCandidates } from "../../src/cli/markdown-pdf/profile/candidates";
import { requestBase } from "./fixtures";

function promptFacts(prompt: string): Record<string, unknown> {
  const marker = "Deterministic facts:\n";
  const index = prompt.indexOf(marker);
  if (index < 0) {
    throw new Error("prompt did not include deterministic facts");
  }
  return JSON.parse(prompt.slice(index + marker.length)) as Record<string, unknown>;
}

type MarkdownPdfCodexOutputSchemaKey =
  (typeof MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA.required)[number];
type MarkdownPdfCodexPatchValueDomainPath =
  (typeof MARKDOWN_PDF_CODEX_PATCH_VALUE_DOMAINS)[number]["path"];
type MarkdownPdfCodexPatchValueConstraintPath =
  (typeof MARKDOWN_PDF_CODEX_PATCH_VALUE_CONSTRAINTS)[number]["path"];

describe("Markdown PDF Codex profile adapter", () => {
  test("builds a bounded prompt from summaries and signals", () => {
    const prompt = buildMarkdownPdfProfileCodexPrompt(requestBase);

    expect(prompt).toContain("Return JSON only");
    expect(prompt).toContain("wide table report");
    expect(prompt).toContain("candidateSummaries");
    expect(prompt).toContain("selectedBaseProfileSummary");
    expect(prompt).toContain("patchValueDomains");
    expect(prompt).toContain("patchValueConstraints");
    expect(prompt).toContain("pageNumberContract");
    expect(prompt).toContain("styleDecisionPolicy");
    expect(prompt).toContain("tableLayoutSignal");
    expect(prompt).toContain("titleDecisionSignal");
    expect(prompt).toContain("fontPatchContract");
    expect(prompt).toContain("accepted_font_patches");
    expect(prompt).toContain("Noto Serif JP");
    expect(prompt).toContain("never put /fonts/... paths in accepted_patches");
    expect(prompt).toContain('"traits"');
    expect(prompt).toContain('"density": "wide"');
    expect(prompt).toContain("Do not enable page numbers by default");
    expect(prompt).toContain("clean, proper, polished, or professional");
    expect(prompt).toContain("Strong tableLayoutSignal");
    expect(prompt).toContain("duplicate visible title risk");
    expect(prompt).toContain("wide-table candidate");
    expect(prompt).toContain("rendererCompatibility");
    expect(prompt).toContain("local cover images");
    expect(prompt).toContain("template-only layout");
    expect(prompt).toContain("unmatched_directions");
    expect(prompt).toContain("/cover/style");
    expect(prompt).toContain("plain");
    expect(prompt).toContain("/pageNumbers/position");
    expect(prompt).toContain("/pageNumbers/countFrom");
    expect(prompt).toContain("pageNumbers.style is not a supported field");
    expect(prompt).toContain("bottom-center");
    expect(prompt).toContain("titleBlockContract");
    expect(prompt).toContain("/titleBlock/metadataTitle");
    expect(prompt).toContain("supportedSchemaSummary");
    expect(prompt).toContain("fonts.body.default");
    expect(prompt).toContain("Always include fallback_reason");
    expect(prompt).not.toContain("fullProfile");
  });

  test("exposes font patch role-key matrix for multilingual body and code symbol hints", () => {
    const facts = promptFacts(
      buildMarkdownPdfProfileCodexPrompt({
        ...requestBase,
        documentSignals: {
          ...requestBase.documentSignals,
          frontmatter: {
            ...requestBase.documentSignals.frontmatter,
            pdfContentLangs: ["en", "ja", "zh-Hant"],
          },
          scripts: {
            buckets: { han: 30, hiragana: 12, latin: 80 },
            scannedChars: 122,
            truncated: false,
          },
        },
        fontHints: [
          "use Source Serif 4 for English body, Noto Serif JP for Japanese, Noto Serif TC for Traditional Chinese, JetBrains Mono for code, Noto Sans Symbols 2 for symbols",
        ],
        intent: "mixed-language PDF with readable CJK body text and readable code symbols",
      }),
    );

    const fontPatchContract = facts.fontPatchContract as {
      examples: MarkdownPdfCodexProfileFontPatch[];
      roleKeyMatrix: Array<{ allowedKeys: string[]; role: string; useFor: string }>;
      rules: string[];
    };

    expect(fontPatchContract.roleKeyMatrix).toEqual([
      {
        allowedKeys: ["default", "language tags such as ja or zh-Hant"],
        role: "body",
        useFor: "body text, including language-specific body font fallback",
      },
      {
        allowedKeys: ["default", "symbols"],
        role: "code",
        useFor: "code text and code-symbol fallback",
      },
      {
        allowedKeys: ["default"],
        role: "heading",
        useFor: "one reusable heading font only; language-specific heading keys are unsupported",
      },
      {
        allowedKeys: ["default"],
        role: "pageChrome",
        useFor: "one reusable header, footer, and page-number font only",
      },
    ]);
    expect(fontPatchContract.rules).toContain(
      "Never use language-tag keys with heading or pageChrome; use heading.default or pageChrome.default only when a single reusable family is appropriate.",
    );
    expect(fontPatchContract.rules).toContain(
      "Map language-specific CJK body font requests to body language keys such as ja or zh-Hant, not to heading or pageChrome.",
    );
    expect(fontPatchContract.rules).toContain("Map readable code symbol requests to code.symbols.");
    expect(fontPatchContract.examples).toEqual([
      { op: "replace-font", role: "body", key: "default", value: "Source Serif 4" },
      { op: "replace-font", role: "body", key: "ja", value: "Noto Serif JP" },
      { op: "replace-font", role: "body", key: "zh-Hant", value: "Noto Serif TC" },
      { op: "replace-font", role: "code", key: "default", value: "JetBrains Mono" },
      { op: "replace-font", role: "code", key: "symbols", value: "Noto Sans Symbols 2" },
    ]);
    expect(
      fontPatchContract.examples.some(
        (example) =>
          (example.role === "heading" || example.role === "pageChrome") &&
          example.key !== "default",
      ),
    ).toBe(false);
    expect(facts.fontHints).toEqual([
      "use Source Serif 4 for English body, Noto Serif JP for Japanese, Noto Serif TC for Traditional Chinese, JetBrains Mono for code, Noto Sans Symbols 2 for symbols",
    ]);
  });

  test("builds title decision signal that blocks duplicate title treatment without cover intent", () => {
    const facts = promptFacts(
      buildMarkdownPdfProfileCodexPrompt({
        ...requestBase,
        documentSignals: {
          ...requestBase.documentSignals,
          title: {
            duplicateVisibleTitleRisk: true,
            firstH1: { charCount: 14, present: true },
            frontmatterTitle: { charCount: 14, present: true },
            normalizedTitleMatch: true,
          },
        },
        intent: "clean readable PDF",
      }),
    );

    expect(facts.titleDecisionSignal).toMatchObject({
      duplicateVisibleTitleRisk: true,
      explicitCoverIntent: false,
      explicitHideMetadataTitleIntent: false,
      explicitKeepMetadataTitleIntent: false,
      explicitNoCoverIntent: false,
      normalizedTitleMatch: true,
      recommendation:
        "Set titleBlock.metadataTitle to auto so the renderer suppresses duplicate metadata title output while preserving the Markdown H1.",
      profileBoundary: [
        "Do not rewrite Markdown.",
        "Do not mutate frontmatter.",
        "Use titleBlock.metadataTitle for supported metadata title-block behavior.",
        "Report unsupported title media, custom cover layout, or template-only behavior in warnings or unmatched_directions.",
      ],
      supportedPatch: "/titleBlock/metadataTitle",
    });
  });

  test("allows explicit cover intent but records duplicate H1 warning policy", () => {
    const facts = promptFacts(
      buildMarkdownPdfProfileCodexPrompt({
        ...requestBase,
        documentSignals: {
          ...requestBase.documentSignals,
          title: {
            duplicateVisibleTitleRisk: true,
            firstH1: { charCount: 14, present: true },
            frontmatterTitle: { charCount: 14, present: true },
            normalizedTitleMatch: true,
          },
        },
        intent: "clean pdf with a proper cover page",
      }),
    );

    expect(facts.titleDecisionSignal).toMatchObject({
      duplicateVisibleTitleRisk: true,
      explicitCoverIntent: true,
      explicitNoCoverIntent: false,
      recommendation:
        "Cover may be enabled because the user asked for it; use titleBlock.metadataTitle auto unless duplicate metadata title output is explicitly requested.",
    });
  });

  test("treats no-cover intent as stronger than cover wording", () => {
    const facts = promptFacts(
      buildMarkdownPdfProfileCodexPrompt({
        ...requestBase,
        documentSignals: {
          ...requestBase.documentSignals,
          title: {
            duplicateVisibleTitleRisk: true,
            firstH1: { charCount: 14, present: true },
            frontmatterTitle: { charCount: 14, present: true },
            normalizedTitleMatch: true,
          },
        },
        intent: "no cover page, keep the title in the document",
      }),
    );

    expect(facts.titleDecisionSignal).toMatchObject({
      explicitCoverIntent: false,
      explicitNoCoverIntent: true,
      recommendation: "Keep cover disabled and avoid extra title chrome.",
    });
  });

  test("builds title block contract for explicit keep and hide title-block intents", () => {
    const keepFacts = promptFacts(
      buildMarkdownPdfProfileCodexPrompt({
        ...requestBase,
        documentSignals: {
          ...requestBase.documentSignals,
          title: {
            duplicateVisibleTitleRisk: true,
            firstH1: { charCount: 14, present: true },
            frontmatterTitle: { charCount: 14, present: true },
            normalizedTitleMatch: true,
          },
        },
        intent: "keep the duplicate title output",
      }),
    );
    const hideFacts = promptFacts(
      buildMarkdownPdfProfileCodexPrompt({
        ...requestBase,
        intent: "hide metadata title output",
      }),
    );

    expect(keepFacts.titleBlockContract).toMatchObject({
      field: "titleBlock.metadataTitle",
      allowedValues: ["auto", "show", "hide"],
    });
    expect(keepFacts.titleDecisionSignal).toMatchObject({
      explicitKeepMetadataTitleIntent: true,
      recommendation:
        "Set titleBlock.metadataTitle to show when preserving metadata title output is the user's explicit request.",
    });
    expect(hideFacts.titleDecisionSignal).toMatchObject({
      explicitHideMetadataTitleIntent: true,
      recommendation:
        "Set titleBlock.metadataTitle to hide; do not rewrite Markdown or frontmatter.",
    });
  });

  test("derives strong table layout signal for wide table facts", () => {
    const facts = promptFacts(buildMarkdownPdfProfileCodexPrompt(requestBase));

    expect(facts.tableLayoutSignal).toMatchObject({
      level: "strong",
      recommendation:
        "Prefer wide-table or landscape/table-friendly profile settings unless intent explicitly requires portrait.",
      signalLadder: ["overflowRows", "maxLineWidth", "maxColumns", "scannedRows"],
      templateOnlyDirections: [
        "custom table column widths",
        "arbitrary table CSS",
        "rotated individual pages",
        "exact table beautification",
      ],
    });
    expect(JSON.stringify(facts.tableLayoutSignal)).toContain("high line width");
  });

  test("keeps narrow table facts as weak layout evidence", () => {
    const facts = promptFacts(
      buildMarkdownPdfProfileCodexPrompt({
        ...requestBase,
        documentSignals: {
          ...requestBase.documentSignals,
          tables: { maxColumns: 3, maxLineWidth: 48, overflowRows: 0, scannedRows: 3 },
        },
        intent: "clean professional PDF",
      }),
    );

    expect(facts.tableLayoutSignal).toMatchObject({
      level: "weak",
      recommendation:
        "Treat table presence as supporting evidence only; do not force landscape by itself.",
    });
    expect(JSON.stringify(facts.tableLayoutSignal)).not.toContain("high line width");
  });

  test("summarizes candidate traits for Codex style decisions", () => {
    const candidates = createMarkdownPdfProfileCandidates();
    const defaultCandidate = candidates.find((item) => item.summary.id === "default");
    const reportCandidate = candidates.find((item) => item.summary.id === "report");
    const wideCandidate = candidates.find((item) => item.summary.id === "wide-table");

    expect(defaultCandidate?.summary.traits).toMatchObject({
      codeHighlight: false,
      cover: false,
      density: "standard",
      lineNumbers: false,
      pageNumbers: false,
      toc: false,
    });
    expect(reportCandidate?.summary.traits.bestFor).toContain("formal reports");
    expect(wideCandidate?.summary.traits).toMatchObject({
      density: "wide",
      pageNumbers: false,
      toc: false,
    });
    expect(wideCandidate?.summary.traits.bestFor).toContain("wide tables");
  });

  test("uses a strict patch response schema without open nested objects", () => {
    expect(MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA.properties).toHaveProperty("accepted_patches");
    expect(MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA.properties).toHaveProperty(
      "accepted_font_patches",
    );
    expect(MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA.properties).not.toHaveProperty(
      "accepted_fields",
    );
    expect(MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA.additionalProperties).toBe(false);
    const schemaPropertyNames = Object.keys(
      MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA.properties,
    ) as MarkdownPdfCodexOutputSchemaKey[];
    expect(new Set(MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA.required)).toEqual(
      new Set(schemaPropertyNames),
    );
    expect(MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA.required).toContain("fallback_reason");
    expect(
      MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA.properties.accepted_patches.items,
    ).toMatchObject({
      additionalProperties: false,
      required: ["op", "path", "value"],
    });
    const patchSchema = MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA.properties.accepted_patches.items;
    expect(patchSchema.properties.path.enum).toContain("/toc/enabled");
    expect(patchSchema.properties.path.enum).not.toContain("/fonts/body/default");
    expect(patchSchema.properties.value.type).not.toContain("object");
    const fontPatchSchema =
      MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA.properties.accepted_font_patches.items;
    expect(fontPatchSchema).toMatchObject({
      additionalProperties: false,
      required: ["op", "role", "key", "value"],
    });
    expect(fontPatchSchema.properties.op.enum).toEqual(["replace-font"]);
    expect(fontPatchSchema.properties.role.enum).toEqual(["body", "heading", "code", "pageChrome"]);
    expect(MARKDOWN_PDF_CODEX_PATCH_VALUE_DOMAINS).toContainEqual({
      path: "/cover/style",
      values: ["plain", "report"],
    });
    expect(MARKDOWN_PDF_CODEX_PATCH_VALUE_DOMAINS).toContainEqual({
      path: "/pageNumbers/position",
      values: [
        "top-left",
        "top-center",
        "top-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ],
    });
    const expectedValueDomainPaths: MarkdownPdfCodexPatchValueDomainPath[] = [
      "/code/theme",
      "/cover/style",
      "/footer/style/fontWeight",
      "/footer/style/separator/style",
      "/header/style/fontWeight",
      "/header/style/separator/style",
      "/page/orientation",
      "/page/size",
      "/pageNumbers/countFrom",
      "/pageNumbers/position",
      "/pageNumbers/scope",
      "/titleBlock/metadataTitle",
      "/toc/pageBreak",
    ];
    expect(MARKDOWN_PDF_CODEX_PATCH_VALUE_DOMAINS.map((domain) => domain.path).sort()).toEqual(
      expectedValueDomainPaths.sort(),
    );
    const acceptedPatchPaths = new Set<string>(MARKDOWN_PDF_CODEX_PATCH_PATHS);
    for (const domain of MARKDOWN_PDF_CODEX_PATCH_VALUE_DOMAINS) {
      expect(acceptedPatchPaths.has(domain.path)).toBe(true);
    }
    const expectedConstraintPaths: MarkdownPdfCodexPatchValueConstraintPath[] = [
      "/footer/style/color",
      "/footer/style/fontSize",
      "/footer/style/lineHeight",
      "/footer/style/separator/color",
      "/footer/style/separator/gap",
      "/footer/style/separator/width",
      "/header/style/color",
      "/header/style/fontSize",
      "/header/style/lineHeight",
      "/header/style/separator/color",
      "/header/style/separator/gap",
      "/header/style/separator/width",
      "/pageNumbers/increment",
      "/pageNumbers/start",
    ];
    expect(MARKDOWN_PDF_CODEX_PATCH_VALUE_CONSTRAINTS.map(({ path }) => path).sort()).toEqual(
      expectedConstraintPaths.sort(),
    );
    for (const constraint of MARKDOWN_PDF_CODEX_PATCH_VALUE_CONSTRAINTS) {
      expect(acceptedPatchPaths.has(constraint.path)).toBe(true);
    }
    expect(acceptedPatchPaths.has("/pageNumbers/style")).toBe(false);
  });
});
