import { describe, expect, mock, test } from "bun:test";

import {
  classifyMarkdownPdfCodexProfileFailure,
  MARKDOWN_PDF_CODEX_PATCH_VALUE_DOMAINS,
  MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA,
  MarkdownPdfCodexProfileError,
  suggestMarkdownPdfProfileWithCodex,
} from "../src/adapters/codex/markdown-pdf-profile";
import {
  applyMarkdownPdfCodexDecision,
  parseMarkdownPdfCodexDecision,
} from "../src/adapters/codex/markdown-pdf-profile/decision";
import { buildMarkdownPdfProfileCodexPrompt } from "../src/adapters/codex/markdown-pdf-profile/prompt";
import {
  createMarkdownPdfProfileCandidates,
  type MarkdownPdfProfileCandidate,
} from "../src/cli/markdown-pdf/profile/candidates";

function candidate(id: string): MarkdownPdfProfileCandidate {
  const found = createMarkdownPdfProfileCandidates().find((item) => item.summary.id === id);
  if (!found) {
    throw new Error(`missing candidate ${id}`);
  }
  return found;
}

const requestBase = {
  candidates: [candidate("default"), candidate("wide-table")],
  documentSignals: {
    assets: { dataUriCount: 0, localCount: 1, remoteCount: 0 },
    codeFences: { languages: ["ts"], overflowLanguageCount: 0, unlabeledCount: 0 },
    frontmatter: { metadataKeys: ["title"], pdfContentLangs: [], lang: "en" },
    headings: { byDepth: { "1": 1 }, maxDepth: 1, total: 1 },
    scripts: { buckets: { latin: 20 }, scannedChars: 20, truncated: false },
    tables: { maxColumns: 6, maxLineWidth: 120, overflowRows: 0, scannedRows: 4 },
  },
  fontHints: ["prefer system serif"],
  fontSignals: { families: [], overflowFamilyCount: 0 },
  intent: "wide table report",
  selectedBaseProfileSummary: {
    basedOn: "wide-table",
    fields: ["page", "toc"],
    id: "wide-table",
    kind: "preset" as const,
    label: "wide-table preset profile",
    preset: "wide-table" as const,
    presetBacked: true,
  },
  supportedSchemaSummary: ["page.orientation", "toc.enabled", "fonts.body.default"],
  workingDirectory: "/repo",
};

describe("Markdown PDF Codex profile adapter", () => {
  test("builds a bounded prompt from summaries and signals", () => {
    const prompt = buildMarkdownPdfProfileCodexPrompt(requestBase);

    expect(prompt).toContain("Return JSON only");
    expect(prompt).toContain("wide table report");
    expect(prompt).toContain("candidateSummaries");
    expect(prompt).toContain("selectedBaseProfileSummary");
    expect(prompt).toContain("patchValueDomains");
    expect(prompt).toContain("/cover/style");
    expect(prompt).toContain("plain");
    expect(prompt).toContain("/pageNumbers/position");
    expect(prompt).toContain("bottom-center");
    expect(prompt).toContain("supportedSchemaSummary");
    expect(prompt).toContain("fonts.body.default");
    expect(prompt).toContain("Always include fallback_reason");
    expect(prompt).not.toContain("fullProfile");
  });

  test("uses a strict patch response schema without open nested objects", () => {
    expect(MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA.properties).toHaveProperty("accepted_patches");
    expect(MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA.properties).not.toHaveProperty(
      "accepted_fields",
    );
    expect(MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA.additionalProperties).toBe(false);
    expect(new Set(MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA.required)).toEqual(
      new Set(Object.keys(MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA.properties)),
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
    expect(patchSchema.properties.value.type).not.toContain("object");
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
  });

  test("starts the default Codex runner in the request working directory", async () => {
    let capturedThreadOptions: unknown;

    mock.module("@openai/codex-sdk", () => ({
      Codex: class {
        startThread(options: unknown) {
          capturedThreadOptions = options;
          return {
            run: async () => ({
              finalResponse: JSON.stringify({
                decision_mode: "adapted",
                selected_candidate_id: "wide-table",
                accepted_patches: [],
                reasoning: "Wide table candidate matches the table facts.",
                warnings: [],
                fallback_reason: "",
                unmatched_directions: [],
              }),
            }),
          };
        }
      },
    }));

    await suggestMarkdownPdfProfileWithCodex(requestBase);

    expect(capturedThreadOptions).toEqual({
      approvalPolicy: "never",
      modelReasoningEffort: "low",
      networkAccessEnabled: true,
      sandboxMode: "read-only",
      webSearchMode: "disabled",
      workingDirectory: "/repo",
    });
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
            { op: "replace", path: "/fonts/body/default", value: "Source Serif 4" },
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

  test("supports conservative fallback and no usable profile decision modes", async () => {
    const fallback = await suggestMarkdownPdfProfileWithCodex({
      ...requestBase,
      runner: async () =>
        JSON.stringify({
          decision_mode: "conservative-fallback",
          selected_candidate_id: "default",
          accepted_patches: [],
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
          decisionMode: "adapted",
          reasoning: "bad",
          selectedCandidateId: "wide-table",
          unmatchedDirections: [],
          warnings: [],
        },
      }),
    ).toThrow("profile.toc.depth");
    expect(() =>
      applyMarkdownPdfCodexDecision({
        candidates: requestBase.candidates,
        decision: {
          acceptedPatches: [{ op: "replace", path: "/cover/style", value: "modern" }],
          decisionMode: "adapted",
          reasoning: "bad",
          selectedCandidateId: "wide-table",
          unmatchedDirections: [],
          warnings: [],
        },
      }),
    ).toThrow("accepted_patches[0].value for /cover/style must be one of: plain, report");
    expect(() =>
      applyMarkdownPdfCodexDecision({
        candidates: requestBase.candidates,
        decision: {
          acceptedPatches: [{ op: "replace", path: "/pageNumbers/position", value: "bottom" }],
          decisionMode: "adapted",
          reasoning: "bad",
          selectedCandidateId: "wide-table",
          unmatchedDirections: [],
          warnings: [],
        },
      }),
    ).toThrow(
      "accepted_patches[0].value for /pageNumbers/position must be one of: top-left, top-center, top-right, bottom-left, bottom-center, bottom-right",
    );
    expect(() =>
      applyMarkdownPdfCodexDecision({
        candidates: requestBase.candidates,
        decision: {
          acceptedPatches: [{ op: "replace", path: "/pdf/content-langs", value: ["en"] }],
          decisionMode: "adapted",
          reasoning: "bad",
          selectedCandidateId: "default",
          unmatchedDirections: [],
          warnings: [],
        },
      }),
    ).toThrow("path cannot replace nested value");

    expect(() =>
      applyMarkdownPdfCodexDecision({
        candidates: requestBase.candidates,
        decision: {
          acceptedPatches: [],
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
            reasoning: "bad candidate",
            warnings: [],
            unmatched_directions: [],
          }),
      }),
    ).rejects.toMatchObject({ kind: "invalid-application" });
  });
});
