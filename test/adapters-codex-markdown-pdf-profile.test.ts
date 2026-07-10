import { afterEach, describe, expect, mock, test } from "bun:test";

import {
  classifyMarkdownPdfCodexProfileFailure,
  MARKDOWN_PDF_CODEX_PATCH_VALUE_DOMAINS,
  MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA,
  MARKDOWN_PDF_CODEX_PROFILE_TIMEOUT_MS,
  MarkdownPdfCodexProfileError,
  suggestMarkdownPdfProfileWithCodex,
} from "../src/adapters/codex/markdown-pdf-profile";
import {
  applyMarkdownPdfCodexDecision,
  parseMarkdownPdfCodexDecision,
} from "../src/adapters/codex/markdown-pdf-profile/decision";
import { buildMarkdownPdfProfileCodexPrompt } from "../src/adapters/codex/markdown-pdf-profile/prompt";
import {
  MARKDOWN_PDF_CODEX_PATCH_PATHS,
  type MarkdownPdfCodexProfileFontPatch,
  type MarkdownPdfCodexProfileRequest,
} from "../src/adapters/codex/markdown-pdf-profile/types";
import {
  createMarkdownPdfProfileCandidates,
  type MarkdownPdfProfileCandidate,
} from "../src/cli/markdown-pdf/profile/candidates";

afterEach(() => {
  mock.restore();
});

function candidate(id: string): MarkdownPdfProfileCandidate {
  const found = createMarkdownPdfProfileCandidates().find((item) => item.summary.id === id);
  if (!found) {
    throw new Error(`missing candidate ${id}`);
  }
  return found;
}

