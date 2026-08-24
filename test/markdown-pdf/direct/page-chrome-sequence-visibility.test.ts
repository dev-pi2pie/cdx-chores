import { describe, expect, test } from "bun:test";

import {
  createMarkdownPdfRecipe,
  normalizeMarkdownPdfOptions,
  normalizeMarkdownPdfProfile,
} from "../../../src/cli/markdown-pdf";
import { MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME } from "../../../src/cli/markdown-pdf/profile/page-number-format";
import {
  logicalCurrent,
  logicalFinal,
  namedPageRule,
  pageChromeCss,
} from "./page-chrome-test-utils";

describe("Markdown PDF page-chrome sequence and visibility", () => {
  test("keeps disabled numbering free of counter and body-boundary rules", () => {
    const css = pageChromeCss({ enabled: false, countFrom: "body" }, { bodyBoundary: "proven" });

    expect(css).toBe("");
  });

  test("resets ToC boxes before restoring configured repeating content", () => {
    const css = pageChromeCss(
      { enabled: false },
      { bodyBoundary: "not-required" },
      {
        header: {
          left: "Ordinary header",
          style: { color: "#234567", fontSize: "8.5pt" },
        },
      },
    );

    expect(css).toContain('@top-left {\n    content: "Ordinary header";');
    expect(css).toContain("@page toc {");
    const tocRule = namedPageRule(css, "toc");
    expect(tocRule).toContain("@top-left {\n    content: none;");
    expect(tocRule).toContain('@top-left {\n    content: "Ordinary header";');
    expect(tocRule).toContain("font-size: 8.5pt;");
    expect(tocRule).toContain("color: #234567;");
    expect(tocRule.indexOf("content: none;")).toBeLessThan(
      tocRule.indexOf('content: "Ordinary header";'),
    );
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

    expect(css).toContain(`counter-increment: ${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME} 2;`);
    expect(css).toContain(
      `@page:nth(1) {\n  counter-reset: ${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME} -2;`,
    );
    expect(css).not.toContain("@page body");
    expect(css).not.toContain(".document-body");
    expect(css).not.toContain("counter-increment: page");
    expect(css).not.toContain("counter-reset: page");
  });

  test("maps every exact page-number token to its logical or physical CSS counter", () => {
    const css = pageChromeCss({
      enabled: true,
      scope: "document",
      countFrom: "document",
      format: "Logical {page}/{pages}; PDF {pdfPage}/{pdfPages}",
    });

    expect(css).toContain(
      `content: "Logical " ${logicalCurrent} "/" ${logicalFinal} "; PDF " counter(page) "/" counter(pages);`,
    );
    expect(
      css.match(new RegExp(`counter\\(${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME}\\)`, "g")),
    ).toHaveLength(2);
    expect(css.match(/target-counter\(/g)).toHaveLength(2);
    expect(css.match(/counter\(page\)/g)).toHaveLength(2);
    expect(css.match(/counter\(pages\)/g)).toHaveLength(2);
  });

  test("preserves adjacent and repeated tokens, escaped literals, and metadata replacements", () => {
    const author = 'Ada "A"\\Labs\nSecond line';
    const css = pageChromeCss(
      {
        enabled: true,
        scope: "document",
        countFrom: "document",
        format: 'A"{page}{page}\\{pages}{pdfPage}{pdfPages}{author}{missing}{Page}Z',
      },
      {},
      {
        metadata: {
          Page: "metadata page",
          author,
        },
      },
    );
    const expectedContent = [
      JSON.stringify('A"'),
      logicalCurrent,
      logicalCurrent,
      JSON.stringify("\\"),
      logicalFinal,
      "counter(page)",
      "counter(pages)",
      JSON.stringify(author),
      JSON.stringify("metadata page"),
      JSON.stringify("Z"),
    ].join(" ");

    expect(css).toContain(`content: ${expectedContent};`);
    expect(css).not.toContain("{missing}");
    expect(css.split(`content: ${expectedContent};`)).toHaveLength(3);
  });

  test("emits empty content when a label contains only missing metadata", () => {
    const css = pageChromeCss({
      enabled: true,
      scope: "document",
      countFrom: "document",
      format: "{missing}",
    });

    const ordinaryRule = css.slice(css.indexOf("@page {"), css.indexOf("@page:nth(1)"));
    expect(ordinaryRule).toContain('@bottom-center {\n    content: "";');
  });

  test("keeps every valid scope and origin combination on the private logical counter", () => {
    const cases = [
      { countFrom: "document", scope: "document", sequenceRule: "@page {" },
      { countFrom: "document", scope: "body", sequenceRule: "@page {" },
      { countFrom: "body", scope: "body", sequenceRule: "@page body {" },
    ] as const;

    for (const { countFrom, scope, sequenceRule } of cases) {
      const css = pageChromeCss(
        {
          enabled: true,
          scope,
          countFrom,
          start: 5,
          increment: 2,
          format: "{page}/{pages} [{pdfPage}/{pdfPages}]",
        },
        { bodyBoundary: "proven" },
      );
      const sequenceStart = css.indexOf(sequenceRule);
      const sequenceRuleCss = css.slice(sequenceStart, css.indexOf("}", sequenceStart));

      expect(sequenceStart).toBeGreaterThanOrEqual(0);
      expect(sequenceRuleCss).toContain(
        `counter-increment: ${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME} 2;`,
      );
      expect(css).toContain(`counter-reset: ${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME} 3;`);
      expect(css).not.toMatch(/counter-(?:increment|reset):\s+pages?(?:\s|;)/);
    }
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

    expect(css).toContain(
      `@page body {\n  counter-increment: ${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME} 2;`,
    );
    expect(css).toContain(
      `@page body:nth(1 of body) {\n  counter-reset: ${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME} -2;`,
    );
    expect(css).toContain(".document-body {\n  page: body;");
    expect(
      css.indexOf(`counter-increment: ${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME} 2;`),
    ).toBeGreaterThan(css.indexOf("@page body"));
    expect(css).not.toContain("@page:nth(1)");
    expect(css).not.toContain("counter-increment: page");
    expect(css).not.toContain("counter-reset: page");
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
    expect(genericRule).toContain(
      `counter-increment: ${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME} 1;`,
    );
    expect(genericRule).not.toContain("PN-");
    expect(genericRule).not.toContain("Original footer");
    expect(bodyRule).toContain(`@bottom-right {\n    content: "PN-" ${logicalCurrent};`);
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
    expect(genericRule).toContain(`@top-left {\n    content: "PN-" ${logicalCurrent};`);
    expect(tocRule).toContain(`@top-left {\n    content: "PN-" ${logicalCurrent};`);
    expect(css).not.toContain("@page body");
    expect(css).not.toContain(".document-body");
  });

  test("clears ToC boxes before restoring repeating content and document-visible numbering", () => {
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
    expect(tocRule).toContain(`@bottom-center {\n    content: "Page " ${logicalCurrent};`);
    expect(tocRule).toContain('content: "Private header";');
    expect(tocRule).toContain('content: "Private right";');
    expect(tocRule).toContain('content: "Private footer";');
    expect(tocRule.indexOf("content: none;")).toBeLessThan(
      tocRule.indexOf('content: "Private header";'),
    );
  });

  test("keeps a body-scoped number hidden on ToC while restoring unreserved chrome", () => {
    const css = pageChromeCss(
      {
        enabled: true,
        scope: "body",
        countFrom: "body",
        position: "bottom-center",
        format: "Body {page}",
      },
      { bodyBoundary: "proven" },
      {
        header: { left: "Guide title", right: "Section" },
        footer: { left: "Company", center: "Reserved footer" },
      },
    );

    const tocRule = namedPageRule(css, "toc");
    expect(tocRule).toContain('content: "Guide title";');
    expect(tocRule).toContain('content: "Section";');
    expect(tocRule).toContain('content: "Company";');
    expect(tocRule).not.toContain("Body ");
    expect(tocRule).not.toContain("Reserved footer");
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

    expect(documentCss).toContain(
      `@page {\n  counter-increment: ${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME} 2;`,
    );
    expect(documentCss).toContain(
      `@page:nth(1) {\n  counter-reset: ${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME} -2;`,
    );
    expect(bodyCss).not.toContain("@page:nth(1)");
    expect(bodyCss).toContain(
      `@page body {\n  counter-increment: ${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME} 2;`,
    );
    for (const css of [documentCss, bodyCss]) {
      const coverRule = namedPageRule(css, "cover");
      expect(coverRule).toContain("@bottom-center {\n    content: none;");
      expect(coverRule).not.toContain("counter-increment:");
      expect(coverRule).not.toContain("counter-reset:");
    }
  });
});
