import { describe, expect, test } from "bun:test";

import { suggestMarkdownPdfTemplateWithCodex } from "../../../../src/adapters/codex/markdown-pdf-template";

import { validateMarkdownPdfTemplateCodexCssBlock } from "../../../../src/cli/markdown-pdf/template-codex";

import { requestBase, responseFromDecision } from "../template-codex-fixtures";

describe("Markdown PDF template Codex adapter: css safety", () => {
  test("accepts conservative fallback decisions with bounded slot-owned CSS", async () => {
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase({ coverImage: true }),
      runner: async () =>
        responseFromDecision({
          cssBlocks: [{ css: ".pdf-cover-media__caption { color: #555555; }", slot: "cover" }],
          decisionMode: "conservative-fallback",
        }),
    });

    expect(result.decision.decisionMode).toBe("conservative-fallback");
    expect(result.decision.cssBlocks).toEqual([
      { css: ".pdf-cover-media__caption { color: #555555; }", slot: "cover" },
    ]);
  });

  test("rejects unsafe CSS blocks and falls back", async () => {
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase({ coverImage: true }),
      runner: async () =>
        responseFromDecision({
          cssBlocks: [{ css: ".pdf-cover-media { width: 2400px; }", slot: "cover" }],
        }),
    });

    expect(result.decision.decisionMode).toBe("no-usable-template");
    expect(result.decision.fallbackReason).toBe(
      "Codex template decision failed: invalid-application.",
    );
  });

  test("rejects unsafe CSS block branches directly", () => {
    expect(() =>
      validateMarkdownPdfTemplateCodexCssBlock({
        css: ".pdf-cover-media { background-image: url(https://example.com/a.png); }",
        slot: "cover",
      }),
    ).toThrow("remote URLs");
    expect(() =>
      validateMarkdownPdfTemplateCodexCssBlock({
        css: ".pdf-cover-media { background-image: url(/Users/me/a.png); }",
        slot: "cover",
      }),
    ).toThrow("absolute local paths");
    expect(() =>
      validateMarkdownPdfTemplateCodexCssBlock({
        css: ".pdf-cover-media { background-image: url(foo.png); }",
        slot: "cover",
      }),
    ).toThrow("remote URLs or absolute local paths");
    expect(() =>
      validateMarkdownPdfTemplateCodexCssBlock({
        css: '.pdf-cover-media { background-image: u\\72l("h\\74tps://example.com/a.png"); }',
        slot: "cover",
      }),
    ).toThrow("remote URLs or absolute local paths");
    expect(() =>
      validateMarkdownPdfTemplateCodexCssBlock({
        css: '.pdf-cover-media { background-image: u/**/rl("\\2fUsers/me/a.png"); }',
        slot: "cover",
      }),
    ).toThrow("remote URLs or absolute local paths");
    expect(() =>
      validateMarkdownPdfTemplateCodexCssBlock({
        css: "@import url(https://example.com/a.css);",
        slot: "colors",
      }),
    ).toThrow("@import");
    expect(() =>
      validateMarkdownPdfTemplateCodexCssBlock({
        css: "@media print { body { color: #222222; } }",
        slot: "colors",
      }),
    ).toThrow("plain selector blocks");
    expect(() =>
      validateMarkdownPdfTemplateCodexCssBlock({
        css: `body { color: #222222; }\n${"p { margin: 0; }\n".repeat(160)}`,
        slot: "spacing",
      }),
    ).toThrow("at most 2000 characters");
    expect(() =>
      validateMarkdownPdfTemplateCodexCssBlock({
        css: ".pdf-cover-media__caption { color: #555555;",
        slot: "cover",
      }),
    ).toThrow("unbalanced braces");
    expect(() =>
      validateMarkdownPdfTemplateCodexCssBlock({
        css: ".pdf-cover-caption { color: #555555; }",
        slot: "cover",
      }),
    ).toThrow("outside the cover slot");
    expect(() =>
      validateMarkdownPdfTemplateCodexCssBlock({
        css: ".pdf-cover-media { display: none; }",
        slot: "cover",
      }),
    ).toThrow("preserve required template selectors");
    expect(() =>
      validateMarkdownPdfTemplateCodexCssBlock({
        css: "tbody { margin: 0; }",
        slot: "spacing",
      }),
    ).toThrow("outside the spacing slot");
  });

  test("rejects generated CSS declarations that can override font families", () => {
    const familyOverrides = [
      {
        css: 'body { font-family: "Late Override"; }',
        slot: "typography" as const,
      },
      {
        css: '.pdf-cover-media__title { font: 700 22pt/1.15 "Cover Display"; }',
        slot: "cover" as const,
      },
      {
        css: ':root { --template-body-font: "Late Variable"; }',
        slot: "colors" as const,
      },
      {
        css: 'body { FoNt-FaMiLy: "Case Override"; }',
        slot: "typography" as const,
      },
      {
        css: 'body { f/**/ont-fa/**/mily: "Comment Override"; }',
        slot: "typography" as const,
      },
      {
        css: 'body { \\66 ont-family: "Escaped Override"; }',
        slot: "typography" as const,
      },
      {
        css: ':root { --TeMpLaTe-CoDe-FoNt: "Case Variable"; }',
        slot: "colors" as const,
      },
      {
        css: 'body { font-\\\nfamily: "Line Continuation Override"; }',
        slot: "typography" as const,
      },
      {
        css: ':root { --template-body-\\\nfont: "Line Continuation Variable"; }',
        slot: "colors" as const,
      },
      {
        css: "body { all: initial; }",
        slot: "typography" as const,
      },
      {
        css: "p { all: unset; }",
        slot: "typography" as const,
      },
    ];

    for (const block of familyOverrides) {
      expect(() => validateMarkdownPdfTemplateCodexCssBlock(block)).toThrow(
        "must not declare all, font, font-family, or Template font custom properties",
      );
    }
  });

  test("rejects nested generated CSS rules instead of inspecting partial branches", () => {
    const nestedBlocks = [
      'body { p { font-family: "Nested Override"; } }',
      'body { h1 { font: 12pt "Nested Shorthand"; } }',
      'body { p { --template-body-font: "Nested Variable"; } }',
      'body { p { color: red; } font-family: "Post-nesting Override"; }',
      "body { p { color: red; } all: initial; }",
      'body { p { color: red; } --template-body-font: "Post-nesting Variable"; }',
    ];

    for (const css of nestedBlocks) {
      expect(() =>
        validateMarkdownPdfTemplateCodexCssBlock({
          css,
          slot: "typography",
        }),
      ).toThrow("must use plain selector blocks only");
    }
  });

  test("ignores braces inside strings and comments when checking rule depth", () => {
    const flatBlocks = [
      {
        css: '.pdf-cover-media__caption { content: "{}"; }',
        slot: "cover" as const,
      },
      {
        css: "body { /* { } */ color: red; }",
        slot: "colors" as const,
      },
    ];

    for (const block of flatBlocks) {
      expect(validateMarkdownPdfTemplateCodexCssBlock(block)).toEqual(block);
    }
  });

  test("keeps the tolerant scanner-issue inspection policy", () => {
    const block = {
      css: "body { color: red; } /* unfinished generated note",
      slot: "colors" as const,
    };

    expect(validateMarkdownPdfTemplateCodexCssBlock(block)).toEqual(block);
    expect(() =>
      validateMarkdownPdfTemplateCodexCssBlock({
        css: 'body { content: "unfinished',
        slot: "colors",
      }),
    ).toThrow("has unbalanced braces");
  });

  test("allows non-family typography declarations and Template font variable reads", () => {
    expect(
      validateMarkdownPdfTemplateCodexCssBlock({
        css: [
          "body {",
          "  font-size: 11pt;",
          "  font-weight: 400;",
          "  font-style: normal;",
          "  outline: var(--template-body-font);",
          "}",
        ].join("\n"),
        slot: "typography",
      }),
    ).toEqual({
      css: [
        "body {",
        "  font-size: 11pt;",
        "  font-weight: 400;",
        "  font-style: normal;",
        "  outline: var(--template-body-font);",
        "}",
      ].join("\n"),
      slot: "typography",
    });
  });
});
