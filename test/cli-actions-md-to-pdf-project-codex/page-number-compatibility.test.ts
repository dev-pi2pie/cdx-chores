import { describe, expect, test } from "bun:test";

import { validateMdPdfProjectCodexTemplatePageNumberCssOwnership } from "../../src/cli/markdown-pdf/project-codex";

describe("Markdown PDF Project Codex Template page-number CSS ownership", () => {
  test("allows template-layout-and-unnamed-page-geometry", () => {
    expect(() =>
      validateMdPdfProjectCodexTemplatePageNumberCssOwnership(`
        @page { size: A4 portrait; margin: 20mm 18mm; }
        body { color: #123456; line-height: 1.5; }
        main { display: block; }
      `),
    ).not.toThrow();
  });

  test("allows template-named-cover-presentation", () => {
    expect(() =>
      validateMdPdfProjectCodexTemplatePageNumberCssOwnership(`
        @page cover {
          margin: 0;
          @bottom-center { content: none; font: 10pt sans-serif; border-top: 1pt solid; }
        }
        .pdf-cover { page: cover; break-after: page; }
      `),
    ).not.toThrow();
  });

  test("allows template-named-toc-presentation-and-clearing", () => {
    expect(() =>
      validateMdPdfProjectCodexTemplatePageNumberCssOwnership(`
        @page toc {
          background: #fff;
          @top-left { content: none; }
          @bottom-center { content: none; font-size: 9pt; }
        }
        #TOC { page: toc; break-after: page; }
      `),
    ).not.toThrow();
  });

  test("rejects template-ordinary-margin-box-page-counter", () => {
    expect(() =>
      validateMdPdfProjectCodexTemplatePageNumberCssOwnership(`
        @page {
          margin: 20mm;
          @bottom-center { content: "Page " c\\6f unter(page); }
        }
      `),
    ).toThrow("must not place Profile-owned page counters");
  });

  test("rejects template-page-counter-reset-or-increment", () => {
    for (const declaration of ["counter-reset: page 0", "counter-increment: p\\61 ge 2"]) {
      expect(() =>
        validateMdPdfProjectCodexTemplatePageNumberCssOwnership(
          `@page body { ${declaration}; margin: 18mm; }`,
        ),
      ).toThrow("must not reset or increment the Profile-owned page counter");
    }

    expect(() =>
      validateMdPdfProjectCodexTemplatePageNumberCssOwnership(
        "@page cover { counter-increment: page 1; margin: 0; }",
      ),
    ).toThrow("must not reset or increment the Profile-owned page counter");
  });

  test("rejects template-competing-page-chrome-typography", () => {
    for (const property of [
      "font",
      "font-family",
      "font-size",
      "font-weight",
      "line-height",
      "color",
    ]) {
      expect(() =>
        validateMdPdfProjectCodexTemplatePageNumberCssOwnership(`
          @page :first { @top-left { ${property}: 9pt; } }
        `),
      ).toThrow(`margin-box ${property} styling`);
    }
  });

  test("rejects template-competing-page-chrome-separator", () => {
    for (const property of ["border-top", "border-block-start-width", "padding-bottom"]) {
      expect(() =>
        validateMdPdfProjectCodexTemplatePageNumberCssOwnership(`
          @page { @bottom-right { ${property}: 1pt; } }
        `),
      ).toThrow(`margin-box ${property} styling`);
    }
  });

  test("does not treat comments, strings, or similarly named counters as page ownership", () => {
    expect(() =>
      validateMdPdfProjectCodexTemplatePageNumberCssOwnership(`
        /* @page { counter-reset: page; } */
        @page {
          counter-reset: chapter-page 1;
          @bottom-center { content: "counter(page)" counter(chapter-page); }
        }
      `),
    ).not.toThrow();
  });
});
