import { describe, expect, test } from "bun:test";

import {
  classifyMarkdownPdfCodexProfileFailure,
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
  supportedSchemaSummary: ["page.orientation", "toc.enabled", "fonts.body.default"],
  workingDirectory: "/repo",
};

describe("Markdown PDF Codex profile adapter", () => {
  test("builds a bounded prompt from summaries and signals", () => {
    const prompt = buildMarkdownPdfProfileCodexPrompt(requestBase);

    expect(prompt).toContain("Return JSON only");
    expect(prompt).toContain("wide table report");
    expect(prompt).toContain("candidateSummaries");
    expect(prompt).not.toContain("fullProfile");
  });

  test("parses and applies adapted profile fields with bounded merge semantics", async () => {
    const result = await suggestMarkdownPdfProfileWithCodex({
      ...requestBase,
      runner: async () =>
        JSON.stringify({
          decision_mode: "adapted",
          selected_candidate_id: "wide-table",
          accepted_fields: {
            toc: { enabled: true, depth: 2 },
            fonts: { body: { default: "Source Serif 4" } },
          },
          reasoning: "Wide table candidate matches the table facts.",
          warnings: [],
          unmatched_directions: [],
        }),
    });

    expect(result.decision.decisionMode).toBe("adapted");
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
          accepted_fields: {},
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
          reasoning: "No profile should be written.",
          warnings: [],
          unmatched_directions: ["unsupported custom CSS"],
        }),
    });

    expect(fallback.profile).toBeDefined();
    expect(fallback.decision.fallbackReason).toBe("No strong layout signals.");
    expect(noProfile.profile).toBeUndefined();
    expect(noProfile.decision.unmatchedDirections).toEqual(["unsupported custom CSS"]);
  });

  test("rejects unsupported accepted fields and unknown candidates", () => {
    expect(() =>
      parseMarkdownPdfCodexDecision(
        JSON.stringify({
          decision_mode: "adapted",
          selected_candidate_id: "default",
          accepted_fields: { profile: { id: "bad" } },
          reasoning: "bad",
          warnings: [],
          unmatched_directions: [],
        }),
      ),
    ).toThrow("accepted_fields.profile is not supported");
    expect(() =>
      parseMarkdownPdfCodexDecision(
        JSON.stringify({
          decision_mode: "adapted",
          selected_candidate_id: "default",
          accepted_fields: { page: { unsupported: "bad" } },
          reasoning: "bad",
          warnings: [],
          unmatched_directions: [],
        }),
      ),
    ).toThrow("profile.page.unsupported");
    expect(() =>
      parseMarkdownPdfCodexDecision(
        JSON.stringify({
          decision_mode: "adapted",
          selected_candidate_id: "default",
          accepted_fields: { fonts: { body: { fallback: "Bad Font" } } },
          reasoning: "bad",
          warnings: [],
          unmatched_directions: [],
        }),
      ),
    ).toThrow("profile.fonts.body.fallback");

    expect(() =>
      applyMarkdownPdfCodexDecision({
        candidates: requestBase.candidates,
        decision: {
          acceptedFields: {},
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
    ).toBe("structured-output-schema");
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
    ).rejects.toThrow();
    await expect(
      suggestMarkdownPdfProfileWithCodex({
        ...requestBase,
        runner: async () =>
          JSON.stringify({
            decision_mode: "adapted",
            selected_candidate_id: "default",
            accepted_fields: {},
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
            accepted_fields: {},
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
            decision_mode: "other",
            selected_candidate_id: "default",
            accepted_fields: {},
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
            decision_mode: "adapted",
            selected_candidate_id: "missing",
            accepted_fields: {},
            reasoning: "bad candidate",
            warnings: [],
            unmatched_directions: [],
          }),
      }),
    ).rejects.toThrow("selected unknown candidate");
  });
});
