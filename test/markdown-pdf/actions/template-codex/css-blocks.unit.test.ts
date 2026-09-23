import { describe, expect, test } from "bun:test";

import { validateMarkdownPdfTemplateCodexCssBlock } from "../../../../src/cli/markdown-pdf/template-codex/css-blocks";

describe("cli action modules: md pdf-template codex cover CSS blocks", () => {
  test("keeps the text-cover hook visible while allowing ordinary cover styling", () => {
    expect(
      validateMarkdownPdfTemplateCodexCssBlock({
        slot: "cover",
        css: ".pdf-cover { padding: 2mm; }",
      }),
    ).toEqual({ slot: "cover", css: ".pdf-cover { padding: 2mm; }" });

    for (const declaration of ["display: none", "visibility: hidden", "content: none"]) {
      expect(() =>
        validateMarkdownPdfTemplateCodexCssBlock({
          slot: "cover",
          css: `.pdf-cover { ${declaration}; }`,
        }),
      ).toThrow("must preserve required template selectors");
    }
  });
});
