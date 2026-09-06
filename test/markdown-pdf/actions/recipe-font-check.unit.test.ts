import { describe, expect, test } from "bun:test";
import { normalizeMarkdownPdfProfile } from "../../../src/cli/markdown-pdf";
import { checkMarkdownPdfProfileFontCoverage } from "../../../src/cli/markdown-pdf/profile/font-coverage";
import { checkFontCoverage, type CheckFontCoverageInput } from "../../../src/fonts";
import type { FontCoverageInventory } from "../../../src/fonts";

describe("Markdown PDF recipe font checks", () => {
  test("checks Markdown PDF profile fonts with labeled controlled coverage results", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        fonts: {
          body: {
            default: "Source Serif 4",
            "zh-Hant": "Noto Serif TC",
            vi: "Source Serif Vietnamese",
            pl: "Source Serif Polish",
            he: "Noto Serif Hebrew",
          },
          code: {
            symbols: "JetBrainsMono Nerd Font",
          },
        },
        pdf: {
          "content-langs": ["zh-Hant", "vi", "pl", "he"],
        },
      },
    });
    const checkedInputs: CheckFontCoverageInput[] = [];
    const inventories: FontCoverageInventory[] = [
      {
        family: "Noto Serif TC",
        supportedRanges: [{ name: "latin", start: 0x0000, end: 0x007f }],
      },
      {
        family: "Source Serif Vietnamese",
        supportedRanges: [
          { name: "latin", start: 0x0000, end: 0x007f },
          { name: "latin-extended", start: 0x0100, end: 0x024f },
          { name: "latin-extended-additional", start: 0x1e00, end: 0x1eff },
        ],
      },
      {
        family: "Source Serif Polish",
        supportedRanges: [{ name: "latin-polish", start: 0x0000, end: 0x024f }],
      },
      {
        family: "Noto Serif Hebrew",
        supportedRanges: [{ name: "hebrew", start: 0x0590, end: 0x05ff }],
      },
      {
        family: "JetBrainsMono Nerd Font",
        supportedRanges: [{ name: "latin", start: 0x0000, end: 0x007f }],
        nerdFont: false,
      },
    ];

    const result = checkMarkdownPdfProfileFontCoverage({
      profile: normalizedProfile.profile,
      inventories,
      checker: (input) => {
        checkedInputs.push(input);
        return checkFontCoverage(input);
      },
    });

    expect(result.warnings).toHaveLength(2);
    expect(result.results.map((entry) => [entry.role, entry.language, entry.family])).toEqual([
      ["body", "zh-Hant", "Noto Serif TC"],
      ["body", "vi", "Source Serif Vietnamese"],
      ["body", "pl", "Source Serif Polish"],
      ["body", "he", "Noto Serif Hebrew"],
      ["code", undefined, "JetBrainsMono Nerd Font"],
    ]);
    expect(checkedInputs.map((input) => input.text)).toEqual([
      "繁體中文測試",
      "Tiếng Việt",
      "Zażółć gęślą jaźń",
      "עברית",
      "git \uE0B0 main \uF418",
    ]);
    expect(result.results[1]).toMatchObject({
      role: "body",
      language: "vi",
      family: "Source Serif Vietnamese",
      coverage: {
        status: "known",
        supportsText: true,
        missingCodepoints: [],
      },
    });
    expect(result.results[2]).toMatchObject({
      role: "body",
      language: "pl",
      family: "Source Serif Polish",
      coverage: {
        status: "known",
        supportsText: true,
        missingCodepoints: [],
      },
    });
    expect(result.results[3]).toMatchObject({
      role: "body",
      language: "he",
      family: "Noto Serif Hebrew",
      coverage: {
        status: "known",
        supportsText: true,
        missingCodepoints: [],
        scripts: ["hebrew"],
      },
    });
    expect(result.results[4]).toMatchObject({
      role: "code",
      family: "JetBrainsMono Nerd Font",
      coverage: {
        status: "known",
        supportsText: false,
      },
    });
    expect(result.warnings[0]?.role).toBe("body");
    expect(result.warnings[0]?.language).toBe("zh-Hant");
    expect(result.warnings[0]?.message).toContain("zh-Hant");
    expect(result.warnings[0]?.coverage.missingCodepoints.length).toBeGreaterThan(0);
    expect(result.warnings[1]?.role).toBe("code");
    expect(result.warnings[1]?.message).toContain("Nerd Font glyphs");
    expect(result.warnings[1]?.coverage.missingCodepoints).toContain("U+E0B0");
    expect(result.warnings[1]?.coverage.missingCodepoints).toContain("U+F418");
  });
});
