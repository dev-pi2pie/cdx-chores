import { describe, expect, test } from "bun:test";

import { collectSearchableFontFamilies } from "../src/fonts";
import type { FontFace } from "../src/fonts";

function face(input: {
  family: string;
  aliases?: string[];
  fullName?: string;
  fullNames?: string[];
}): FontFace {
  return {
    family: input.family,
    ...(input.aliases ? { aliases: input.aliases } : {}),
    fullName: input.fullName ?? input.family,
    ...(input.fullNames ? { fullNames: input.fullNames } : {}),
    source: "system",
    style: "normal",
  };
}

describe("searchable font family records", () => {
  test("groups normalized primary families and merges lookup metadata deterministically", () => {
    const records = collectSearchableFontFamilies([
      face({
        family: "source   serif 4",
        aliases: ["Source Serif Variable", "SOURCE SERIF 4"],
        fullName: "Source Serif 4 Bold",
        fullNames: ["Source Serif Four Bold", "Source Serif 4 Bold"],
      }),
      face({
        family: "Source Serif 4",
        aliases: ["Source Serif Pro", "source serif variable"],
        fullName: "Source Serif 4 Regular",
      }),
      face({
        family: "Inter",
        aliases: [],
        fullName: "",
        fullNames: [],
      }),
    ]);

    expect(records).toEqual([
      {
        family: "Inter",
        aliases: [],
        fullNames: [],
      },
      {
        family: "Source Serif 4",
        aliases: ["Source Serif Pro", "Source Serif Variable"],
        fullNames: ["Source Serif 4 Bold", "Source Serif 4 Regular", "Source Serif Four Bold"],
      },
    ]);
  });

  test("produces the same records for reversed face input", () => {
    const faces = [
      face({
        family: "Example Sans",
        aliases: ["Example UI"],
        fullName: "Example Sans Regular",
      }),
      face({
        family: "example sans",
        aliases: ["Example Text"],
        fullName: "Example Sans Bold",
      }),
    ];

    expect(collectSearchableFontFamilies(faces)).toEqual(
      collectSearchableFontFamilies([...faces].reverse()),
    );
  });

  test("normalizes native-adapter faces without optional lookup arrays", () => {
    expect(
      collectSearchableFontFamilies([
        face({
          family: "Native Sans",
          fullName: "Native Sans Regular",
        }),
      ]),
    ).toEqual([
      {
        family: "Native Sans",
        aliases: [],
        fullNames: ["Native Sans Regular"],
      },
    ]);
  });
});
