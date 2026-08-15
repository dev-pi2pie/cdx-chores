import { describe, expect, test } from "bun:test";

import { MARKDOWN_PDF_PAGE_CHROME_POSITIONS } from "../../src/cli/markdown-pdf/profile";

import {
  collectMarkdownPdfFormalGuideAnswers,
  collectMarkdownPdfProfileFormalGuideAnswers,
  compileMarkdownPdfFormalGuideCode,
  compileMarkdownPdfFormalGuideCover,
  compileMarkdownPdfFormalGuideOptions,
  compileMarkdownPdfFormalGuidePageChrome,
  compileMarkdownPdfFormalGuidePageNumbers,
  compileMarkdownPdfFormalGuideProfile,
  reviseMarkdownPdfFormalGuideCode,
  reviseMarkdownPdfFormalGuideCover,
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
  cover: {
    enabled: false,
    style: "plain",
    fields: {
      title: "{title}",
      subtitle: "{subtitle}",
      author: "{author}",
      company: "{company}",
      date: "{date}",
    },
  },
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
    coverEnabled: () => false,
    codeHighlight: () => true,
    codeTheme: () => "github-light",
    codeLineNumbers: () => false,
    codeTransformerNotation: () => false,
    pageNumbersEnabled: () => false,
    pageNumberOutcome: () => "body",
    pageNumberLabel: () => "Page {page}",
    pageNumberPosition: () => "bottom-center",
    repeatingContentEnabled: () => false,
    repeatingContentPositions: () => [],
    repeatingContent: () => "",
    clearOccupiedPageNumberPosition: () => false,
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

  test("collects a disabled cover with the complete normalized defaults before ToC", async () => {
    const calls: string[] = [];
    const answers = await collectMarkdownPdfProfileFormalGuideAnswers(
      createPrompts({
        layout: () => {
          calls.push("layout");
          return BASE_ANSWERS.layout;
        },
        margins: () => {
          calls.push("margins");
          return BASE_ANSWERS.margins;
        },
        coverEnabled: ({ current }) => {
          expect(current).toBeUndefined();
          calls.push("cover");
          return false;
        },
        tocEnabled: () => {
          calls.push("toc");
          return false;
        },
      }),
    );

    expect(calls).toEqual(["layout", "margins", "cover", "toc"]);
    expect(answers.cover).toEqual(BASE_PROFILE_ANSWERS.cover);
  });

  test("revises cover enablement without replacing advanced style or field values", async () => {
    const answers: MarkdownPdfProfileFormalGuideAnswers = {
      ...BASE_PROFILE_ANSWERS,
      cover: {
        enabled: false,
        style: "report",
        fields: {
          title: "Report: {title}",
          subtitle: "Prepared for {company}",
          author: "{author}",
          company: "{company}",
          date: "{date}",
        },
      },
    };

    const revised = await reviseMarkdownPdfFormalGuideCover(
      answers,
      createPrompts({
        coverEnabled: ({ current }) => {
          expect(current).toBe(false);
          return true;
        },
      }),
    );

    expect(revised.cover).toEqual({ ...answers.cover, enabled: true });
    expect(revised.pageNumbers).toBe(answers.pageNumbers);
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
      repeatingContent: () => {
        throw new Error("Profile repeating content must not be prompted");
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
        pageNumberOutcome: () => {
          throw new Error("page-number outcome must not be prompted");
        },
        pageNumberPosition: () => {
          throw new Error("page-number position must not be prompted");
        },
      }),
    );

    expect(answers.pageNumbers).toEqual(BASE_PROFILE_ANSWERS.pageNumbers);
  });

  test.each([
    [
      "body",
      {
        enabled: true,
        position: "top-left",
        format: "Page {page}",
        scope: "body",
        countFrom: "body",
        start: 1,
        increment: 1,
      },
    ],
    [
      "document",
      {
        enabled: true,
        position: "top-left",
        format: "Page {page}",
        scope: "document",
        countFrom: "document",
        start: 1,
        increment: 1,
      },
    ],
  ] as const)("maps the %s guided outcome to fixed Profile values", async (outcome, expected) => {
    const answers = await collectMarkdownPdfProfileFormalGuideAnswers(
      createPrompts({
        pageNumbersEnabled: () => true,
        pageNumberOutcome: ({ current }) => {
          expect(current).toBeUndefined();
          return outcome;
        },
        pageNumberLabel: ({ current }) => {
          expect(current).toBeUndefined();
          return "Page {page}";
        },
        pageNumberPosition: ({ current }) => {
          expect(current).toBe("bottom-center");
          return "top-left";
        },
      }),
    );

    expect(answers.pageNumbers).toEqual(expected);
  });

  test("disables page numbers without losing non-default inert values or page chrome", async () => {
    const answers: MarkdownPdfProfileFormalGuideAnswers = {
      ...BASE_PROFILE_ANSWERS,
      pageNumbers: {
        enabled: true,
        position: "top-right",
        format: "Page {page} of {pages}",
        scope: "body",
        countFrom: "document",
        start: 0,
        increment: 3,
      },
      pageChrome: {
        header: { left: "Report", center: "", right: "Existing" },
        footer: { left: "", center: "Footer", right: "" },
      },
    };
    const revised = await reviseMarkdownPdfFormalGuidePageNumbers(
      answers,
      createPrompts({
        pageNumbersEnabled: ({ current }) => {
          expect(current).toBe(true);
          return false;
        },
        pageNumberOutcome: () => {
          throw new Error("page-number outcome must not be prompted");
        },
        pageNumberPosition: () => {
          throw new Error("page-number position must not be prompted");
        },
        pageNumberLabel: () => {
          throw new Error("page-number label must not be prompted");
        },
      }),
    );

    expect(revised.pageNumbers).toEqual({
      ...answers.pageNumbers,
      enabled: false,
    });
    expect(revised.pageChrome).toBe(answers.pageChrome);
    expect(revised.code).toBe(answers.code);
  });

  test.each([
    { initiallyEnabled: true, state: "enabled" },
    { initiallyEnabled: false, state: "disabled" },
  ])(
    "resets advanced arithmetic while preserving a guided custom label from the $state state",
    async ({ initiallyEnabled }) => {
      const answers: MarkdownPdfProfileFormalGuideAnswers = {
        ...BASE_PROFILE_ANSWERS,
        pageNumbers: {
          enabled: initiallyEnabled,
          position: "top-right",
          format: "Page {page} of {pages}",
          scope: "body",
          countFrom: "document",
          start: 0,
          increment: 3,
        },
        pageChrome: {
          header: { left: "Report", center: "", right: "Existing" },
          footer: { left: "", center: "Footer", right: "" },
        },
      };
      const revised = await reviseMarkdownPdfFormalGuidePageNumbers(
        answers,
        createPrompts({
          pageNumbersEnabled: ({ current }) => {
            expect(current).toBe(initiallyEnabled);
            return true;
          },
          pageNumberOutcome: ({ current }) => {
            expect(current).toBeUndefined();
            return "body";
          },
          pageNumberLabel: ({ current }) => {
            expect(current).toBe("Page {page} of {pages}");
            return current!;
          },
          pageNumberPosition: ({ current }) => {
            expect(current).toBe("top-right");
            return "bottom-left";
          },
        }),
      );

      expect(revised.pageNumbers).toEqual({
        enabled: true,
        position: "bottom-left",
        format: "Page {page} of {pages}",
        scope: "body",
        countFrom: "body",
        start: 1,
        increment: 1,
      });
      expect(revised.pageChrome).toBe(answers.pageChrome);
    },
  );

  test("collects selected repeating-content positions across the six-position layout", async () => {
    const calls: string[] = [];
    const answers = await collectMarkdownPdfProfileFormalGuideAnswers(
      createPrompts({
        repeatingContentEnabled: ({ current }) => {
          expect(current).toBeUndefined();
          return true;
        },
        repeatingContentPositions: ({ available, current }) => {
          expect(current).toBeUndefined();
          expect(available).toEqual(MARKDOWN_PDF_PAGE_CHROME_POSITIONS);
          return ["top-left", "top-right", "bottom-left", "bottom-right"];
        },
        repeatingContent: ({ current, position }) => {
          expect(current).toBeUndefined();
          calls.push(position);
          const content: Record<(typeof MARKDOWN_PDF_PAGE_CHROME_POSITIONS)[number], string> = {
            "top-left": "{company}",
            "top-center": "",
            "top-right": "{title}",
            "bottom-left": "{author}",
            "bottom-center": "",
            "bottom-right": "{date}",
          };
          return content[position];
        },
      }),
    );

    expect(calls).toEqual(["top-left", "top-right", "bottom-left", "bottom-right"]);
    expect(answers.pageChrome.header).toEqual({
      left: "{company}",
      center: "",
      right: "{title}",
    });
    expect(answers.pageChrome.footer).toEqual({
      left: "{author}",
      center: "",
      right: "{date}",
    });
  });

  test.each([...MARKDOWN_PDF_PAGE_CHROME_POSITIONS])(
    "reserves the fresh enabled page-number position at %s",
    async (position) => {
      let available: readonly string[] = [];
      await collectMarkdownPdfProfileFormalGuideAnswers(
        createPrompts({
          pageNumbersEnabled: () => true,
          pageNumberOutcome: () => "body",
          pageNumberPosition: () => position,
          repeatingContentEnabled: () => true,
          repeatingContentPositions: (context) => {
            available = context.available;
            expect(context.reserved).toBe(position);
            return [];
          },
        }),
      );

      expect(available).toEqual(
        MARKDOWN_PDF_PAGE_CHROME_POSITIONS.filter((candidate) => candidate !== position),
      );
    },
  );

  test("preserves styles while clearing unselected repeating content during revision", async () => {
    const headerStyle = { fontSize: "8pt" } as const;
    const footerStyle = { color: "#123456" } as const;
    const current: MarkdownPdfProfileFormalGuideAnswers = {
      ...BASE_PROFILE_ANSWERS,
      pageChrome: {
        header: { left: "Header", center: "", right: "", style: headerStyle },
        footer: { left: "Footer", center: "", right: "", style: footerStyle },
      },
    };
    const revised = await reviseMarkdownPdfFormalGuidePageChrome(
      current,
      createPrompts({
        repeatingContentEnabled: ({ current }) => {
          expect(current).toBe(true);
          return true;
        },
        repeatingContentPositions: ({ available, current }) => {
          expect(available).toEqual(MARKDOWN_PDF_PAGE_CHROME_POSITIONS);
          expect(current).toEqual(["top-left", "bottom-left"]);
          return ["top-left"];
        },
        repeatingContent: ({ current, position }) => {
          expect(position).toBe("top-left");
          expect(current).toBe("Header");
          return "Revised";
        },
      }),
    );

    expect(revised.pageChrome).toEqual({
      header: { left: "Revised", center: "", right: "", style: headerStyle },
      footer: { left: "", center: "", right: "", style: footerStyle },
    });
    expect(revised.pageNumbers).toBe(current.pageNumbers);
  });

  test.each([{ clear: false }, { clear: true }])(
    "uses explicit clear=$clear for an occupied revised page-number position",
    async ({ clear }) => {
      const current: MarkdownPdfProfileFormalGuideAnswers = {
        ...BASE_PROFILE_ANSWERS,
        pageNumbers: { ...BASE_PROFILE_ANSWERS.pageNumbers, enabled: true },
        pageChrome: {
          ...BASE_PROFILE_ANSWERS.pageChrome,
          footer: { left: "", center: "Existing", right: "" },
        },
      };
      const revised = await reviseMarkdownPdfFormalGuidePageChrome(
        current,
        createPrompts({
          repeatingContentEnabled: ({ current }) => {
            expect(current).toBe(true);
            return true;
          },
          clearOccupiedPageNumberPosition: ({ current, position }) => {
            expect(current).toBe("Existing");
            expect(position).toBe("bottom-center");
            return clear;
          },
          repeatingContentPositions: ({ available, current, reserved }) => {
            expect(available).toEqual([
              "top-left",
              "top-center",
              "top-right",
              "bottom-left",
              "bottom-right",
            ]);
            expect(current).toEqual([]);
            expect(reserved).toBe("bottom-center");
            return [];
          },
        }),
      );

      expect(revised.pageChrome.footer.center).toBe(clear ? "" : "Existing");
    },
  );

  test("rejects a repeating-content position that is owned by enabled page numbering", async () => {
    await expect(
      collectMarkdownPdfProfileFormalGuideAnswers(
        createPrompts({
          pageNumbersEnabled: () => true,
          pageNumberOutcome: () => "body",
          pageNumberPosition: () => "bottom-center",
          repeatingContentEnabled: () => true,
          repeatingContentPositions: () => ["bottom-center"],
        }),
      ),
    ).rejects.toThrow("Repeating-content position is not available: bottom-center");
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