function sparseCandidate(fullProfile: Record<string, unknown> = {}): MarkdownPdfProfileCandidate {
  const base = candidate("default");
  return {
    ...base,
    summary: {
      ...base.summary,
      id: "sparse",
      fields: Object.keys(fullProfile).sort(),
    },
    fullProfile,
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

const requestBase: MarkdownPdfCodexProfileRequest = {
  candidates: [candidate("default"), candidate("wide-table")],
  documentSignals: {
    available: true,
    assets: { dataUriCount: 0, localCount: 1, remoteCount: 0 },
    codeFences: { languages: ["ts"], overflowLanguageCount: 0, unlabeledCount: 0 },
    frontmatter: { metadataKeys: ["title"], pdfContentLangs: [], lang: "en" },
    headings: { byDepth: { "1": 1 }, maxDepth: 1, total: 1 },
    scripts: { buckets: { latin: 20 }, scannedChars: 20, truncated: false },
    tables: { maxColumns: 6, maxLineWidth: 120, overflowRows: 0, scannedRows: 4 },
    title: {
      duplicateVisibleTitleRisk: false,
      firstH1: { charCount: 6, present: true },
      frontmatterTitle: { charCount: 0, present: false },
      normalizedTitleMatch: false,
    },
  },
  fontHints: ["prefer system serif"],
  fontSignals: { families: [], overflowFamilyCount: 0 },
  intent: "wide table report",
  selectedBaseProfileSummary: candidate("wide-table").summary,
  signalMode: "mixed-with-base",
  supportedSchemaSummary: ["page.orientation", "toc.enabled", "fonts.body.default"],
  workingDirectory: "/repo",
};

type MarkdownPdfCodexOutputSchemaKey =
  (typeof MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA.required)[number];
type MarkdownPdfCodexPatchValueDomainPath =
  (typeof MARKDOWN_PDF_CODEX_PATCH_VALUE_DOMAINS)[number]["path"];

describe("Markdown PDF Codex profile adapter", () => {
  test("builds a bounded prompt from summaries and signals", () => {
    const prompt = buildMarkdownPdfProfileCodexPrompt(requestBase);

    expect(prompt).toContain("Return JSON only");
    expect(prompt).toContain("wide table report");
    expect(prompt).toContain("candidateSummaries");
    expect(prompt).toContain("selectedBaseProfileSummary");
    expect(prompt).toContain("patchValueDomains");
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
      "/page/orientation",
      "/page/size",
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
                finalResponse: JSON.stringify({
                  decision_mode: "adapted",
                  selected_candidate_id: "wide-table",
                  accepted_patches: [],
                  accepted_font_patches: [],
                  reasoning: "Wide table candidate matches the table facts.",
                  warnings: [],
                  fallback_reason: "",
                  unmatched_directions: [],
                }),
              };
            },
          };
        }
      },
    }));

    let result: Awaited<ReturnType<typeof suggestMarkdownPdfProfileWithCodex>>;
    try {
      result = await suggestMarkdownPdfProfileWithCodex(requestBase);
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
    expect(runOptions.outputSchema).toBe(MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA);
    expect(runOptions.signal).toBeInstanceOf(AbortSignal);
    expect(timeoutCalls).toEqual([MARKDOWN_PDF_CODEX_PROFILE_TIMEOUT_MS]);
  });

  test("passes the request working directory to explicit profile runners", async () => {
    let capturedWorkingDirectory = "";

    await suggestMarkdownPdfProfileWithCodex({
      ...requestBase,
      runner: async (options) => {
        capturedWorkingDirectory = options.workingDirectory;
        return JSON.stringify({
          decision_mode: "adapted",
          selected_candidate_id: "wide-table",
          accepted_patches: [],
          accepted_font_patches: [],
          reasoning: "Wide table candidate matches the table facts.",
          warnings: [],
          fallback_reason: "",
          unmatched_directions: [],
        });
      },
    });

    expect(capturedWorkingDirectory).toBe("/repo");
  });

  test("parses and applies adapted profile fields with bounded merge semantics", async () => {
    const result = await suggestMarkdownPdfProfileWithCodex({
      ...requestBase,
      runner: async () =>
        JSON.stringify({
          decision_mode: "adapted",
          selected_candidate_id: "wide-table",
          accepted_patches: [
            { op: "replace", path: "/toc/enabled", value: true },
            { op: "replace", path: "/toc/depth", value: 2 },
          ],
          accepted_font_patches: [
            { op: "replace-font", role: "body", key: "default", value: "Source Serif 4" },
          ],
          reasoning: "Wide table candidate matches the table facts.",
          warnings: [],
          fallback_reason: "",
          unmatched_directions: [],
        }),
    });

    expect(result.decision.decisionMode).toBe("adapted");
    expect(result.decision.fallbackReason).toBeUndefined();
    expect(result.profile?.toc).toEqual({ enabled: true, depth: 2, pageBreak: "auto" });
    expect(result.profile?.page).toMatchObject({
      orientation: "landscape",
      marginTop: "12mm",
    });
    expect(result.profile?.fonts).toMatchObject({
      body: { default: "Source Serif 4" },
      code: { default: "monospace" },
    });
    expect(result.profile?.cover).toEqual({
      enabled: false,
    });
    expect(result.profile?.page).toEqual({
      orientation: "landscape",
      marginBottom: "12mm",
      marginLeft: "12mm",
      marginRight: "12mm",
      marginTop: "12mm",
      size: "A4",
    });
  });

  test("parses accepted font patches and rejects malformed font patch responses", () => {
    const decision = parseMarkdownPdfCodexDecision(
      JSON.stringify({
        decision_mode: "adapted",
        selected_candidate_id: "default",
        accepted_patches: [],
        accepted_font_patches: [
          { op: "replace-font", role: "body", key: "ja", value: "Noto Serif JP" },
        ],
        reasoning: "Japanese body text was detected.",
        warnings: [],
        fallback_reason: "",
        unmatched_directions: [],
      }),
    );

    expect(decision.acceptedFontPatches).toEqual([
      { op: "replace-font", role: "body", key: "ja", value: "Noto Serif JP" },
    ]);
    expect(() =>
      parseMarkdownPdfCodexDecision(
        JSON.stringify({
          decision_mode: "adapted",
          selected_candidate_id: "default",
          accepted_patches: [],
          reasoning: "missing font patch array",
          warnings: [],
          fallback_reason: "",
          unmatched_directions: [],
        }),
      ),
    ).toThrow("accepted_font_patches must be an array");
    expect(() =>
      parseMarkdownPdfCodexDecision(
        JSON.stringify({
          decision_mode: "adapted",
          selected_candidate_id: "default",
          accepted_patches: [],
          accepted_font_patches: [
            { op: "replace", role: "body", key: "ja", value: "Noto Serif JP" },
          ],
          reasoning: "bad op",
          warnings: [],
          fallback_reason: "",
          unmatched_directions: [],
        }),
      ),
    ).toThrow("accepted_font_patches[0].op must be replace-font");
    expect(() =>
      parseMarkdownPdfCodexDecision(
        JSON.stringify({
          decision_mode: "adapted",
          selected_candidate_id: "default",
          accepted_patches: [],
          accepted_font_patches: [
            { op: "replace-font", role: "caption", key: "default", value: "Inter" },
          ],
          reasoning: "bad role",
          warnings: [],
          fallback_reason: "",
          unmatched_directions: [],
        }),
      ),
    ).toThrow("accepted_font_patches[0].role must be one of");
    expect(() =>
      parseMarkdownPdfCodexDecision(
        JSON.stringify({
          decision_mode: "no-usable-profile",
          selected_candidate_id: "none",
          accepted_patches: [],
          accepted_font_patches: [
            { op: "replace-font", role: "body", key: "ja", value: "Noto Serif JP" },
          ],
          reasoning: "No profile should be written.",
          warnings: [],
          fallback_reason: "",
          unmatched_directions: [],
        }),
      ),
    ).toThrow("accepted_font_patches must be empty for no-usable-profile");
  });

  test("applies dedicated font patches with bounded role and key validation", () => {
    const result = applyMarkdownPdfCodexDecision({
      candidates: [sparseCandidate()],
      decision: {
        acceptedPatches: [],
        acceptedFontPatches: [
          { op: "replace-font", role: "body", key: "default", value: "Source Serif 4" },
          { op: "replace-font", role: "body", key: "ja", value: "Noto Serif JP" },
          { op: "replace-font", role: "code", key: "default", value: "JetBrains Mono" },
          { op: "replace-font", role: "code", key: "symbols", value: "Noto Sans Symbols 2" },
          { op: "replace-font", role: "heading", key: "default", value: "Inter" },
          { op: "replace-font", role: "pageChrome", key: "default", value: "Inter" },
        ],
        decisionMode: "adapted",
        reasoning: "apply font patches",
        selectedCandidateId: "sparse",
        unmatchedDirections: [],
        warnings: [],
      },
    });

    expect(result.profile?.fonts).toEqual({
      body: { default: "Source Serif 4", ja: "Noto Serif JP" },
      code: { default: "JetBrains Mono", symbols: "Noto Sans Symbols 2" },
      heading: { default: "Inter" },
      pageChrome: { default: "Inter" },
    });
  });

  test("rejects invalid dedicated font patch keys and non-object font parents", () => {
    for (const fontPatch of [
      { op: "replace-font" as const, role: "body" as const, key: "bad_key", value: "Inter" },
      { op: "replace-font" as const, role: "code" as const, key: "ja", value: "Inter" },
      { op: "replace-font" as const, role: "heading" as const, key: "ja", value: "Inter" },
      { op: "replace-font" as const, role: "pageChrome" as const, key: "ja", value: "Inter" },
    ]) {
      expect(() =>
        applyMarkdownPdfCodexDecision({
          candidates: [sparseCandidate()],
          decision: {
            acceptedPatches: [],
            acceptedFontPatches: [fontPatch],
            decisionMode: "adapted",
            reasoning: "bad font patch",
            selectedCandidateId: "sparse",
            unmatchedDirections: [],
            warnings: [],
          },
        }),
      ).toThrow("accepted_font_patches[0].key");
    }
    for (const fullProfile of [
      { fonts: [] },
      { fonts: "bad" },
      { fonts: { body: [] } },
      { fonts: { body: "bad" } },
    ]) {
      expect(() =>
        applyMarkdownPdfCodexDecision({
          candidates: [sparseCandidate(fullProfile)],
          decision: {
            acceptedPatches: [],
            acceptedFontPatches: [
              { op: "replace-font", role: "body", key: "default", value: "Inter" },
            ],
            decisionMode: "adapted",
            reasoning: "bad font parent",
            selectedCandidateId: "sparse",
            unmatchedDirections: [],
            warnings: [],
          },
        }),
      ).toThrow("accepted_font_patches cannot replace font value through non-object");
    }
  });

  test("materializes fixed nested profile containers for accepted patches", () => {
    const result = applyMarkdownPdfCodexDecision({
      candidates: [sparseCandidate()],
      decision: {
        acceptedPatches: [
          { op: "replace", path: "/toc/enabled", value: true },
          { op: "replace", path: "/toc/depth", value: 2 },
          { op: "replace", path: "/toc/pageBreak", value: "before" },
          { op: "replace", path: "/pdf/content-langs", value: ["en", "ja"] },
          { op: "replace", path: "/cover/enabled", value: true },
          { op: "replace", path: "/cover/fields/title", value: "README Guide" },
          { op: "replace", path: "/header/left", value: "{title}" },
          { op: "replace", path: "/footer/right", value: "{page}" },
          { op: "replace", path: "/pageNumbers/enabled", value: true },
          { op: "replace", path: "/pageNumbers/position", value: "bottom-right" },
          { op: "replace", path: "/titleBlock/metadataTitle", value: "auto" },
          { op: "replace", path: "/code/highlight", value: true },
          { op: "replace", path: "/code/lineNumbers", value: true },
        ],
        acceptedFontPatches: [],
        decisionMode: "adapted",
        reasoning: "materialize fixed profile containers",
        selectedCandidateId: "sparse",
        unmatchedDirections: [],
        warnings: [],
      },
    });

    expect(result.profile).toMatchObject({
      toc: { enabled: true, depth: 2, pageBreak: "before" },
      pdf: { "content-langs": ["en", "ja"] },
      cover: { enabled: true, fields: { title: "README Guide" } },
      header: { left: "{title}" },
      footer: { right: "{page}" },
      pageNumbers: { enabled: true, position: "bottom-right" },
      titleBlock: { metadataTitle: "auto" },
      code: { highlight: true, lineNumbers: true },
    });
  });

  test("supports conservative fallback and no usable profile decision modes", async () => {
    const fallback = await suggestMarkdownPdfProfileWithCodex({
      ...requestBase,
      runner: async () =>
        JSON.stringify({
          decision_mode: "conservative-fallback",
          selected_candidate_id: "default",
          accepted_patches: [],
          accepted_font_patches: [],
          reasoning: "Facts are weak.",
          warnings: ["Using default profile."],
          fallback_reason: "No strong layout signals.",
          unmatched_directions: [],
        }),
    });
    const noProfile = await suggestMarkdownPdfProfileWithCodex({
      ...requestBase,
      runner: async () =>
        JSON.stringify({
          decision_mode: "no-usable-profile",
          selected_candidate_id: "none",
          accepted_patches: [],
          accepted_font_patches: [],
          reasoning: "No profile should be written.",
          warnings: [],
          fallback_reason: " ",
          unmatched_directions: ["unsupported custom CSS"],
        }),
    });

    expect(fallback.profile).toBeDefined();
    expect(fallback.decision.fallbackReason).toBe("No strong layout signals.");
    expect(noProfile.profile).toBeUndefined();
    expect(noProfile.decision.fallbackReason).toBeUndefined();
    expect(noProfile.decision.unmatchedDirections).toEqual(["unsupported custom CSS"]);
  });

  test("rejects unsupported accepted patches and unknown candidates", () => {
    expect(() =>
      parseMarkdownPdfCodexDecision(
        JSON.stringify({
          decision_mode: "adapted",
          selected_candidate_id: "default",
          accepted_patches: [{ op: "replace", path: "/profile/id", value: "bad" }],
          accepted_font_patches: [],
          reasoning: "bad",
          warnings: [],
          unmatched_directions: [],
        }),
      ),
    ).toThrow("accepted_patches[0].path must be one of");
    expect(() =>
      parseMarkdownPdfCodexDecision(
        JSON.stringify({
          decision_mode: "adapted",
          selected_candidate_id: "default",
          accepted_patches: [{ op: "replace", path: "/page/unsupported", value: "bad" }],
          accepted_font_patches: [],
          reasoning: "bad",
          warnings: [],
          unmatched_directions: [],
        }),
      ),
    ).toThrow("accepted_patches[0].path must be one of");
    expect(() =>
      applyMarkdownPdfCodexDecision({
        candidates: requestBase.candidates,
        decision: {
          acceptedPatches: [{ op: "replace", path: "/toc/depth", value: "not-a-number" }],
          acceptedFontPatches: [],
          decisionMode: "adapted",
          reasoning: "bad",
          selectedCandidateId: "wide-table",
          unmatchedDirections: [],
          warnings: [],
        },
      }),
    ).toThrow("profile.toc.depth");
    for (const domain of MARKDOWN_PDF_CODEX_PATCH_VALUE_DOMAINS) {
      expect(() =>
        applyMarkdownPdfCodexDecision({
          candidates: requestBase.candidates,
          decision: {
            acceptedPatches: [{ op: "replace", path: domain.path, value: "__invalid__" }],
            acceptedFontPatches: [],
            decisionMode: "adapted",
            reasoning: "bad",
            selectedCandidateId: "wide-table",
            unmatchedDirections: [],
            warnings: [],
          },
        }),
      ).toThrow(
        `accepted_patches[0].value for ${domain.path} must be one of: ${domain.values.join(", ")}`,
      );
    }
    for (const value of [true, 1, ["plain"]]) {
      expect(() =>
        applyMarkdownPdfCodexDecision({
          candidates: requestBase.candidates,
          decision: {
            acceptedPatches: [{ op: "replace", path: "/cover/style", value }],
            acceptedFontPatches: [],
            decisionMode: "adapted",
            reasoning: "bad",
            selectedCandidateId: "wide-table",
            unmatchedDirections: [],
            warnings: [],
          },
        }),
      ).toThrow("accepted_patches[0].value for /cover/style must be one of: plain, report");
    }
    expect(() =>
      parseMarkdownPdfCodexDecision(
        JSON.stringify({
          decision_mode: "adapted",
          selected_candidate_id: "default",
          accepted_patches: [{ op: "replace", path: "/cover/enabled", value: null }],
          accepted_font_patches: [],
          reasoning: "bad",
          warnings: [],
          unmatched_directions: [],
        }),
      ),
    ).toThrow("accepted_patches[0].value must be a string, number, boolean, or string array");
    expect(() =>
      parseMarkdownPdfCodexDecision(
        JSON.stringify({
          decision_mode: "adapted",
          selected_candidate_id: "default",
          accepted_patches: [{ op: "remove", path: "/cover/enabled", value: true }],
          accepted_font_patches: [],
          reasoning: "bad",
          warnings: [],
          unmatched_directions: [],
        }),
      ),
    ).toThrow("accepted_patches[0].op must be replace");
    expect(() =>
      applyMarkdownPdfCodexDecision({
        candidates: [sparseCandidate({ cover: [] })],
        decision: {
          acceptedPatches: [{ op: "replace", path: "/cover/fields/title", value: "bad" }],
          acceptedFontPatches: [],
          decisionMode: "adapted",
          reasoning: "bad",
          selectedCandidateId: "sparse",
          unmatchedDirections: [],
          warnings: [],
        },
      }),
    ).toThrow("path cannot replace nested value");
    expect(() =>
      applyMarkdownPdfCodexDecision({
        candidates: [sparseCandidate({ pdf: "bad" })],
        decision: {
          acceptedPatches: [{ op: "replace", path: "/pdf/content-langs", value: ["en"] }],
          acceptedFontPatches: [],
          decisionMode: "adapted",
          reasoning: "bad",
          selectedCandidateId: "sparse",
          unmatchedDirections: [],
          warnings: [],
        },
      }),
    ).toThrow("path cannot replace nested value");
    expect(() =>
      parseMarkdownPdfCodexDecision(
        JSON.stringify({
          decision_mode: "adapted",
          selected_candidate_id: "default",
          accepted_patches: [{ op: "replace", path: "/fonts/body/default", value: "serif" }],
          accepted_font_patches: [],
          reasoning: "bad",
          warnings: [],
          fallback_reason: "",
          unmatched_directions: [],
        }),
      ),
    ).toThrow("accepted_patches[0].path must be one of");

    expect(() =>
      applyMarkdownPdfCodexDecision({
        candidates: requestBase.candidates,
        decision: {
          acceptedPatches: [],
          acceptedFontPatches: [],
          decisionMode: "adapted",
          reasoning: "bad",
          selectedCandidateId: "missing",
          unmatchedDirections: [],
          warnings: [],
        },
      }),
    ).toThrow("selected unknown candidate");
  });

  test("classifies Codex unavailable and structured-output failures", () => {
    expect(classifyMarkdownPdfCodexProfileFailure(new Error("network unavailable"))).toBe(
      "unavailable",
    );
    expect(
      classifyMarkdownPdfCodexProfileFailure(new Error("invalid_json_schema response_format")),
    ).toBe("unavailable");
    expect(
      classifyMarkdownPdfCodexProfileFailure(
        new MarkdownPdfCodexProfileError("bad", "structured-output-schema"),
      ),
    ).toBe("structured-output-schema");
    expect(
      classifyMarkdownPdfCodexProfileFailure(
        new MarkdownPdfCodexProfileError("bad", "malformed-output"),
      ),
    ).toBe("malformed-output");
    expect(
      classifyMarkdownPdfCodexProfileFailure(
        new MarkdownPdfCodexProfileError("bad", "invalid-application"),
      ),
    ).toBe("invalid-application");
    expect(classifyMarkdownPdfCodexProfileFailure(new Error('{"unrelated":true}'))).toBe(
      "unavailable",
    );
  });

  test("fails closed for malformed structured output through the exported adapter", async () => {
    await expect(
      suggestMarkdownPdfProfileWithCodex({
        ...requestBase,
        runner: async () => "not json",
      }),
    ).rejects.toMatchObject({ kind: "malformed-output" });
    await expect(
      suggestMarkdownPdfProfileWithCodex({
        ...requestBase,
        runner: async () => {
          throw new Error("invalid_json_schema response_format");
        },
      }),
    ).rejects.toMatchObject({
      kind: "structured-output-schema",
      name: "MarkdownPdfCodexProfileError",
    });
    await expect(
      suggestMarkdownPdfProfileWithCodex({
        ...requestBase,
        runner: async () =>
          JSON.stringify({
            decision_mode: "adapted",
            selected_candidate_id: "default",
            accepted_patches: [],
            accepted_font_patches: [],
            reasoning: "missing arrays",
          }),
      }),
    ).rejects.toThrow("must be an array");
    await expect(
      suggestMarkdownPdfProfileWithCodex({
        ...requestBase,
        runner: async () =>
          JSON.stringify({
            decision_mode: "adapted",
            selected_candidate_id: "default",
            accepted_patches: [],
            accepted_font_patches: [],
            reasoning: "bad warnings",
            warnings: "nope",
            unmatched_directions: [],
          }),
      }),
    ).rejects.toThrow("warnings must be an array");
    await expect(
      suggestMarkdownPdfProfileWithCodex({
        ...requestBase,
        runner: async () =>
          JSON.stringify({
            decision_mode: "adapted",
            selected_candidate_id: "default",
            accepted_patches: [],
            accepted_font_patches: [],
            reasoning: "blank warning",
            warnings: [" "],
            unmatched_directions: [],
          }),
      }),
    ).rejects.toThrow("warnings[0] must not be empty");
    await expect(
      suggestMarkdownPdfProfileWithCodex({
        ...requestBase,
        runner: async () =>
          JSON.stringify({
            decision_mode: "other",
            selected_candidate_id: "default",
            accepted_patches: [],
            accepted_font_patches: [],
            reasoning: "bad mode",
            warnings: [],
            unmatched_directions: [],
          }),
      }),
    ).rejects.toThrow("decision_mode must be one of");
    await expect(
      suggestMarkdownPdfProfileWithCodex({
        ...requestBase,
        runner: async () =>
          JSON.stringify({
            decision_mode: "no-usable-profile",
            reasoning: "No profile should be written.",
            warnings: [],
            unmatched_directions: [],
          }),
      }),
    ).rejects.toThrow("selected_candidate_id must be a non-empty string");
    await expect(
      suggestMarkdownPdfProfileWithCodex({
        ...requestBase,
        runner: async () =>
          JSON.stringify({
            decision_mode: "no-usable-profile",
            selected_candidate_id: "none",
            accepted_patches: [{ op: "replace", path: "/toc/enabled", value: true }],
            accepted_font_patches: [],
            reasoning: "No profile should be written.",
            warnings: [],
            unmatched_directions: [],
          }),
      }),
    ).rejects.toThrow("accepted_patches must be empty for no-usable-profile");
    await expect(
      suggestMarkdownPdfProfileWithCodex({
        ...requestBase,
        runner: async () =>
          JSON.stringify({
            decision_mode: "adapted",
            selected_candidate_id: "missing",
            accepted_patches: [],
            accepted_font_patches: [],
            reasoning: "bad candidate",
            warnings: [],
            unmatched_directions: [],
          }),
      }),
    ).rejects.toMatchObject({ kind: "invalid-application" });
  });
});
