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
