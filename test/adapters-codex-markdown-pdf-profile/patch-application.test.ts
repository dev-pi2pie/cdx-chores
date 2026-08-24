import { describe, expect, test } from "bun:test";

import {
  MARKDOWN_PDF_CODEX_PATCH_VALUE_CONSTRAINTS,
  MARKDOWN_PDF_CODEX_PATCH_VALUE_DOMAINS,
  suggestMarkdownPdfProfileWithCodex,
} from "../../src/adapters/codex/markdown-pdf-profile";
import {
  applyMarkdownPdfCodexDecision,
  parseMarkdownPdfCodexDecision,
} from "../../src/adapters/codex/markdown-pdf-profile/decision";
import type { MarkdownPdfProfileCandidate } from "../../src/cli/markdown-pdf/profile/candidates";
import {
  createMarkdownPdfPageChromeCss,
  MARKDOWN_PDF_PAGE_CHROME_POSITIONS,
  normalizeMarkdownPdfProfile,
} from "../../src/cli/markdown-pdf/profile";
import { candidate, requestBase } from "./fixtures";

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

type MarkdownPdfCodexPatchValueDomainPath =
  (typeof MARKDOWN_PDF_CODEX_PATCH_VALUE_DOMAINS)[number]["path"];
type MarkdownPdfCodexPatchValueConstraintPath =
  (typeof MARKDOWN_PDF_CODEX_PATCH_VALUE_CONSTRAINTS)[number]["path"];

