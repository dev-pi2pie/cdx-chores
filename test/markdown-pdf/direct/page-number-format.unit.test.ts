import { describe, expect, test } from "bun:test";

import {
  MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME,
  MARKDOWN_PDF_PAGE_NUMBER_FORMAT_TOKEN_DEFINITIONS,
  markdownPdfPageNumberFormatTokens,
  parseMarkdownPdfPageNumberFormat,
} from "../../../src/cli/markdown-pdf/profile/page-number-format";

describe("Markdown PDF page-number format parser", () => {
  test("keeps one complete metadata inventory for the four exact tokens", () => {
    expect(MARKDOWN_PDF_PAGE_NUMBER_FORMAT_TOKEN_DEFINITIONS).toEqual([
      { introducedIn: 2, token: "page" },
      {
        introducedIn: 2,
        rendererCapability: "pageNumbers.logicalFinal",
        token: "pages",
      },
      {
        introducedIn: 3,
        rendererCapability: "pageNumbers.physicalCurrent",
        token: "pdfPage",
      },
      {
        introducedIn: 3,
        rendererCapability: "pageNumbers.physicalTotal",
        token: "pdfPages",
      },
    ]);
  });

  test("classifies exact page-number tokens and leaves valid unknown names as metadata", () => {
    expect(
      parseMarkdownPdfPageNumberFormat(
        "Page {page}/{pages}; PDF {pdfPage}/{pdfPages}; {author}; {Page}; {pdfpages}",
      ),
    ).toEqual([
      { kind: "text", value: "Page " },
      { kind: "token", token: "page", value: "{page}" },
      { kind: "text", value: "/" },
      { kind: "token", token: "pages", value: "{pages}" },
      { kind: "text", value: "; PDF " },
      { kind: "token", token: "pdfPage", value: "{pdfPage}" },
      { kind: "text", value: "/" },
      { kind: "token", token: "pdfPages", value: "{pdfPages}" },
      { kind: "text", value: "; " },
      { key: "author", kind: "metadata", value: "{author}" },
      { kind: "text", value: "; " },
      { key: "Page", kind: "metadata", value: "{Page}" },
      { kind: "text", value: "; " },
      { key: "pdfpages", kind: "metadata", value: "{pdfpages}" },
    ]);
  });

  test("preserves adjacent, repeated, and malformed input without inventing tokens", () => {
    const format = "{page}{page}{pdfPages}{pagesx} {pages {pdfPage} {{pages}} {} {1page}";
    expect(markdownPdfPageNumberFormatTokens(format)).toEqual([
      "page",
      "page",
      "pdfPages",
      "pdfPage",
      "pages",
    ]);
    expect(parseMarkdownPdfPageNumberFormat(format)).toContainEqual({
      kind: "text",
      value: " {pages ",
    });
    expect(parseMarkdownPdfPageNumberFormat("plain label")).toEqual([
      { kind: "text", value: "plain label" },
    ]);
    expect(parseMarkdownPdfPageNumberFormat("")).toEqual([]);
  });

  test("exports a collision-resistant Profile-owned logical counter name", () => {
    expect(MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME).toBe("cdx-markdown-pdf-logical-page");
  });
});
