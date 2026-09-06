import { describe, expect, test } from "bun:test";

import { rankSearchableFontFamilies } from "../../../src/fonts";
import type { SearchableFontFamily } from "../../../src/fonts";

function record(
  family: string,
  aliases: string[] = [],
  fullNames: string[] = [],
): SearchableFontFamily {
  return { family, aliases, fullNames };
}

describe("installed font search ranking", () => {
  test("ranks exact, prefix, token-prefix, substring, and ordered-subsequence matches", () => {
    expect(
      rankSearchableFontFamilies(
        [
          record("Sable Serif"),
          record("Crosslf Sans"),
          record("Modern SLF"),
          record("SLF Display"),
          record("SLF"),
        ],
        "slf",
      ),
    ).toEqual(["SLF", "SLF Display", "Modern SLF", "Crosslf Sans", "Sable Serif"]);
  });

  test("uses primary family, alias, then full name as stable field tie-breakers", () => {
    expect(
      rankSearchableFontFamilies(
        [record("Primary B", [], ["Target"]), record("Primary A", ["Target"]), record("Target")],
        "target",
      ),
    ).toEqual(["Target", "Primary A", "Primary B"]);
  });

  test("supports missing spaces, separated tokens, and initials", () => {
    const records = [
      record("Source Serif 4"),
      record("JetBrains Mono"),
      record("Noto Sans CJK JP"),
    ];

    expect(rankSearchableFontFamilies(records, "sourceser")).toEqual(["Source Serif 4"]);
    expect(rankSearchableFontFamilies(records, "source 4")).toEqual(["Source Serif 4"]);
    expect(rankSearchableFontFamilies(records, "ss4")).toEqual(["Source Serif 4"]);
    expect(rankSearchableFontFamilies(records, "jbm")).toEqual(["JetBrains Mono"]);
  });

  test("returns primary families for alias and styled full-name matches", () => {
    const records = [
      record(
        "Noto Sans CJK JP",
        ["Noto Sans JP"],
        ["Noto Sans CJK JP Regular", "Noto Sans JP Regular"],
      ),
    ];

    expect(rankSearchableFontFamilies(records, "Noto Sans JP")).toEqual(["Noto Sans CJK JP"]);
    expect(rankSearchableFontFamilies(records, "Noto Sans JP Regular")).toEqual([
      "Noto Sans CJK JP",
    ]);
  });

  test("merges duplicate primary families and remains independent of input order", () => {
    const records = [
      record("example sans", ["Example UI"]),
      record("Example Sans", ["Example Text"]),
      record("Example Serif"),
    ];

    expect(rankSearchableFontFamilies(records, "Example Text")).toEqual(["Example Sans"]);
    expect(rankSearchableFontFamilies(records, "example")).toEqual(
      rankSearchableFontFamilies([...records].reverse(), "example"),
    );
  });

  test("returns a stable deduplicated first page before the user types", () => {
    const records = [
      record("Gamma Sans"),
      record("beta sans"),
      record("Alpha Sans"),
      record("Beta Sans", ["Beta UI"]),
    ];

    expect(rankSearchableFontFamilies(records, "", 2)).toEqual(["Alpha Sans", "Beta Sans"]);
    expect(rankSearchableFontFamilies([...records].reverse(), "", 2)).toEqual([
      "Alpha Sans",
      "Beta Sans",
    ]);
  });

  test("uses stable score details and primary-family spelling to break ambiguous matches", () => {
    expect(
      rankSearchableFontFamilies(
        [
          record("Longer Sans Display"),
          record("Sans Display"),
          record("Sans"),
          record("Brand Sans"),
        ],
        "sans",
      ),
    ).toEqual(["Sans", "Sans Display", "Brand Sans", "Longer Sans Display"]);
  });

  test("returns no matches for unrelated input and validates the result limit", () => {
    expect(rankSearchableFontFamilies([record("Inter")], "xyz")).toEqual([]);
    expect(rankSearchableFontFamilies([record("Alpha Beta")], "ae")).toEqual([]);
    expect(rankSearchableFontFamilies([record("Inter")], "", 0)).toEqual([]);
    expect(() => rankSearchableFontFamilies([record("Inter")], "", -1)).toThrow(
      "Installed font match limit must be a non-negative integer.",
    );
  });
});
