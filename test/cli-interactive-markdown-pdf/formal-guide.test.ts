import { describe, expect, test } from "bun:test";

import { MARKDOWN_PDF_PAGE_CHROME_POSITIONS } from "../../src/cli/markdown-pdf/profile";

import {
  collectMarkdownPdfFormalGuideAnswers,
  collectMarkdownPdfProfileFormalGuideAnswers,
  compileMarkdownPdfFormalGuideCode,
  compileMarkdownPdfFormalGuideOptions,
  compileMarkdownPdfFormalGuidePageChrome,
  compileMarkdownPdfFormalGuidePageNumbers,
  compileMarkdownPdfFormalGuideProfile,
  reviseMarkdownPdfFormalGuideCode,
  reviseMarkdownPdfFormalGuideLayout,
  reviseMarkdownPdfFormalGuideMargins,
  reviseMarkdownPdfFormalGuidePageChrome,
  reviseMarkdownPdfFormalGuidePageNumbers,
  reviseMarkdownPdfFormalGuideToc,
  type MarkdownPdfFormalGuideAnswers,
  type MarkdownPdfFormalGuidePrompts,
  type MarkdownPdfProfileFormalGuideAnswers,
} from "../../src/cli/interactive/markdown/formal-guide";

const BASE_ANSWERS: MarkdownPdfFormalGuideAnswers = {
  layout: {
    preset: "article",
    pageSize: "A4",
    orientation: { mode: "preset-default" },
  },
  margins: { mode: "preset-default" },
  toc: { enabled: false },
};

const BASE_PROFILE_ANSWERS: MarkdownPdfProfileFormalGuideAnswers = {
  ...BASE_ANSWERS,
  code: {
    highlight: false,
    theme: "github-light",
    lineNumbers: false,
    transformerNotation: false,
  },
  pageNumbers: {
    enabled: false,
    position: "bottom-center",
    format: "{page}",
    scope: "body",
    countFrom: "document",
    start: 1,
    increment: 1,
  },
  pageChrome: {
    header: { left: "", center: "", right: "" },
    footer: { left: "", center: "", right: "" },
  },
};

function createPrompts(
  overrides: Partial<MarkdownPdfFormalGuidePrompts> = {},
): MarkdownPdfFormalGuidePrompts {
  return {
    codeHighlight: () => true,
    codeTheme: () => "github-light",
    codeLineNumbers: () => false,
    codeTransformerNotation: () => false,
    pageNumbersEnabled: () => false,
    pageNumberScope: () => "body",
    pageNumberDetails: () => ({
      position: "bottom-center",
      format: "{page}",
      countFrom: "document",
      start: 1,
      increment: 1,
    }),
    pageChromeArea: () => ({ left: "", center: "", right: "" }),
    layout: () => BASE_ANSWERS.layout,
    margins: () => BASE_ANSWERS.margins,
    tocEnabled: () => false,
    tocDetails: () => ({ depth: 3, pageBreak: "auto" }),
    ...overrides,
  };
}

