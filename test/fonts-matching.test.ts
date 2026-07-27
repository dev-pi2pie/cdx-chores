import { describe, expect, test } from "bun:test";

import {
  fontFamilyMatchRank,
  selectFontFaceForCheck,
  uniqueFontFaces,
} from "../src/fonts/matching";
import type { FontFace } from "../src/fonts";

function face(input: {
  family: string;
  aliases?: string[];
  fullName: string;
  fullNames?: string[];
}): FontFace {
  return {
    ...input,
    source: "system",
    style: "normal",
  };
}

describe("shared font family matching", () => {
  const subject = face({
    family: "Primary Sans",
    aliases: ["Alternate UI"],
    fullName: "Primary Sans Regular,Alternate UI Regular",
    fullNames: ["Primary Sans Regular", "Alternate UI Regular"],
  });

  test("preserves family and full-name ranks while extending aliases as family metadata", () => {
    expect(fontFamilyMatchRank(subject, "Primary Sans")).toBe(0);
    expect(fontFamilyMatchRank(subject, "Alternate UI")).toBe(1);
    expect(fontFamilyMatchRank(subject, "Alternate UI Regular")).toBe(1);
    expect(fontFamilyMatchRank(subject, "Alternate")).toBe(2);
    expect(fontFamilyMatchRank(subject, "UI Regular")).toBe(3);
  });

  test("keeps ambiguous loose alias selection inconclusive", () => {
    expect(
      selectFontFaceForCheck(
        [
          subject,
          face({
            family: "Secondary Sans",
            aliases: ["Alternate Text"],
            fullName: "Secondary Sans Regular",
          }),
        ],
        "Alternate",
      ),
    ).toEqual({ status: "inconclusive", reason: "ambiguous-family" });
  });

  test("prefers an exact primary family over another face's exact alias", () => {
    expect(
      selectFontFaceForCheck(
        [
          subject,
          face({
            family: "Alternate UI",
            fullName: "Alternate UI Regular",
          }),
        ],
        "Alternate UI",
      ),
    ).toMatchObject({
      status: "selected",
      face: { family: "Alternate UI" },
    });
  });

  test("keeps lookup metadata out of physical face identity", () => {
    expect(
      uniqueFontFaces([
        subject,
        {
          ...subject,
          aliases: ["Different Alias"],
          fullNames: ["Different Full Name"],
        },
      ]),
    ).toHaveLength(1);
  });
});
