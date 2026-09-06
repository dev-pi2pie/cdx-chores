import { describe, expect, test } from "bun:test";

import {
  createMarkdownPdfRecipe,
  normalizeMarkdownPdfOptions,
  normalizeMarkdownPdfProfile,
} from "../../../src/cli/markdown-pdf";
import { MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME } from "../../../src/cli/markdown-pdf/profile/page-number-format";
import { logicalCurrent, namedPageRule, pageChromeCss } from "./page-chrome-test-utils";

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
      const selectedBox = `@${cssArea}-${slot} {\n    content: "PN-" ${logicalCurrent};`;
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
      `@top-right {\n    content: "Body " ${logicalCurrent};\n    font-weight: 700;\n    padding-bottom: 2mm;\n  }`,
    );
    expect(bodyTocRule).toContain("@top-right {\n    content: none;");
    expect(bodyTocRule).not.toContain("Body ");
    expect(bodyTocRule).not.toContain("font-weight: 700;");
    expect(bodyTocRule).not.toContain("padding-bottom: 2mm;");
    expect(tocRule).toContain(
      `@bottom-left {\n    content: "Document " ${logicalCurrent};\n    color: #345678;\n    border-top-width: 1pt;\n  }`,
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
    const genericStart = css.indexOf(
      `@page {\n  counter-increment: ${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME} 2;`,
    );
    const genericRule = css.slice(genericStart, css.indexOf("@page:nth(1)", genericStart));
    const bodyRule = namedPageRule(css, "body");
    const tocRule = namedPageRule(css, "toc");
    const coverRule = namedPageRule(css, "cover");

    expect(genericStart).toBeGreaterThanOrEqual(0);
    expect(genericRule).toContain(
      `counter-increment: ${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME} 2;`,
    );
    expect(genericRule).not.toContain("Body-visible");
    expect(genericRule).not.toContain("font-size: 9pt;");
    expect(css).toContain(
      `@page:nth(1) {\n  counter-reset: ${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME} -2;`,
    );
    expect(bodyRule).toContain(
      `@top-right {\n    content: "Body-visible " ${logicalCurrent};\n    font-size: 9pt;\n    color: #2468AC;\n    border-bottom-style: solid;\n    padding-bottom: 1.5mm;\n  }`,
    );
    expect(tocRule).not.toContain("Body-visible");
    expect(tocRule).not.toContain("font-size: 9pt;");
    expect(coverRule).toContain("@top-right {\n    content: none;");
    expect(coverRule).not.toContain("Body-visible");
    expect(coverRule).not.toContain("counter-increment:");
    expect(coverRule).not.toContain("counter-reset:");
  });
});
