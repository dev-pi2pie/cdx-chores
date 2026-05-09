import { describe, expect, test } from "bun:test";

import { parseFontconfigCharset } from "../src/fonts/coverage";
import { checkFontCoverage, NERD_FONT_SAMPLE_TEXT, sampleTextForLanguage } from "../src/fonts";

describe("font coverage samples", () => {
  test("provides controlled sample text for expanded language fixtures", () => {
    expect(sampleTextForLanguage("zh-Hant")).toBe("繁體中文測試");
    expect(sampleTextForLanguage("zh-Hans")).toBe("简体中文测试");
    expect(sampleTextForLanguage("ja")).toBe("日本語の文章");
    expect(sampleTextForLanguage("ko")).toBe("한국어 문장");
    expect(sampleTextForLanguage("vi")).toBe("Tiếng Việt");
    expect(sampleTextForLanguage("pl")).toBe("Zażółć gęślą jaźń");
    expect(sampleTextForLanguage("ar")).toBe("العربية");
    expect(sampleTextForLanguage("he")).toBe("עברית");
  });

  test("reports missing CJK glyphs from controlled sample coverage", () => {
    const coverage = checkFontCoverage({
      family: "Latin Only",
      text: "繁體中文測試",
      inventory: {
        family: "Latin Only",
        supportedRanges: [{ name: "latin", start: 0x0000, end: 0x007f }],
      },
    });

    expect(coverage.status).toBe("known");
    expect(coverage.supportsText).toBe(false);
    expect(coverage.scripts).toContain("cjk");
    expect(coverage.missingCodepoints).toContain("U+7E41");
  });

  test("reports missing Nerd Font private-use glyphs", () => {
    const coverage = checkFontCoverage({
      family: "JetBrains Mono",
      text: NERD_FONT_SAMPLE_TEXT,
      requireNerdFont: true,
      inventory: {
        family: "JetBrains Mono",
        supportedRanges: [{ name: "latin", start: 0x0000, end: 0x007f }],
        nerdFont: false,
      },
    });

    expect(coverage.supportsText).toBe(false);
    expect(coverage.nerdFont.detected).toBe(false);
    expect(coverage.nerdFont.matchedRanges).toContain("private-use");
    expect(coverage.missingCodepoints).toContain("U+E0B0");
    expect(coverage.missingCodepoints).toContain("U+F418");
  });

  test("parses fontconfig charset output into codepoint ranges", () => {
    expect(parseFontconfigCharset("0020-007e,00a0\n\t4e00-9fff invalid 0100-00ff")).toEqual([
      { name: "fontconfig-charset", start: 0x0020, end: 0x007e },
      { name: "fontconfig-charset", start: 0x00a0, end: 0x00a0 },
      { name: "fontconfig-charset", start: 0x4e00, end: 0x9fff },
    ]);
    expect(parseFontconfigCharset("00ff-0020")).toEqual([]);
  });
});
