import { describe, expect, test } from "bun:test";

import { normalizeMarkdownPdfOptions } from "../src/cli/markdown-pdf";

describe("markdown PDF option normalization", () => {
  test("normalizes default article options", () => {
    const options = normalizeMarkdownPdfOptions();

    expect(options).toMatchObject({
      preset: "article",
      pageSize: "A4",
      orientation: "portrait",
      toc: false,
      tocDepth: 3,
      tocPageBreak: "auto",
      allowRemoteAssets: false,
    });
    expect(options.margins).toEqual({
      top: "18mm",
      right: "18mm",
      bottom: "18mm",
      left: "18mm",
    });
  });

  test("applies wide-table preset defaults and margin overrides", () => {
    const options = normalizeMarkdownPdfOptions({
      preset: "wide-table",
      marginX: "14mm",
      marginTop: "1in",
    });

    expect(options.orientation).toBe("landscape");
    expect(options.margins).toEqual({
      top: "1in",
      right: "14mm",
      bottom: "12mm",
      left: "14mm",
    });
  });

  test("rejects arbitrary CSS margin expressions", () => {
    expect(() => normalizeMarkdownPdfOptions({ margin: "calc(1cm + 2mm)" })).toThrow(
      "--margin must be a CSS length",
    );
  });

  test("rejects invalid ToC depth", () => {
    expect(() => normalizeMarkdownPdfOptions({ tocDepth: 0 })).toThrow(
      "ToC depth must be an integer from 1 to 6",
    );
  });
});
