import { describe, expect, test } from "bun:test";

import { normalizeMarkdownPdfProfile } from "../../../../src/cli/markdown-pdf/profile";
import {
  deriveMdPdfTemplateCodexFontOwnership,
  EMPTY_MD_PDF_TEMPLATE_CODEX_FONT_OWNERSHIP,
  mdPdfTemplateCodexOwnsFontKey,
  mdPdfTemplateCodexOwnsFontSlot,
} from "../../../../src/cli/markdown-pdf/template-codex/font-ownership";

describe("cli action modules: md pdf-template codex font ownership", () => {
  test("derives exact canonical keys and CSS slots from a full compatibility Profile", () => {
    const profile = normalizeMarkdownPdfProfile({
      profile: {
        fonts: {
          body: {
            default: "Profile Body",
            "zh-hant": "Profile Traditional Chinese",
            ja: "Profile Japanese",
          },
          heading: {
            default: "Profile Heading",
            alternate: "Unused Heading",
          },
          code: {
            symbols: "Profile Symbols",
          },
          pageChrome: {
            default: "Profile Chrome",
          },
        },
      },
    }).profile;

    const ownership = deriveMdPdfTemplateCodexFontOwnership(profile);

    expect(ownership.ownedKeys).toEqual([
      { role: "body", key: "default" },
      { role: "body", key: "zh-Hant" },
      { role: "body", key: "ja" },
      { role: "heading", key: "default" },
      { role: "heading", key: "alternate" },
      { role: "code", key: "symbols" },
      { role: "pageChrome", key: "default" },
    ]);
    expect(ownership.slots).toEqual({
      bodyDefault: true,
      bodyLanguages: ["zh-Hant", "ja"],
      headingDefault: true,
      codeStack: true,
      pageChromeDefault: true,
    });
    expect(mdPdfTemplateCodexOwnsFontKey(ownership, "body", "zh-hant")).toBe(true);
    expect(mdPdfTemplateCodexOwnsFontKey(ownership, "code", "default")).toBe(false);
    expect(mdPdfTemplateCodexOwnsFontSlot(ownership, "code", "default")).toBe(true);
    expect(mdPdfTemplateCodexOwnsFontSlot(ownership, "code", "symbols")).toBe(true);
  });

  test("treats either configured code key as ownership of the combined code stack", () => {
    const defaultOnly = normalizeMarkdownPdfProfile({
      profile: { fonts: { code: { default: "Profile Code" } } },
    }).profile;
    const symbolsOnly = normalizeMarkdownPdfProfile({
      profile: { fonts: { code: { symbols: "Profile Symbols" } } },
    }).profile;

    expect(deriveMdPdfTemplateCodexFontOwnership(defaultOnly).slots.codeStack).toBe(true);
    expect(deriveMdPdfTemplateCodexFontOwnership(symbolsOnly).slots.codeStack).toBe(true);
    expect(
      mdPdfTemplateCodexOwnsFontSlot(
        deriveMdPdfTemplateCodexFontOwnership(defaultOnly),
        "code",
        "symbols",
      ),
    ).toBe(true);
    expect(
      mdPdfTemplateCodexOwnsFontSlot(
        deriveMdPdfTemplateCodexFontOwnership(symbolsOnly),
        "code",
        "default",
      ),
    ).toBe(true);
  });

  test("ignores empty configured families and requires a real compatibility Profile", () => {
    const profile = normalizeMarkdownPdfProfile({
      profile: {
        fonts: {
          body: { default: "  ", ja: "" },
          heading: { default: "" },
          code: { default: "", symbols: " " },
          pageChrome: { default: "" },
        },
      },
    }).profile;

    expect(deriveMdPdfTemplateCodexFontOwnership(profile)).toEqual(
      EMPTY_MD_PDF_TEMPLATE_CODEX_FONT_OWNERSHIP,
    );
    expect(deriveMdPdfTemplateCodexFontOwnership(undefined)).toBe(
      EMPTY_MD_PDF_TEMPLATE_CODEX_FONT_OWNERSHIP,
    );
  });
});