describe("Markdown PDF Codex profile adapter", () => {
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

  test("applies bounded counting and page-chrome style patches without mutating the candidate", () => {
    const baseCandidate = sparseCandidate({
      footer: { center: "Base footer" },
      pageNumbers: { enabled: false, scope: "body" },
    });
    const baseBefore = structuredClone(baseCandidate.fullProfile);
    const result = applyMarkdownPdfCodexDecision({
      candidates: [baseCandidate],
      decision: {
        acceptedPatches: [
          { op: "replace", path: "/pageNumbers/enabled", value: true },
          { op: "replace", path: "/pageNumbers/countFrom", value: "body" },
          { op: "replace", path: "/pageNumbers/start", value: 0 },
          { op: "replace", path: "/pageNumbers/increment", value: 2 },
          { op: "replace", path: "/header/style/fontSize", value: "8.5pt" },
          { op: "replace", path: "/header/style/fontWeight", value: 600 },
          { op: "replace", path: "/header/style/lineHeight", value: 1.2 },
          { op: "replace", path: "/header/style/color", value: "#123ABC" },
          { op: "replace", path: "/header/style/separator/width", value: "0.75pt" },
          { op: "replace", path: "/header/style/separator/style", value: "solid" },
          { op: "replace", path: "/header/style/separator/color", value: "#445566" },
          { op: "replace", path: "/header/style/separator/gap", value: 0 },
          { op: "replace", path: "/footer/style/fontSize", value: "10pt" },
          { op: "replace", path: "/footer/style/fontWeight", value: 700 },
          { op: "replace", path: "/footer/style/lineHeight", value: 1.5 },
          { op: "replace", path: "/footer/style/color", value: "#AABBCC" },
          { op: "replace", path: "/footer/style/separator/width", value: "1.5pt" },
          { op: "replace", path: "/footer/style/separator/style", value: "solid" },
          { op: "replace", path: "/footer/style/separator/color", value: "#112233" },
          { op: "replace", path: "/footer/style/separator/gap", value: "3.5mm" },
        ],
        acceptedFontPatches: [],
        decisionMode: "adapted",
        reasoning: "apply bounded page-number configuration",
        selectedCandidateId: "sparse",
        unmatchedDirections: [],
        warnings: [],
      },
    });

    expect(result.profile?.pageNumbers).toMatchObject({
      countFrom: "body",
      enabled: true,
      increment: 2,
      scope: "body",
      start: 0,
    });
    expect(result.profile?.header).toEqual({
      style: {
        color: "#123ABC",
        fontSize: "8.5pt",
        fontWeight: 600,
        lineHeight: 1.2,
        separator: { color: "#445566", gap: 0, style: "solid", width: "0.75pt" },
      },
    });
    expect(result.profile?.footer).toEqual({
      center: "Base footer",
      style: {
        color: "#AABBCC",
        fontSize: "10pt",
        fontWeight: 700,
        lineHeight: 1.5,
        separator: { color: "#112233", gap: "3.5mm", style: "solid", width: "1.5pt" },
      },
    });
    expect(result.profile?.pageNumbers).not.toHaveProperty("style");
    expect(baseCandidate.fullProfile).toEqual(baseBefore);

    const unstyledProfile = structuredClone(result.profile ?? {});
    delete (unstyledProfile.header as Record<string, unknown>).style;
    delete (unstyledProfile.footer as Record<string, unknown>).style;
    const styledCss = createMarkdownPdfPageChromeCss(
      normalizeMarkdownPdfProfile({ profile: result.profile }).profile,
    );
    const unstyledCss = createMarkdownPdfPageChromeCss(
      normalizeMarkdownPdfProfile({ profile: unstyledProfile }).profile,
    );
    expect(styledCss).not.toBe(unstyledCss);
    expect(styledCss).toContain("font-size: 10pt;");
    expect(styledCss).toContain("font-weight: 700;");
    expect(styledCss).toContain("line-height: 1.5;");
    expect(styledCss).toContain("color: #AABBCC;");
    expect(styledCss).toContain("border-top-width: 1.5pt;");
    expect(styledCss).toContain("border-top-style: solid;");
    expect(styledCss).toContain("border-top-color: #112233;");
    expect(styledCss).toContain("padding-top: 3.5mm;");
    expect(styledCss).not.toContain("#123ABC");
  });

  test("accepts exact page-chrome endpoints through Codex patch application", () => {
    for (const [fontSize, fontWeight, lineHeight, color, width, gap] of [
      ["6pt", 400, 1, "#000000", ".25pt", 0],
      ["12pt", 700, 2, "#ABCDEF", "2pt", "4mm"],
    ] as const) {
      const result = applyMarkdownPdfCodexDecision({
        candidates: [sparseCandidate()],
        decision: {
          acceptedPatches: [
            { op: "replace", path: "/header/style/fontSize", value: fontSize },
            { op: "replace", path: "/header/style/fontWeight", value: fontWeight },
            { op: "replace", path: "/header/style/lineHeight", value: lineHeight },
            { op: "replace", path: "/header/style/color", value: color },
            { op: "replace", path: "/header/style/separator/width", value: width },
            { op: "replace", path: "/header/style/separator/style", value: "solid" },
            { op: "replace", path: "/header/style/separator/color", value: color },
            { op: "replace", path: "/header/style/separator/gap", value: gap },
          ],
          acceptedFontPatches: [],
          decisionMode: "adapted",
          reasoning: "accept exact renderer-supported endpoints",
          selectedCandidateId: "sparse",
          unmatchedDirections: [],
          warnings: [],
        },
      });

      expect(result.profile?.header).toMatchObject({
        style: {
          color,
          fontSize,
          fontWeight,
          lineHeight,
          separator: { color, gap, style: "solid", width },
        },
      });
    }
  });

  test("accepts every valid page-number origin and placement while preserving false and zero", () => {
    const validOrigins = [
      { scope: "document", countFrom: "document" },
      { scope: "body", countFrom: "document" },
      { scope: "body", countFrom: "body" },
    ] as const;
    for (const [index, position] of MARKDOWN_PDF_PAGE_CHROME_POSITIONS.entries()) {
      const origin = validOrigins[index % validOrigins.length] ?? validOrigins[0];
      const result = applyMarkdownPdfCodexDecision({
        candidates: [sparseCandidate()],
        decision: {
          acceptedPatches: [
            { op: "replace", path: "/pageNumbers/enabled", value: false },
            { op: "replace", path: "/pageNumbers/scope", value: origin.scope },
            { op: "replace", path: "/pageNumbers/countFrom", value: origin.countFrom },
            { op: "replace", path: "/pageNumbers/start", value: 0 },
            { op: "replace", path: "/pageNumbers/increment", value: index + 1 },
            { op: "replace", path: "/pageNumbers/position", value: position },
            { op: "replace", path: "/pageNumbers/format", value: "Page {page} / {pages}" },
          ],
          acceptedFontPatches: [],
          decisionMode: "adapted",
          reasoning: "accept a valid durable page-number contract",
          selectedCandidateId: "sparse",
          unmatchedDirections: [],
          warnings: [],
        },
      });

      expect(result.profile?.pageNumbers).toEqual({
        enabled: false,
        scope: origin.scope,
        countFrom: origin.countFrom,
        start: 0,
        increment: index + 1,
        position,
        format: "Page {page} / {pages}",
      });
    }
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

  test("rejects invalid counting and page-chrome patch values before materialization", () => {
    const invalidPatches: Array<{
      message: string;
      path: MarkdownPdfCodexPatchValueConstraintPath;
      value: string | number;
    }> = [
      { path: "/pageNumbers/start", value: -1, message: "must be a non-negative integer" },
      { path: "/pageNumbers/increment", value: 0, message: "must be a positive integer" },
      { path: "/header/style/fontSize", value: "5.9pt", message: "must be a pt length" },
      { path: "/header/style/lineHeight", value: 2.1, message: "must be a number from 1" },
      { path: "/header/style/color", value: "red", message: "six-digit hexadecimal" },
      {
        path: "/header/style/separator/width",
        value: "0.24pt",
        message: "must be a pt length",
      },
      {
        path: "/footer/style/separator/color",
        value: "#123",
        message: "six-digit hexadecimal",
      },
      {
        path: "/footer/style/separator/gap",
        value: "4.1mm",
        message: "must be 0 or an mm length",
      },
    ];

    for (const invalid of invalidPatches) {
      expect(() =>
        applyMarkdownPdfCodexDecision({
          candidates: [sparseCandidate()],
          decision: {
            acceptedPatches: [{ op: "replace", path: invalid.path, value: invalid.value }],
            acceptedFontPatches: [],
            decisionMode: "adapted",
            reasoning: "reject invalid bounded value",
            selectedCandidateId: "sparse",
            unmatchedDirections: [],
            warnings: [],
          },
        }),
      ).toThrow(invalid.message);
    }

    expect(() =>
      applyMarkdownPdfCodexDecision({
        candidates: [sparseCandidate()],
        decision: {
          acceptedPatches: [
            { op: "replace", path: "/pageNumbers/scope", value: "document" },
            { op: "replace", path: "/pageNumbers/countFrom", value: "body" },
          ],
          acceptedFontPatches: [],
          decisionMode: "adapted",
          reasoning: "reject invalid counting combination",
          selectedCandidateId: "sparse",
          unmatchedDirections: [],
          warnings: [],
        },
      }),
    ).toThrow("scope document cannot be used with countFrom body");

    expect(() =>
      parseMarkdownPdfCodexDecision(
        JSON.stringify({
          decision_mode: "adapted",
          selected_candidate_id: "default",
          accepted_patches: [{ op: "replace", path: "/pageNumbers/style", value: "compact" }],
          accepted_font_patches: [],
          reasoning: "unsupported style owner",
          warnings: [],
          fallback_reason: "",
          unmatched_directions: [],
        }),
      ),
    ).toThrow("accepted_patches[0].path must be one of");
  });
});
