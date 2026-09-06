import { describe, expect, test } from "bun:test";

import { MARKDOWN_PDF_PAGE_CHROME_POSITIONS } from "../../../src/cli/markdown-pdf/profile";

import {
  compileMarkdownPdfFormalGuideCode,
  compileMarkdownPdfFormalGuideCover,
  compileMarkdownPdfFormalGuideOptions,
  compileMarkdownPdfFormalGuidePageChrome,
  compileMarkdownPdfFormalGuidePageNumbers,
  compileMarkdownPdfFormalGuideProfile,
  type MarkdownPdfProfileFormalGuideAnswers,
} from "../../../src/cli/interactive/markdown/formal-guide";

import { BASE_ANSWERS, BASE_PROFILE_ANSWERS } from "./formal-guide-fixtures";

describe("interactive Markdown PDF formal-guide compilation", () => {
  test("omits preset-derived orientation, margins, and disabled ToC details", () => {
    expect(compileMarkdownPdfFormalGuideOptions(BASE_ANSWERS)).toEqual({
      preset: "article",
      pageSize: "A4",
      toc: false,
    });
  });

  test("compiles explicit orientation, uniform margins, and enabled ToC details", () => {
    expect(
      compileMarkdownPdfFormalGuideOptions({
        layout: {
          preset: "wide-table",
          pageSize: "Legal",
          orientation: { mode: "override", value: "portrait" },
        },
        margins: { mode: "uniform", value: "1CM" },
        toc: { enabled: true, depth: 4, pageBreak: "before" },
      }),
    ).toEqual({
      preset: "wide-table",
      pageSize: "Legal",
      orientation: "portrait",
      margin: "1cm",
      toc: true,
      tocDepth: 4,
      tocPageBreak: "before",
    });
  });

  test("compiles all reusable Profile code fields and omits Profile groups for Template answers", () => {
    expect(
      compileMarkdownPdfFormalGuideCode({
        ...BASE_PROFILE_ANSWERS,
        code: {
          highlight: true,
          theme: "min-light",
          lineNumbers: true,
          transformerNotation: true,
        },
      }),
    ).toEqual({
      highlight: true,
      theme: "min-light",
      lineNumbers: true,
      transformerNotation: true,
    });
    expect(BASE_ANSWERS).not.toHaveProperty("code");
    expect(BASE_ANSWERS).not.toHaveProperty("pageNumbers");
    expect(BASE_ANSWERS).not.toHaveProperty("pageChrome");
  });

  test("compiles the complete Profile cover state", () => {
    expect(compileMarkdownPdfFormalGuideCover(BASE_PROFILE_ANSWERS.cover)).toEqual(
      BASE_PROFILE_ANSWERS.cover,
    );
  });

  test("compiles every shared page-number position and preserves false and start zero", () => {
    for (const position of MARKDOWN_PDF_PAGE_CHROME_POSITIONS) {
      expect(
        compileMarkdownPdfFormalGuidePageNumbers({
          enabled: false,
          position,
          format: "Page {page}",
          scope: "body",
          countFrom: "document",
          start: 0,
          increment: 1,
        }),
      ).toEqual({
        enabled: false,
        position,
        format: "Page {page}",
        scope: "body",
        countFrom: "document",
        start: 0,
        increment: 1,
      });
    }
  });

  test("compiles bounded header and footer style into the shared Profile contract", () => {
    const answers: MarkdownPdfProfileFormalGuideAnswers = {
      ...BASE_PROFILE_ANSWERS,
      pageNumbers: {
        enabled: true,
        position: "top-right",
        format: "Page {page}",
        scope: "body",
        countFrom: "body",
        start: 0,
        increment: 2,
      },
      pageChrome: {
        header: {
          left: "{company}",
          center: "",
          right: "{title}",
          style: {
            fontSize: "6pt",
            fontWeight: 400,
            lineHeight: 1,
            color: "#667085",
            separator: {
              width: "0.25pt",
              style: "solid",
              color: "#d0d5dd",
              gap: 0,
            },
          },
        },
        footer: {
          left: "{author}",
          center: "",
          right: "{date}",
          style: {
            fontSize: "12pt",
            fontWeight: 700,
            lineHeight: 2,
            color: "#000000",
            separator: {
              width: "2pt",
              style: "solid",
              color: "#ffffff",
              gap: "4mm",
            },
          },
        },
      },
    };

    expect(compileMarkdownPdfFormalGuidePageChrome(answers.pageChrome)).toEqual(answers.pageChrome);
    expect(compileMarkdownPdfFormalGuideProfile(answers)).toEqual({
      code: answers.code,
      cover: answers.cover,
      pageNumbers: answers.pageNumbers,
      header: answers.pageChrome.header,
      footer: answers.pageChrome.footer,
    });
  });

  test("rejects invalid page-number combinations and out-of-range page chrome on compile", () => {
    expect(() =>
      compileMarkdownPdfFormalGuidePageNumbers({
        ...BASE_PROFILE_ANSWERS.pageNumbers,
        enabled: true,
        scope: "document",
        countFrom: "body",
      }),
    ).toThrow("scope document cannot be used with countFrom body");

    expect(() =>
      compileMarkdownPdfFormalGuidePageChrome({
        ...BASE_PROFILE_ANSWERS.pageChrome,
        header: {
          ...BASE_PROFILE_ANSWERS.pageChrome.header,
          style: { fontSize: "5.9pt" },
        },
      }),
    ).toThrow("fontSize must be a pt length from 6pt through 12pt");
  });

  test("compiles and normalizes four custom margin edges", () => {
    expect(
      compileMarkdownPdfFormalGuideOptions({
        ...BASE_ANSWERS,
        margins: {
          mode: "custom",
          top: "10MM",
          right: "1cm",
          bottom: "0",
          left: ".5IN",
        },
      }),
    ).toEqual({
      preset: "article",
      pageSize: "A4",
      marginTop: "10mm",
      marginRight: "1cm",
      marginBottom: "0",
      marginLeft: ".5in",
      toc: false,
    });
  });

  test("reuses normalized option validation for invalid guide values", () => {
    expect(() =>
      compileMarkdownPdfFormalGuideOptions({
        ...BASE_ANSWERS,
        margins: { mode: "uniform", value: "calc(1cm + 2mm)" },
      }),
    ).toThrow("Margin must be a CSS length");

    expect(() =>
      compileMarkdownPdfFormalGuideOptions({
        ...BASE_ANSWERS,
        toc: { enabled: true, depth: 7, pageBreak: "auto" },
      }),
    ).toThrow("ToC depth must be an integer from 1 to 6");
  });
});
