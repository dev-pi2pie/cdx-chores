import { describe, expect, test } from "bun:test";

import {
  createMarkdownPdfPageChromeCss,
  createMarkdownPdfRecipe,
  normalizeMarkdownPdfOptions,
  normalizeMarkdownPdfProfile,
} from "../src/cli/markdown-pdf";

function pageChromeCss(
  pageNumbers: Record<string, unknown>,
  input: Parameters<typeof createMarkdownPdfPageChromeCss>[1] = {},
  profile: Record<string, unknown> = {},
): string {
  const normalized = normalizeMarkdownPdfProfile({
    profile: { ...profile, pageNumbers },
  }).profile;
  return createMarkdownPdfPageChromeCss(normalized, input);
}

function namedPageRule(css: string, selector: string): string {
  const start = css.indexOf(`@page ${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  const nextRule = css.indexOf("\n@page ", start + 1);
  const nextSelector = css.indexOf("\n.document-body", start + 1);
  const candidates = [nextRule, nextSelector].filter((index) => index >= 0);
  const end = candidates.length > 0 ? Math.min(...candidates) : css.length;
  return css.slice(start, end);
}

describe("Markdown PDF page-chrome sequence and visibility", () => {
  test("keeps disabled numbering free of counter and body-boundary rules", () => {
    const css = pageChromeCss({ enabled: false, countFrom: "body" }, { bodyBoundary: "proven" });

    expect(css).toBe("");
  });

  test("preserves ordinary headers and ToC clearing when numbering is disabled", () => {
    const css = pageChromeCss(
      { enabled: false },
      { bodyBoundary: "not-required" },
      { header: { left: "Ordinary header" } },
    );

    expect(css).toContain('@top-left {\n    content: "Ordinary header";');
    expect(css).toContain("@page toc {");
    expect(namedPageRule(css, "toc")).toContain("@top-left {\n    content: none;");
    expect(css).not.toContain("counter-increment:");
    expect(css).not.toContain("counter-reset:");
    expect(css).not.toContain(".document-body");
  });

  test("uses the first physical page as the document-origin reset boundary", () => {
    const css = pageChromeCss({
      enabled: true,
      scope: "document",
      countFrom: "document",
      start: 0,
      increment: 2,
      format: "PN-{page}",
    });

    expect(css).toContain("counter-increment: page 2;");
    expect(css).toContain("@page:nth(1) {\n  counter-reset: page -2;");
    expect(css).not.toContain("@page body");
    expect(css).not.toContain(".document-body");
  });

  test("maps the historical pages token to the physical CSS pages counter", () => {
    const css = pageChromeCss({
      enabled: true,
      scope: "document",
      countFrom: "document",
      format: "Page {page} of {pages}",
    });

    expect(css).toContain('content: "Page " counter(page) " of " counter(pages);');
    expect(css.match(/counter\(pages\)/g)).toHaveLength(2);
  });

  test("uses the proven first-body page group for body-origin arithmetic", () => {
    const css = pageChromeCss(
      {
        enabled: true,
        scope: "body",
        countFrom: "body",
        start: 0,
        increment: 2,
        format: "PN-{page}",
      },
      { bodyBoundary: "proven" },
    );

    expect(css).toContain("@page body {\n  counter-increment: page 2;");
    expect(css).toContain("@page body:nth(1 of body) {\n  counter-reset: page -2;");
    expect(css).toContain(".document-body {\n  page: body;");
    expect(css.indexOf("counter-increment: page 2;")).toBeGreaterThan(css.indexOf("@page body"));
    expect(css).not.toContain("@page:nth(1)");
  });

  test("rejects an impossible legacy fallback for body-origin arithmetic", () => {
    expect(() =>
      pageChromeCss(
        {
          enabled: true,
          scope: "body",
          countFrom: "body",
          start: 1,
          increment: 1,
        },
        { bodyBoundary: "legacy-document-origin-fallback" },
      ),
    ).toThrow(
      "page-chrome invariant violated: legacy document-origin fallback cannot satisfy countFrom: body",
    );
  });

  test("keeps document-origin values hidden until a proven body page", () => {
    const css = pageChromeCss(
      {
        enabled: true,
        scope: "body",
        countFrom: "document",
        start: 1,
        increment: 1,
        position: "bottom-right",
        format: "PN-{page}",
      },
      { bodyBoundary: "proven" },
      { footer: { right: "Original footer" } },
    );

    const genericRule = css.slice(css.indexOf("@page {"), css.indexOf("@page:nth(1)"));
    const bodyRule = namedPageRule(css, "body");
    const tocRule = namedPageRule(css, "toc");
    expect(genericRule).toContain("counter-increment: page 1;");
    expect(genericRule).not.toContain("PN-");
    expect(genericRule).not.toContain("Original footer");
    expect(bodyRule).toContain('@bottom-right {\n    content: "PN-" counter(page);');
    expect(tocRule).not.toContain("PN-");
  });

  test("uses document visibility for the explicit legacy fallback", () => {
    const css = pageChromeCss(
      {
        enabled: true,
        scope: "body",
        countFrom: "document",
        position: "top-left",
        format: "PN-{page}",
      },
      { bodyBoundary: "legacy-document-origin-fallback" },
    );

    const genericRule = css.slice(css.indexOf("@page {"), css.indexOf("@page:nth(1)"));
    const tocRule = namedPageRule(css, "toc");
    expect(genericRule).toContain('@top-left {\n    content: "PN-" counter(page);');
    expect(tocRule).toContain('@top-left {\n    content: "PN-" counter(page);');
    expect(css).not.toContain("@page body");
    expect(css).not.toContain(".document-body");
  });

  test("clears unrelated ToC chrome before restoring only document-visible numbering", () => {
    const css = pageChromeCss(
      {
        enabled: true,
        scope: "document",
        countFrom: "document",
        position: "bottom-center",
        format: "Page {page}",
      },
      {},
      {
        header: { left: "Private header", right: "Private right" },
        footer: { left: "Private footer" },
      },
    );

    const tocRule = namedPageRule(css, "toc");
    expect(tocRule).toContain("@top-left {\n    content: none;");
    expect(tocRule).toContain("@bottom-left {\n    content: none;");
    expect(tocRule).toContain('@bottom-center {\n    content: "Page " counter(page);');
    expect(tocRule).not.toContain("Private header");
    expect(tocRule).not.toContain("Private right");
    expect(tocRule).not.toContain("Private footer");
  });

  test("keeps generated covers hidden while sequence participation follows the origin", () => {
    const documentOrigin = normalizeMarkdownPdfProfile({
      profile: {
        cover: { enabled: true },
        pageNumbers: {
          enabled: true,
          scope: "body",
          countFrom: "document",
          start: 0,
          increment: 2,
        },
      },
    }).profile;
    const bodyOrigin = normalizeMarkdownPdfProfile({
      profile: {
        cover: { enabled: true },
        pageNumbers: {
          enabled: true,
          scope: "body",
          countFrom: "body",
          start: 0,
          increment: 2,
        },
      },
    }).profile;

    const documentCss = createMarkdownPdfRecipe(normalizeMarkdownPdfOptions(), {
      bodyBoundary: "proven",
      profile: documentOrigin,
    }).styleCss;
    const bodyCss = createMarkdownPdfRecipe(normalizeMarkdownPdfOptions(), {
      bodyBoundary: "proven",
      profile: bodyOrigin,
    }).styleCss;

    expect(documentCss).toContain("@page {\n  counter-increment: page 2;");
    expect(documentCss).toContain("@page:nth(1) {\n  counter-reset: page -2;");
    expect(bodyCss).not.toContain("@page:nth(1)");
    expect(bodyCss).toContain("@page body {\n  counter-increment: page 2;");
    for (const css of [documentCss, bodyCss]) {
      const coverRule = namedPageRule(css, "cover");
      expect(coverRule).toContain("@bottom-center {\n    content: none;");
      expect(coverRule).not.toContain("counter-increment:");
      expect(coverRule).not.toContain("counter-reset:");
    }
  });
});

describe("Markdown PDF page-chrome area styling", () => {
  test("keeps all six page-number positions content-owned while inheriting the area style", () => {
    const cases = [
      ["top-left", "top", "left", "Header left"],
      ["top-center", "top", "center", "Header center"],
      ["top-right", "top", "right", "Header right"],
      ["bottom-left", "bottom", "left", "Footer left"],
      ["bottom-center", "bottom", "center", "Footer center"],
      ["bottom-right", "bottom", "right", "Footer right"],
    ] as const;

    for (const [position, cssArea, slot, replacedContent] of cases) {
      const css = pageChromeCss(
        {
          enabled: true,
          position,
          scope: "document",
          format: "PN-{page}",
        },
        {},
        {
          header: {
            left: "Header left",
            center: "Header center",
            right: "Header right",
            style: { color: "#112233", fontSize: "8.5pt" },
          },
          footer: {
            left: "Footer left",
            center: "Footer center",
            right: "Footer right",
            style: { color: "#445566", fontSize: "10pt" },
          },
        },
      );
      const ordinaryRule = css.slice(css.indexOf("@page {"), css.indexOf("@page:nth(1)"));
      const selectedBox = `@${cssArea}-${slot} {\n    content: "PN-" counter(page);`;
      const sameAreaSiblings =
        cssArea === "top"
          ? ([
              ["left", "Header left"],
              ["center", "Header center"],
              ["right", "Header right"],
            ] as const)
          : ([
              ["left", "Footer left"],
              ["center", "Footer center"],
              ["right", "Footer right"],
            ] as const);

      expect(ordinaryRule).toContain(selectedBox);
      expect(ordinaryRule).not.toContain(`content: "${replacedContent}";`);
      for (const [siblingSlot, siblingContent] of sameAreaSiblings) {
        if (siblingSlot !== slot) {
          expect(ordinaryRule).toContain(
            `@${cssArea}-${siblingSlot} {\n    content: "${siblingContent}";`,
          );
        }
      }
      expect(
        ordinaryRule.slice(
          ordinaryRule.indexOf(selectedBox),
          ordinaryRule.indexOf("  }", ordinaryRule.indexOf(selectedBox)),
        ),
      ).toContain(cssArea === "top" ? "font-size: 8.5pt;" : "font-size: 10pt;");
      expect(
        ordinaryRule.slice(
          ordinaryRule.indexOf(selectedBox),
          ordinaryRule.indexOf("  }", ordinaryRule.indexOf(selectedBox)),
        ),
      ).toContain(cssArea === "top" ? "color: #112233;" : "color: #445566;");
    }
  });

  test("emits independent typography longhands only when their fields are present", () => {
    const css = pageChromeCss(
      { enabled: false },
      {},
      {
        header: {
          center: "Header",
          style: { fontWeight: 600, color: "#123456" },
        },
        footer: {
          right: "Footer",
          style: { fontSize: "9pt", lineHeight: 1.5 },
        },
      },
    );

    expect(css).toContain(
      '@top-center {\n    content: "Header";\n    font-weight: 600;\n    color: #123456;\n  }',
    );
    expect(css).toContain(
      '@bottom-right {\n    content: "Footer";\n    font-size: 9pt;\n    line-height: 1.5;\n  }',
    );
    expect(css).not.toMatch(/^\s*font:/m);
    expect(css).not.toContain("font-family:");
    expect(css).not.toContain("!important");
  });

  test("emits complete header and footer separators in the correct directions", () => {
    const css = pageChromeCss(
      { enabled: false },
      {},
      {
        header: {
          center: "Header",
          style: {
            separator: { width: "0.75pt", style: "solid", color: "#445566", gap: 0 },
          },
        },
        footer: {
          center: "Footer",
          style: {
            separator: { width: "1.5pt", style: "solid", color: "#112233", gap: "3.5mm" },
          },
        },
      },
    );

    expect(css).toContain(
      '@top-center {\n    content: "Header";\n    border-bottom-width: 0.75pt;\n    border-bottom-style: solid;\n    border-bottom-color: #445566;\n    padding-bottom: 0;\n  }',
    );
    expect(css).toContain(
      '@bottom-center {\n    content: "Footer";\n    border-top-width: 1.5pt;\n    border-top-style: solid;\n    border-top-color: #112233;\n    padding-top: 3.5mm;\n  }',
    );
  });

  test("preserves partial and empty separator objects without inventing declarations", () => {
    const partialCss = pageChromeCss(
      { enabled: false },
      {},
      {
        header: {
          left: "Partial",
          style: { separator: { width: "0.5pt" } },
        },
      },
    );
    const emptyCss = pageChromeCss(
      { enabled: false },
      {},
      {
        footer: {
          right: "Empty",
          style: { separator: {} },
        },
      },
    );

    expect(partialCss).toContain(
      '@top-left {\n    content: "Partial";\n    border-bottom-width: 0.5pt;\n  }',
    );
    expect(partialCss).not.toContain("border-bottom-style:");
    expect(partialCss).not.toContain("border-bottom-color:");
    expect(partialCss).not.toContain("padding-bottom:");
    expect(emptyCss).toContain('@bottom-right {\n    content: "Empty";\n  }');
    expect(emptyCss).not.toContain("border-top-");
    expect(emptyCss).not.toContain("padding-top:");
  });

  test("styles occupied boxes only and does not synthesize separator siblings", () => {
    const css = pageChromeCss(
      { enabled: false },
      {},
      {
        header: {
          center: "Only header",
          style: { separator: { style: "solid" } },
        },
        footer: {
          left: "Only footer",
          style: { separator: { color: "#667788" } },
        },
      },
    );

    const ordinaryRule = css.slice(css.indexOf("@page {"), css.indexOf("@page toc"));
    expect(ordinaryRule).toContain("@top-center {");
    expect(ordinaryRule).toContain("border-bottom-style: solid;");
    expect(ordinaryRule).toContain("@bottom-left {");
    expect(ordinaryRule).toContain("border-top-color: #667788;");
    expect(ordinaryRule).not.toContain("@top-left {");
    expect(ordinaryRule).not.toContain("@top-right {");
    expect(ordinaryRule).not.toContain("@bottom-center {");
    expect(ordinaryRule).not.toContain("@bottom-right {");
  });

  test("reapplies the page-number area style on body and ToC restoration rules", () => {
    const bodyCss = pageChromeCss(
      {
        enabled: true,
        position: "top-right",
        scope: "body",
        countFrom: "body",
        format: "Body {page}",
      },
      { bodyBoundary: "proven" },
      {
        header: {
          right: "Replaced",
          style: { fontWeight: 700, separator: { gap: "2mm" } },
        },
      },
    );
    const documentCss = pageChromeCss(
      {
        enabled: true,
        position: "bottom-left",
        scope: "document",
        format: "Document {page}",
      },
      {},
      {
        footer: {
          left: "Replaced",
          style: { color: "#345678", separator: { width: "1pt" } },
        },
      },
    );

    const bodyRule = namedPageRule(bodyCss, "body");
    const bodyTocRule = namedPageRule(bodyCss, "toc");
    const tocRule = namedPageRule(documentCss, "toc");
    expect(bodyRule).toContain(
      '@top-right {\n    content: "Body " counter(page);\n    font-weight: 700;\n    padding-bottom: 2mm;\n  }',
    );
    expect(bodyTocRule).toContain("@top-right {\n    content: none;");
    expect(bodyTocRule).not.toContain("Body ");
    expect(bodyTocRule).not.toContain("font-weight: 700;");
    expect(bodyTocRule).not.toContain("padding-bottom: 2mm;");
    expect(tocRule).toContain(
      '@bottom-left {\n    content: "Document " counter(page);\n    color: #345678;\n    border-top-width: 1pt;\n  }',
    );
  });

  test("keeps document-origin sequencing generic while proven body visibility owns the styled box", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        cover: { enabled: true },
        header: {
          right: "Replaced header",
          style: {
            color: "#2468AC",
            fontSize: "9pt",
            separator: { style: "solid", gap: "1.5mm" },
          },
        },
        pageNumbers: {
          enabled: true,
          position: "top-right",
          scope: "body",
          countFrom: "document",
          start: 0,
          increment: 2,
          format: "Body-visible {page}",
        },
      },
    }).profile;
    const css = createMarkdownPdfRecipe(normalizeMarkdownPdfOptions(), {
      bodyBoundary: "proven",
      profile: normalizedProfile,
    }).styleCss;
    const genericStart = css.indexOf("@page {\n  counter-increment: page 2;");
    const genericRule = css.slice(genericStart, css.indexOf("@page:nth(1)", genericStart));
    const bodyRule = namedPageRule(css, "body");
    const tocRule = namedPageRule(css, "toc");
    const coverRule = namedPageRule(css, "cover");

    expect(genericStart).toBeGreaterThanOrEqual(0);
    expect(genericRule).toContain("counter-increment: page 2;");
    expect(genericRule).not.toContain("Body-visible");
    expect(genericRule).not.toContain("font-size: 9pt;");
    expect(css).toContain("@page:nth(1) {\n  counter-reset: page -2;");
    expect(bodyRule).toContain(
      '@top-right {\n    content: "Body-visible " counter(page);\n    font-size: 9pt;\n    color: #2468AC;\n    border-bottom-style: solid;\n    padding-bottom: 1.5mm;\n  }',
    );
    expect(tocRule).not.toContain("Body-visible");
    expect(tocRule).not.toContain("font-size: 9pt;");
    expect(coverRule).toContain("@top-right {\n    content: none;");
    expect(coverRule).not.toContain("Body-visible");
    expect(coverRule).not.toContain("counter-increment:");
    expect(coverRule).not.toContain("counter-reset:");
  });
});
