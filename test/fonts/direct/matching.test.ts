import { describe, expect, test } from "bun:test";

import {
  fontFamilyMatchRank,
  selectFontFaceForCheck,
  uniqueFontFaces,
} from "../../../src/fonts/matching";
import type { FontFace } from "../../../src/fonts";

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

  test("merges complementary lookup metadata before matching duplicate physical faces", () => {
    const duplicate = {
      ...subject,
      aliases: ["Second Alias"],
      fullNames: ["Second Alias Regular"],
    };
    const faces = [subject, duplicate];

    expect(uniqueFontFaces(faces)).toEqual([
      {
        ...subject,
        aliases: ["Alternate UI", "Second Alias"],
        fullNames: ["Primary Sans Regular", "Alternate UI Regular", "Second Alias Regular"],
      },
    ]);
    expect(selectFontFaceForCheck(faces, "Second Alias")).toMatchObject({
      status: "selected",
      face: { family: "Primary Sans" },
    });
  });

  test("keeps exact full-name collisions across primary families inconclusive", () => {
    expect(
      selectFontFaceForCheck(
        [
          face({
            family: "First Sans",
            fullName: "Shared Sans Regular",
          }),
          face({
            family: "Second Sans",
            fullName: "Shared Sans Regular",
          }),
        ],
        "Shared Sans Regular",
      ),
    ).toEqual({ status: "inconclusive", reason: "ambiguous-family" });
  });

  test("keeps full-name substring collisions across primary families inconclusive", () => {
    expect(
      selectFontFaceForCheck(
        [
          face({
            family: "First Sans",
            fullName: "First Shared Sans Regular",
          }),
          face({
            family: "Second Sans",
            fullName: "Second Shared Sans Regular",
          }),
        ],
        "Shared Sans Regular",
      ),
    ).toEqual({ status: "inconclusive", reason: "ambiguous-family" });
  });

  test("selects one deterministic rank-one face within a primary family", () => {
    expect(
      selectFontFaceForCheck(
        [
          {
            ...face({
              family: "Primary Sans",
              aliases: ["Shared Sans"],
              fullName: "Primary Sans Italic",
            }),
            path: "/fonts/PrimarySans-Italic.otf",
            style: "italic",
          },
          {
            ...face({
              family: "Primary Sans",
              aliases: ["Shared Sans"],
              fullName: "Primary Sans Regular",
            }),
            path: "/fonts/PrimarySans-Regular.otf",
          },
        ],
        "Shared Sans",
      ),
    ).toMatchObject({
      status: "selected",
      face: {
        family: "Primary Sans",
        fullName: "Primary Sans Regular",
      },
    });
  });
});
