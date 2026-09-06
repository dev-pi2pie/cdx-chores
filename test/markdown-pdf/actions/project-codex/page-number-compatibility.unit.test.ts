import { describe, expect, test } from "bun:test";

import { validateMdPdfProjectCodexTemplatePageNumberCssOwnership } from "../../../../src/cli/markdown-pdf/project-codex";

describe("Markdown PDF Project Codex Template page-number CSS ownership", () => {
  test("allows template-layout-and-unnamed-page-geometry", () => {
    expect(() =>
      validateMdPdfProjectCodexTemplatePageNumberCssOwnership(`
        @page { size: A4 portrait; margin: 20mm 18mm; border: 0; padding: 0; }
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
    ).toThrow("must not reference Profile-owned or indeterminate counters");
  });

  test("rejects direct and indirect page-counter references in every declaration value", () => {
    for (const css of [
      "@page { @bottom-center { --folio: counter(page); content: var(--folio); } }",
      "@page { --folio: counter(pages); @bottom-center { content: var(--folio); } }",
      "body { --folio: c\\6f unter(p\\61 ge); }",
      'main { marker: c\\6f unters(pages, "."); }',
      "section { --folio: counter(cdx-markdown-pdf-logical-page); }",
      "section { --folio: counter(CDX-MARKDOWN-PDF-LOGICAL-PAGE); }",
      "aside { --folio: counter(var(--folio)); }",
      "footer { marker: counters(calc(1 + 1), '.'); }",
    ]) {
      expect(() => validateMdPdfProjectCodexTemplatePageNumberCssOwnership(css)).toThrow(
        "must not reference Profile-owned or indeterminate counters",
      );
    }
  });

  test("rejects template-page-counter-reset-or-increment", () => {
    for (const declaration of [
      "counter-reset: page 0",
      "counter-increment: p\\61 ge 2",
      "counter-\\73 et: page 5",
      "counter-reset: pages 0",
      "counter-increment: p\\61 ges 2",
      "counter-set: cdx-markdown-pdf-logical-page 7",
      "counter-reset: cdx-markdown-pdf-logical-p\\61 ge 0",
    ]) {
      expect(() =>
        validateMdPdfProjectCodexTemplatePageNumberCssOwnership(
          `@page body { ${declaration}; margin: 18mm; }`,
        ),
      ).toThrow("must not mutate Profile-owned page counters");
    }

    expect(() =>
      validateMdPdfProjectCodexTemplatePageNumberCssOwnership(
        "@page cover { counter-increment: page 1; margin: 0; }",
      ),
    ).toThrow("must not mutate Profile-owned page counters");
  });

  test("rejects target-counter functions before Template CSS can bypass Profile ownership", () => {
    for (const css of [
      "a::after { content: target-counter(attr(href), page); }",
      'a::after { content: t\\61 rget-counter(url("#end"), cdx-markdown-pdf-logical-page); }',
      'a::after { content: target-counters(attr(href), section, "."); }',
      'a::after { --folio: target-counters(url("#end"), pages, "."); }',
    ]) {
      expect(() => validateMdPdfProjectCodexTemplatePageNumberCssOwnership(css)).toThrow(
        "must not reference Profile-owned or indeterminate counters",
      );
    }
  });

  test("rejects page-counter mutation in every Template selector and nesting level", () => {
    for (const css of [
      "body { counter-reset: page 0; }",
      ".document-body { counter-increment: page 2; }",
      "@media print { main { counter-set: page 9; } }",
      "@supports (display: grid) { @layer template { article { counter-reset: chapter 1 page 0; } } }",
    ]) {
      expect(() => validateMdPdfProjectCodexTemplatePageNumberCssOwnership(css)).toThrow(
        "must not mutate Profile-owned page counters",
      );
    }
  });

  test("rejects counter mutation through dynamic function values", () => {
    for (const css of [
      "body { --folio: page 99; counter-reset: var(--folio); }",
      ".document-body { counter-increment: var(--sequence); }",
      "@media print { main { counter-set: v\\61 r(--counter-name); } }",
      "article { counter-reset: attr(data-counter type(<custom-ident>)); }",
      "aside { counter-increment: \\61 ttr(data-counter); }",
      "section { counter-set: env(counter-name); }",
      "nav { counter-reset: reversed(page); }",
      "footer { counter-reset: reversed(p\\61 ges); }",
      "header { counter-reset: reversed(var(--counter-name)); }",
      "main { counter-reset: reversed(attr(data-counter)); }",
    ]) {
      expect(() => validateMdPdfProjectCodexTemplatePageNumberCssOwnership(css)).toThrow(
        "indeterminate counter mutation",
      );
    }
  });

  test("allows provably unrelated literal counter mutation and references", () => {
    expect(() =>
      validateMdPdfProjectCodexTemplatePageNumberCssOwnership(`
        body { counter-reset: list-item 0 chapter-page 2; }
        ol { counter-reset: reversed(section) 8; }
        ul { counter-reset: r\\65 versed(chapter) 3; }
        .document-body { counter-increment: section calc(1 + 1); }
        @media print { main { counter-set: chapter 4; } }
        h2::before { content: counter(section) "." counter(chapter-page); }
      `),
    ).not.toThrow();
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

  test("rejects inherited page-chrome styling directly on ordinary page rules", () => {
    for (const property of ["all", "color", "line-height", "font", "font-family", "font-size"]) {
      expect(() =>
        validateMdPdfProjectCodexTemplatePageNumberCssOwnership(`
          @page { size: A4; margin: 20mm; ${property}: initial; }
        `),
      ).toThrow(`ordinary-page ${property} styling`);
    }

    expect(() =>
      validateMdPdfProjectCodexTemplatePageNumberCssOwnership(`
        @page :first { font-weight: 700; }
      `),
    ).toThrow("ordinary-page font-weight styling");
  });

  test("allows direct page-chrome presentation on named cover and toc page rules", () => {
    expect(() =>
      validateMdPdfProjectCodexTemplatePageNumberCssOwnership(`
        @page cover { margin: 0; color: white; font-family: sans-serif; }
        @page toc { margin: 18mm; line-height: 1.4; font-size: 9pt; }
      `),
    ).not.toThrow();
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
        body::before { content: "counter-set: page 8"; }
        @page {
          @bottom-center { content: "counter(page)" counter(chapter-page); }
        }
      `),
    ).not.toThrow();
  });

  test("preserves exact diagnostics for unterminated comments and strings", () => {
    expect(() =>
      validateMdPdfProjectCodexTemplatePageNumberCssOwnership("body {} /* tail"),
    ).toThrow("Generated Template stylesheet contains an unterminated comment.");
    expect(() =>
      validateMdPdfProjectCodexTemplatePageNumberCssOwnership('body { content: "tail; }'),
    ).toThrow("Generated Template stylesheet contains an unterminated string.");
  });
});
