import { describe, expect, test } from "bun:test";

import {
  parseFontconfigList,
  parseMacosSystemProfilerFonts,
  parseWindowsFontRegistry,
} from "../src/fonts";

describe("font discovery parsers", () => {
  test("parses fontconfig faces without requiring fontconfig on CI", () => {
    const faces = parseFontconfigList(
      "JetBrainsMono Nerd Font\tJetBrainsMono Nerd Font Mono Bold Italic\tBold Italic\t/home/user/fonts/JetBrainsMonoNerdFont-BoldItalic.ttf\n",
    );

    expect(faces).toEqual([
      {
        family: "JetBrainsMono Nerd Font",
        fullName: "JetBrainsMono Nerd Font Mono Bold Italic",
        style: "italic",
        weight: 700,
        path: "/home/user/fonts/JetBrainsMonoNerdFont-BoldItalic.ttf",
        format: "ttf",
        source: "system",
      },
    ]);
  });

  test("parses optional fontconfig face indexes", () => {
    const faces = parseFontconfigList(
      [
        "Inter\tInter Thin\tThin\t/Users/user/Fonts/Inter.ttc\t0",
        "Inter\tInter Bold\tBold\t/Users/user/Fonts/Inter.ttc\t14",
        "Inter\tInter Regular\tRegular\t/Users/user/Fonts/Inter.ttc\t",
        "Inter\tInter Italic\tItalic\t/Users/user/Fonts/Inter.ttc\tbad-index",
        "",
      ].join("\n"),
    );

    expect(faces[0]).toMatchObject({
      family: "Inter",
      fullName: "Inter Thin",
      style: "normal",
      weight: 100,
      path: "/Users/user/Fonts/Inter.ttc",
      format: "ttc",
      faceIndex: 0,
    });
    expect(faces[1]).toMatchObject({
      family: "Inter",
      fullName: "Inter Bold",
      style: "normal",
      weight: 700,
      path: "/Users/user/Fonts/Inter.ttc",
      format: "ttc",
      faceIndex: 14,
    });
    expect(faces[2]).not.toHaveProperty("faceIndex");
    expect(faces[3]).not.toHaveProperty("faceIndex");
  });

  test("parses macOS system profiler font output", () => {
    const faces = parseMacosSystemProfilerFonts(
      JSON.stringify({
        SPFontsDataType: [
          {
            _name: "Source Serif 4 Regular",
            type: "OpenType",
            path: "/System/Library/Fonts/SourceSerif4.otf",
            typefaces: [
              {
                _name: "SourceSerif4-Regular",
                family: "Source Serif 4",
                fullname: "Source Serif 4 Regular",
                style: "Regular",
              },
            ],
          },
        ],
      }),
    );

    expect(faces[0]).toMatchObject({
      family: "Source Serif 4",
      fullName: "Source Serif 4 Regular",
      style: "normal",
      format: "otf",
      source: "system",
    });
  });

  test("parses Windows registry font output", () => {
    const faces = parseWindowsFontRegistry(
      JSON.stringify([
        {
          name: "Noto Sans CJK JP (TrueType)",
          value: "NotoSansCJKjp-Regular.otf",
        },
      ]),
    );

    expect(faces[0]).toMatchObject({
      family: "Noto Sans CJK JP",
      fullName: "Noto Sans CJK JP",
      style: "normal",
      format: "otf",
      source: "system",
    });
    expect(faces[0]?.path).toContain("NotoSansCJKjp-Regular.otf");
  });
});
