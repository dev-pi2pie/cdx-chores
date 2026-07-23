import { describe, expect, test } from "bun:test";

import {
  collectMarkdownPdfFormalGuideAnswers,
  collectMarkdownPdfProfileFormalGuideAnswers,
  compileMarkdownPdfFormalGuideCode,
  compileMarkdownPdfFormalGuideOptions,
  reviseMarkdownPdfFormalGuideCode,
  reviseMarkdownPdfFormalGuideLayout,
  reviseMarkdownPdfFormalGuideMargins,
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

function createPrompts(
  overrides: Partial<MarkdownPdfFormalGuidePrompts> = {},
): MarkdownPdfFormalGuidePrompts {
  return {
    codeHighlight: () => true,
    codeTheme: () => "github-light",
    codeLineNumbers: () => false,
    codeTransformerNotation: () => false,
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
      ...BASE_ANSWERS,
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
      ...BASE_ANSWERS,
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

  test("compiles all reusable Profile code fields and omits them for Template answers", () => {
    expect(
      compileMarkdownPdfFormalGuideCode({
        ...BASE_ANSWERS,
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
