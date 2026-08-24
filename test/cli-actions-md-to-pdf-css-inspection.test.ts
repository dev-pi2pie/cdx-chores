import { describe, expect, test } from "bun:test";

import { normalizeCssForInspection } from "../src/cli/markdown-pdf/css-inspection";

describe("Markdown PDF CSS inspection normalization", () => {
  test("decodes CSS escapes and applies optional lowercasing", () => {
    expect(
      normalizeCssForInspection("C\\6F unter(P\\41 GE)\\\nX", {
        commentReplacement: "",
        lowercase: true,
        maskStrings: false,
      }),
    ).toEqual({ css: "counter(page)x" });
  });

  test("masks strings without exposing escaped syntax", () => {
    expect(
      normalizeCssForInspection('A { content: "C\\6f unter(page)"; }', {
        commentReplacement: "",
        lowercase: false,
        maskStrings: true,
      }),
    ).toEqual({ css: "A { content:                ; }" });
  });

  test("uses the caller comment replacement", () => {
    const options = { lowercase: false, maskStrings: false };
    expect(normalizeCssForInspection("a/**/b", { ...options, commentReplacement: " " })).toEqual({
      css: "a b",
    });
    expect(normalizeCssForInspection("a/**/b", { ...options, commentReplacement: "" })).toEqual({
      css: "ab",
    });
  });

  test("reports unterminated comments and strings with the normalized prefix", () => {
    const options = { commentReplacement: "", lowercase: true, maskStrings: false };
    expect(normalizeCssForInspection("BODY {} /* tail", options)).toEqual({
      css: "body {} ",
      issue: "unterminated-comment",
    });
    expect(normalizeCssForInspection('BODY { content: "Tail', options)).toEqual({
      css: 'body { content: "tail',
      issue: "unterminated-string",
    });
  });
});
