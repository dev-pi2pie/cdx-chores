import { describe, expect, test } from "bun:test";

import {
  buildMarkdownPdfInteractiveFontHintPreferenceChoices,
  collectInstalledFontFamilies,
  compileMarkdownPdfInteractiveFontHintDraft,
  filterInstalledFontFamilies,
  findExactMarkdownPdfInteractiveFontHintDuplicate,
  formatMarkdownPdfInteractiveFontHintPreview,
  intendedUseChoices,
  moveMarkdownPdfInteractiveFontHint,
} from "../../../src/cli/interactive/markdown/font-hints";
import type { FontFace } from "../../../src/fonts";

function face(family: string, path = `/private/${family}.otf`): FontFace {
  return { family, fullName: family, path, source: "system", style: "normal" };
}

describe("Markdown PDF Interactive font hint model", () => {
  test("compiles every supported intended-use family to one direct-equivalent string", () => {
    expect(compileMarkdownPdfInteractiveFontHintDraft({ kind: "built", preference: "Inter" })).toBe(
      "Prefer Inter",
    );
    expect(
      compileMarkdownPdfInteractiveFontHintDraft({
        kind: "built",
        preference: "Source Serif 4",
        intendedUse: { kind: "body" },
      }),
    ).toBe("Prefer Source Serif 4 for body text");
    expect(
      compileMarkdownPdfInteractiveFontHintDraft({
        kind: "built",
        preference: "Noto Serif JP",
        intendedUse: { kind: "language-body", language: "Japanese" },
      }),
    ).toBe("Prefer Noto Serif JP for Japanese body text");
    expect(
      compileMarkdownPdfInteractiveFontHintDraft({
        kind: "built",
        preference: "JetBrains Mono",
        intendedUse: { kind: "code-symbols" },
      }),
    ).toBe("Prefer JetBrains Mono for code symbols");
    expect(
      compileMarkdownPdfInteractiveFontHintDraft({
        kind: "built",
        preference: "Inter",
        intendedUse: { kind: "page-chrome" },
      }),
    ).toBe("Prefer Inter for page headers and footers");
    expect(
      compileMarkdownPdfInteractiveFontHintDraft({
        kind: "custom",
        text: "  Prefer Brand Sans for callout captions  ",
      }),
    ).toBe("Prefer Brand Sans for callout captions");
  });

  test("keeps page chrome out of Template intended uses", () => {
    expect(intendedUseChoices("template-bundle").map((choice) => choice.value.kind)).not.toContain(
      "page-chrome",
    );
    expect(intendedUseChoices("profile").map((choice) => choice.value.kind)).toContain(
      "page-chrome",
    );
  });

  test("renders intended use, direct option, and advisory assignment in preview", () => {
    expect(
      formatMarkdownPdfInteractiveFontHintPreview({
        kind: "built",
        preference: "Noto Serif JP",
        intendedUse: { kind: "language-body", language: "Japanese" },
      }),
    ).toEqual(
      expect.arrayContaining([
        "Intended use: Language-specific body text — Japanese",
        "--font-hint = Prefer Noto Serif JP for Japanese body text",
        "Assignment: determined during Codex preparation",
      ]),
    );
  });

  test("deduplicates families case-insensitively and filters a bounded stable page", () => {
    const families = collectInstalledFontFamilies([
      face("source serif 4"),
      face("Source Serif 4"),
      face("Inter"),
      face("Noto Sans"),
      face("Noto Serif"),
      face("Noto Mono"),
      face("Noto Color Emoji"),
      face("Noto Sans Symbols"),
      face("Noto Music"),
      face("Noto Nastaliq"),
    ]);

    expect(families.filter((family) => family.toLowerCase() === "source serif 4")).toEqual([
      "Source Serif 4",
    ]);
    expect(filterInstalledFontFamilies(families, "noto")).toEqual([
      "Noto Color Emoji",
      "Noto Mono",
      "Noto Music",
      "Noto Nastaliq",
      "Noto Sans",
      "Noto Sans Symbols",
    ]);
  });

  test("keeps raw custom text first and collapses an exact installed duplicate", () => {
    const choices = buildMarkdownPdfInteractiveFontHintPreferenceChoices({
      families: ["Source Serif 4", "Source Serif Pro"],
      term: "Source Serif 4",
    });

    expect(choices).toEqual([
      {
        name: "Source Serif 4",
        value: "Source Serif 4",
        description: "Use the typed text as a custom font preference.",
      },
    ]);
    expect(
      buildMarkdownPdfInteractiveFontHintPreferenceChoices({
        families: ["Source Serif 4"],
        term: "  Source",
      })[0],
    ).toEqual({
      name: "  Source",
      value: "  Source",
      description: "Use the typed text as a custom font preference.",
    });
  });

  test("keeps custom input first while alias and full-name matches return primary families", () => {
    const records = [
      {
        family: "Noto Sans CJK JP",
        aliases: ["Noto Sans JP"],
        fullNames: ["Noto Sans JP Regular"],
      },
    ];

    expect(
      buildMarkdownPdfInteractiveFontHintPreferenceChoices({
        records,
        term: "Noto Sans JP",
      }),
    ).toEqual([
      {
        name: "Noto Sans JP",
        value: "Noto Sans JP",
        description: "Use the typed text as a custom font preference.",
      },
      "Noto Sans CJK JP",
    ]);
    expect(
      buildMarkdownPdfInteractiveFontHintPreferenceChoices({
        records,
        term: "Noto Sans JP Regular",
      }),
    ).toEqual([
      {
        name: "Noto Sans JP Regular",
        value: "Noto Sans JP Regular",
        description: "Use the typed text as a custom font preference.",
      },
      "Noto Sans CJK JP",
    ]);
  });

  test("limits installed matches to six independently of the custom choice", () => {
    const choices = buildMarkdownPdfInteractiveFontHintPreferenceChoices({
      records: Array.from({ length: 8 }, (_, index) => ({
        family: `Example Sans ${index + 1}`,
        aliases: [],
        fullNames: [],
      })),
      term: "Example",
    });

    expect(choices).toHaveLength(7);
    expect(choices[0]).toEqual({
      name: "Example",
      value: "Example",
      description: "Use the typed text as a custom font preference.",
    });
    expect(choices.slice(1)).toEqual([
      "Example Sans 1",
      "Example Sans 2",
      "Example Sans 3",
      "Example Sans 4",
      "Example Sans 5",
      "Example Sans 6",
    ]);
  });

  test("detects only exact duplicates and preserves explicit collection ordering", () => {
    expect(
      findExactMarkdownPdfInteractiveFontHintDuplicate(
        ["Prefer Inter for headings and titles"],
        "prefer inter for headings and titles",
      ),
    ).toBe("Prefer Inter for headings and titles");
    expect(
      findExactMarkdownPdfInteractiveFontHintDuplicate(
        ["Prefer Inter for headings and titles"],
        "Prefer Source Serif 4 for headings and titles",
      ),
    ).toBeUndefined();
    expect(moveMarkdownPdfInteractiveFontHint(["one", "two", "three"], 2, 0)).toEqual([
      "three",
      "one",
      "two",
    ]);
  });
});