describe("interactive Markdown PDF formal-guide answers", () => {
  test("collects Profile code highlighting with default-on dependent prompts", async () => {
    const calls: string[] = [];
    const answers = await collectMarkdownPdfProfileFormalGuideAnswers(
      createPrompts({
        codeHighlight: ({ current }) => {
          expect(current).toBeUndefined();
          calls.push("highlight");
          return true;
        },
        codeTheme: ({ current }) => {
          expect(current).toBe("github-light");
          calls.push("theme");
          return "light-plus";
        },
        codeLineNumbers: ({ current }) => {
          expect(current).toBe(false);
          calls.push("line-numbers");
          return true;
        },
        codeTransformerNotation: ({ current }) => {
          expect(current).toBe(false);
          calls.push("transformer-notation");
          return true;
        },
      }),
    );

    expect(answers.code).toEqual({
      highlight: true,
      theme: "light-plus",
      lineNumbers: true,
      transformerNotation: true,
    });
    expect(calls).toEqual(["highlight", "theme", "line-numbers", "transformer-notation"]);
  });

  test("skips dependent Profile code prompts when highlighting is disabled", async () => {
    const answers = await collectMarkdownPdfProfileFormalGuideAnswers(
      createPrompts({
        codeHighlight: () => false,
        codeTheme: () => {
          throw new Error("theme must not be prompted");
        },
        codeLineNumbers: () => {
          throw new Error("line numbers must not be prompted");
        },
        codeTransformerNotation: () => {
          throw new Error("transformer notation must not be prompted");
        },
      }),
    );

    expect(answers.code).toEqual({
      highlight: false,
      theme: "github-light",
      lineNumbers: false,
      transformerNotation: false,
    });
  });

  test("collects layout, margins, and disabled ToC without requesting ToC details", async () => {
    const calls: string[] = [];
    const prompts = createPrompts({
      codeHighlight: () => {
        throw new Error("Profile code must not be prompted");
      },
      pageNumbersEnabled: () => {
        throw new Error("Profile page numbers must not be prompted");
      },
      pageChromeArea: () => {
        throw new Error("Profile page chrome must not be prompted");
      },
      layout: () => {
        calls.push("layout");
        return BASE_ANSWERS.layout;
      },
      margins: ({ layout }) => {
        calls.push(`margins:${layout.preset}`);
        return BASE_ANSWERS.margins;
      },
      tocEnabled: () => {
        calls.push("toc-enabled");
        return false;
      },
      tocDetails: () => {
        calls.push("toc-details");
        return { depth: 4, pageBreak: "before" };
      },
    });

    await expect(collectMarkdownPdfFormalGuideAnswers(prompts)).resolves.toEqual(BASE_ANSWERS);
    expect(calls).toEqual(["layout", "margins:article", "toc-enabled"]);
  });

  test("collects ToC details only when ToC is enabled", async () => {
    const answers = await collectMarkdownPdfFormalGuideAnswers(
      createPrompts({
        tocEnabled: () => true,
        tocDetails: ({ current }) => {
          expect(current).toBeUndefined();
          return { depth: 5, pageBreak: "after" };
        },
      }),
    );

    expect(answers.toc).toEqual({ enabled: true, depth: 5, pageBreak: "after" });
  });

  test("revises only the layout group and retains the other answers", async () => {
    const revised = await reviseMarkdownPdfFormalGuideLayout(
      BASE_ANSWERS,
      createPrompts({
        layout: ({ current }) => {
          expect(current).toEqual(BASE_ANSWERS.layout);
          return {
            preset: "wide-table",
            pageSize: "Tabloid",
            orientation: { mode: "override", value: "portrait" },
          };
        },
        margins: () => {
          throw new Error("margins must not be prompted");
        },
        tocEnabled: () => {
          throw new Error("ToC must not be prompted");
        },
      }),
    );

    expect(revised).toEqual({
      ...BASE_ANSWERS,
      layout: {
        preset: "wide-table",
        pageSize: "Tabloid",
        orientation: { mode: "override", value: "portrait" },
      },
    });
  });

  test("revises only margins with the retained layout context", async () => {
    const revised = await reviseMarkdownPdfFormalGuideMargins(
      BASE_ANSWERS,
      createPrompts({
        layout: () => {
          throw new Error("layout must not be prompted");
        },
        margins: ({ current, layout }) => {
          expect(current).toEqual({ mode: "preset-default" });
          expect(layout).toBe(BASE_ANSWERS.layout);
          return { mode: "uniform", value: "1CM" };
        },
        tocEnabled: () => {
          throw new Error("ToC must not be prompted");
        },
      }),
    );

    expect(revised.margins).toEqual({ mode: "uniform", value: "1CM" });
    expect(revised.layout).toBe(BASE_ANSWERS.layout);
    expect(revised.toc).toBe(BASE_ANSWERS.toc);
  });

  test("revises only ToC and supplies existing enabled details", async () => {
    const answers: MarkdownPdfFormalGuideAnswers = {
      ...BASE_ANSWERS,
      toc: { enabled: true, depth: 2, pageBreak: "before" },
    };
    const revised = await reviseMarkdownPdfFormalGuideToc(
      answers,
      createPrompts({
        layout: () => {
          throw new Error("layout must not be prompted");
        },
        margins: () => {
          throw new Error("margins must not be prompted");
        },
        tocEnabled: ({ current }) => {
          expect(current).toBe(true);
          return true;
        },
        tocDetails: ({ current }) => {
          expect(current).toEqual({ depth: 2, pageBreak: "before" });
          return { depth: 4, pageBreak: "both" };
        },
      }),
    );

    expect(revised.toc).toEqual({ enabled: true, depth: 4, pageBreak: "both" });
    expect(revised.layout).toBe(answers.layout);
    expect(revised.margins).toBe(answers.margins);
  });

  test("retains the theme and disables dependent settings when revising code off", async () => {
    const answers: MarkdownPdfProfileFormalGuideAnswers = {
      ...BASE_PROFILE_ANSWERS,
      code: {
        highlight: true,
        theme: "vitesse-light",
        lineNumbers: true,
        transformerNotation: true,
      },
    };
    const revised = await reviseMarkdownPdfFormalGuideCode(
      answers,
      createPrompts({
        codeHighlight: ({ current }) => {
          expect(current).toBe(true);
          return false;
        },
        codeTheme: () => {
          throw new Error("theme must not be prompted");
        },
        codeLineNumbers: () => {
          throw new Error("line numbers must not be prompted");
        },
        codeTransformerNotation: () => {
          throw new Error("transformer notation must not be prompted");
        },
      }),
    );

    expect(revised.code).toEqual({
      highlight: false,
      theme: "vitesse-light",
      lineNumbers: false,
      transformerNotation: false,
    });
  });

  test("reuses the retained theme and defaults dependent settings off when revising code on", async () => {
    const answers: MarkdownPdfProfileFormalGuideAnswers = {
      ...BASE_PROFILE_ANSWERS,
      code: {
        highlight: false,
        theme: "catppuccin-latte",
        lineNumbers: false,
        transformerNotation: false,
      },
    };
    const revised = await reviseMarkdownPdfFormalGuideCode(
      answers,
      createPrompts({
        codeHighlight: () => true,
        codeTheme: ({ current }) => {
          expect(current).toBe("catppuccin-latte");
          return current!;
        },
        codeLineNumbers: ({ current }) => {
          expect(current).toBe(false);
          return false;
        },
        codeTransformerNotation: ({ current }) => {
          expect(current).toBe(false);
          return false;
        },
      }),
    );

    expect(revised.code).toEqual({
      highlight: true,
      theme: "catppuccin-latte",
      lineNumbers: false,
      transformerNotation: false,
    });
  });

  test("keeps disabled page numbers normalized without requesting dependent details", async () => {
    const answers = await collectMarkdownPdfProfileFormalGuideAnswers(
      createPrompts({
        pageNumbersEnabled: ({ current }) => {
          expect(current).toBeUndefined();
          return false;
        },
        pageNumberScope: () => {
          throw new Error("page-number scope must not be prompted");
        },
        pageNumberDetails: () => {
          throw new Error("page-number details must not be prompted");
        },
      }),
    );

    expect(answers.pageNumbers).toEqual(BASE_PROFILE_ANSWERS.pageNumbers);
  });

  test("collects body-origin numbering with literal zero and both origin choices", async () => {
    const answers = await collectMarkdownPdfProfileFormalGuideAnswers(
      createPrompts({
        pageNumbersEnabled: () => true,
        pageNumberScope: ({ current }) => {
          expect(current).toBe("body");
          return "body";
        },
        pageNumberDetails: ({ countFromChoices, current, scope }) => {
          expect(scope).toBe("body");
          expect(countFromChoices).toEqual(["document", "body"]);
          expect(current?.start).toBe(1);
          return {
            position: "top-left",
            format: "Page {page}",
            countFrom: "body",
            start: 0,
            increment: 2,
          };
        },
      }),
    );

    expect(answers.pageNumbers).toEqual({
      enabled: true,
      position: "top-left",
      format: "Page {page}",
      scope: "body",
      countFrom: "body",
      start: 0,
      increment: 2,
    });
  });

  test("limits document scope collection to document origin", async () => {
    const answers = await collectMarkdownPdfProfileFormalGuideAnswers(
      createPrompts({
        pageNumbersEnabled: () => true,
        pageNumberScope: () => "document",
        pageNumberDetails: ({ countFromChoices, scope }) => {
          expect(scope).toBe("document");
          expect(countFromChoices).toEqual(["document"]);
          return {
            position: "bottom-right",
            format: "{page} / {pages}",
            countFrom: "document",
            start: 1,
            increment: 1,
          };
        },
      }),
    );

    expect(answers.pageNumbers.scope).toBe("document");
    expect(answers.pageNumbers.countFrom).toBe("document");
  });

  test("rejects an injected document-scope body-origin answer during collection", async () => {
    await expect(
      collectMarkdownPdfProfileFormalGuideAnswers(
        createPrompts({
          pageNumbersEnabled: () => true,
          pageNumberScope: () => "document",
          pageNumberDetails: () => ({
            position: "bottom-center",
            format: "{page}",
            countFrom: "body",
            start: 1,
            increment: 1,
          }),
        }),
      ),
    ).rejects.toThrow("scope document cannot be used with countFrom body");
  });

  test("revises only page numbers and preserves disabled zero-valued details", async () => {
    const answers: MarkdownPdfProfileFormalGuideAnswers = {
      ...BASE_PROFILE_ANSWERS,
      pageNumbers: { ...BASE_PROFILE_ANSWERS.pageNumbers, start: 0 },
    };
    const revised = await reviseMarkdownPdfFormalGuidePageNumbers(
      answers,
      createPrompts({
        pageNumbersEnabled: ({ current }) => {
          expect(current).toBe(false);
          return false;
        },
        pageNumberScope: () => {
          throw new Error("page-number scope must not be prompted");
        },
        pageNumberDetails: () => {
          throw new Error("page-number details must not be prompted");
        },
        pageChromeArea: () => {
          throw new Error("page chrome must not be prompted");
        },
      }),
    );

    expect(revised.pageNumbers.enabled).toBe(false);
    expect(revised.pageNumbers.start).toBe(0);
    expect(revised.pageChrome).toBe(answers.pageChrome);
    expect(revised.code).toBe(answers.code);
  });

  test("revises only page chrome with retained header and footer context", async () => {
    const calls: string[] = [];
    const revised = await reviseMarkdownPdfFormalGuidePageChrome(
      BASE_PROFILE_ANSWERS,
      createPrompts({
        pageNumbersEnabled: () => {
          throw new Error("page numbers must not be prompted");
        },
        pageChromeArea: ({ area, current }) => {
          calls.push(area);
          expect(current).toBe(BASE_PROFILE_ANSWERS.pageChrome[area]);
          return area === "header"
            ? { left: "{company}", center: "", right: "{title}" }
            : { left: "{author}", center: "", right: "{date}" };
        },
      }),
    );

    expect(calls).toEqual(["header", "footer"]);
    expect(revised.pageChrome).toEqual({
      header: { left: "{company}", center: "", right: "{title}" },
      footer: { left: "{author}", center: "", right: "{date}" },
    });
    expect(revised.pageNumbers).toBe(BASE_PROFILE_ANSWERS.pageNumbers);
  });

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
