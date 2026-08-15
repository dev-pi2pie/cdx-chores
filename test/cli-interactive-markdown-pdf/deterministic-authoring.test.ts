import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "../cli-interactive-routing.helpers";

const RECIPES_ENTRY = ["md", "md:pdf-recipes"];
const TO_PDF_ENTRY = ["md", "md:to-pdf"];

describe("interactive Markdown PDF deterministic authoring", () => {
  test("prepares, reviews, binds, and saves one starter Profile", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...RECIPES_ENTRY, "profile", "starter", "save", "exit"],
      requiredPathQueue: ["recipes/report.yml"],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfDeterministicPrepareCalls).toEqual([
      expect.objectContaining({
        artifact: "profile",
        preparation: "starter",
        candidateId: "deterministic-1",
      }),
    ]);
    expect(result.markdownPdfDeterministicBindCalls).toEqual([
      expect.objectContaining({
        artifact: "profile",
        candidateId: "deterministic-1",
        output: "recipes/report.yml",
        overwrite: false,
      }),
    ]);
    expect(result.markdownPdfDeterministicWriteCalls).toEqual([
      { artifact: "profile", candidateId: "deterministic-1" },
    ]);
    expect(result.stderr.indexOf("Markdown PDF recipe review")).toBeLessThan(
      result.stderr.indexOf("Final recipe save review"),
    );
    expect(result.stdout).toContain("Wrote Markdown PDF profile: recipes/report.yml");
  });

  test("uses the same starter preparation path for a durable Template bundle", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...RECIPES_ENTRY, "template-bundle", "starter", "save", "exit"],
      requiredPathQueue: ["recipes/report-template"],
      confirmQueue: [true, true],
    });

    expect(result.markdownPdfDeterministicPrepareCalls[0]).toMatchObject({
      artifact: "template-bundle",
      preparation: "starter",
    });
    expect(result.markdownPdfDeterministicBindCalls[0]).toMatchObject({
      output: "recipes/report-template",
      overwrite: true,
    });
    expect(result.markdownPdfDeterministicWriteCalls).toEqual([
      { artifact: "template-bundle", candidateId: "deterministic-1" },
    ]);
    expect(result.stderr).toContain("template.html");
    expect(result.stderr).toContain("style.css");
  });

  test("revises one formal-guide group and prepares only the revised candidate", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...RECIPES_ENTRY,
        "profile",
        "formal-guide",
        "wide-table",
        "Letter",
        "preset-default",
        "uniform",
        4,
        "after",
        "github-light",
        "revise-margins",
        "custom",
        "save",
        "exit",
      ],
      inputQueue: ["15mm", "10mm", "11mm", "12mm", "13mm"],
      requiredPathQueue: ["recipes/formal.json"],
      confirmQueue: [true, true, false, false, false, false, true, true],
    });

    expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(2);
    expect(result.markdownPdfDeterministicPrepareCalls[0]).toMatchObject({
      options: {
        preset: "wide-table",
        pageSize: "Letter",
        margin: "15mm",
        toc: true,
        tocDepth: 4,
        tocPageBreak: "after",
      },
    });
    expect(result.markdownPdfDeterministicPrepareCalls[1]).toMatchObject({
      options: {
        preset: "wide-table",
        pageSize: "Letter",
        marginTop: "10mm",
        marginRight: "11mm",
        marginBottom: "12mm",
        marginLeft: "13mm",
        toc: true,
        tocDepth: 4,
        tocPageBreak: "after",
      },
    });
    expect(result.markdownPdfDeterministicPrepareCalls[1]?.options).not.toHaveProperty(
      "orientation",
    );
    expect(result.markdownPdfDeterministicWriteCalls[0]?.candidateId).toBe("deterministic-2");
    const formalGuideMessages = new Set([
      "Document preset",
      "Page size",
      "Page orientation",
      "Page margins",
      "Uniform page margin",
      "Include a table of contents?",
      "Table of contents depth",
      "Table of contents page break",
      "Enable code highlighting in this Profile?",
      "Theme",
      "Show line numbers in highlighted code blocks?",
      "Enable transformer notation in highlighted code blocks?",
      "Top margin",
      "Right margin",
      "Bottom margin",
      "Left margin",
    ]);
    expect(
      result.promptCalls
        .map((call) => call.message)
        .filter((message) => formalGuideMessages.has(message)),
    ).toEqual([
      "Document preset",
      "Page size",
      "Page orientation",
      "Page margins",
      "Uniform page margin",
      "Include a table of contents?",
      "Table of contents depth",
      "Table of contents page break",
      "Enable code highlighting in this Profile?",
      "Theme",
      "Show line numbers in highlighted code blocks?",
      "Enable transformer notation in highlighted code blocks?",
      "Page margins",
      "Top margin",
      "Right margin",
      "Bottom margin",
      "Left margin",
    ]);
    expect(
      result.selectChoicesByMessage["Page orientation"]?.map((choice) => choice.value),
    ).toEqual(["preset-default", "portrait", "landscape"]);
    expect(result.selectChoicesByMessage["Page margins"]?.map((choice) => choice.value)).toEqual([
      "preset-default",
      "uniform",
      "custom",
    ]);
    expect(
      result.selectChoicesByMessage["Table of contents depth"]?.map((choice) => choice.value),
    ).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(
      result.selectChoicesByMessage["Table of contents page break"]?.map((choice) => choice.value),
    ).toEqual(["auto", "none", "before", "after", "both"]);
    expect(result.selectChoicesByMessage["Theme"]?.map((choice) => choice.value)).toEqual([
      "github-light",
      "light-plus",
      "min-light",
      "vitesse-light",
      "catppuccin-latte",
    ]);
  });

  test("collects, reviews, and revises Profile-only code highlighting", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...RECIPES_ENTRY,
        "profile",
        "formal-guide",
        "article",
        "A4",
        "preset-default",
        "preset-default",
        "light-plus",
        "revise-code",
        "cancel",
      ],
      confirmQueue: [false, true, true, true, false, false, false],
    });

    expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(2);
    expect(result.markdownPdfDeterministicPrepareCalls[0]?.formalGuideAnswers).toMatchObject({
      code: {
        highlight: true,
        theme: "light-plus",
        lineNumbers: true,
        transformerNotation: true,
      },
    });
    expect(result.markdownPdfDeterministicPrepareCalls[1]?.formalGuideAnswers).toMatchObject({
      code: {
        highlight: false,
        theme: "light-plus",
        lineNumbers: false,
        transformerNotation: false,
      },
    });
    expect(result.stderr).toContain("Reusable Profile settings:");
    expect(result.stderr).toContain("- Code highlighting theme: light-plus");
    expect(result.stderr).toContain("- Code highlighting theme: light-plus (used when enabled)");
    expect(
      result.selectChoicesByMessage["Recipe review next step"]?.map((choice) => choice.value),
    ).toContain("revise-code");
  });

  test("reviews and revises normalized Profile page policy with advisory requirements", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...RECIPES_ENTRY,
        "profile",
        "formal-guide",
        "article",
        "A4",
        "preset-default",
        "preset-default",
        "body",
        "custom",
        "bottom-center",
        "revise-page-numbers",
        "document",
        "custom",
        "top-left",
        "save",
        "exit",
      ],
      checkboxQueue: [["top-left"]],
      inputQueue: ["Page {page} for {company}", "Existing header", "Page {page} of {pages}"],
      requiredPathQueue: ["recipes/page-policy.yml"],
      confirmQueue: [false, false, true, true, true, false, true],
    });

    expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(2);
    const firstAnswers = result.markdownPdfDeterministicPrepareCalls[0]
      ?.formalGuideAnswers as Record<string, unknown>;
    const secondAnswers = result.markdownPdfDeterministicPrepareCalls[1]
      ?.formalGuideAnswers as Record<string, unknown>;
    expect(firstAnswers.pageNumbers).toEqual({
      enabled: true,
      scope: "body",
      countFrom: "body",
      start: 1,
      increment: 1,
      position: "bottom-center",
      format: "Page {page} for {company}",
    });
    expect(firstAnswers.pageChrome).toEqual({
      header: {
        left: "Existing header",
        center: "",
        right: "",
      },
      footer: { left: "", center: "", right: "" },
    });
    expect(secondAnswers.pageNumbers).toEqual({
      enabled: true,
      scope: "document",
      countFrom: "document",
      start: 1,
      increment: 1,
      position: "top-left",
      format: "Page {page} of {pages}",
    });
    expect(secondAnswers.pageChrome).toEqual({
      header: {
        left: "Existing header",
        center: "",
        right: "",
      },
      footer: { left: "", center: "", right: "" },
    });
    expect(result.stderr).toContain("Reusable Profile page numbering:");
    expect(result.stderr).toContain("- Start: 1");
    expect(result.stderr).toContain("- Increment: 1");
    expect(result.stderr).toContain("Reusable Profile repeating page content:");
    expect(result.stderr.match(/replace configured header\.left content/g)).toHaveLength(1);
    expect(result.stderr).not.toContain("installed");
    expect(result.stderr).not.toContain("conditionId");
    expect(result.stderr).not.toContain("readiness");
    expect(
      result.promptCalls
        .map((call) => call.message)
        .filter((message) =>
          [
            "Enable reusable page numbers in this Profile?",
            "Number which pages?",
            "Page-number label",
            "Page-number position",
            "Add repeating header or footer text?",
            "Repeating-content positions (page number uses footer center)",
            "Header left content",
          ].includes(message),
        ),
    ).toEqual([
      "Enable reusable page numbers in this Profile?",
      "Number which pages?",
      "Page-number label",
      "Page-number position",
      "Add repeating header or footer text?",
      "Repeating-content positions (page number uses footer center)",
      "Header left content",
      "Enable reusable page numbers in this Profile?",
      "Number which pages?",
      "Page-number label",
      "Page-number position",
    ]);
    expect(result.promptCalls.map((call) => call.message)).not.toContain(
      "Page-number label template",
    );
    expect(result.promptCalls.map((call) => call.message)).not.toContain("First page number");
    expect(result.promptCalls.map((call) => call.message)).not.toContain("Page-number increment");
    expect(
      result.promptCalls.filter((call) => call.message === "Custom page-number label"),
    ).toEqual([
      { kind: "input", message: "Custom page-number label" },
      {
        kind: "input",
        message: "Custom page-number label",
        defaultValue: "Page {page} for {company}",
      },
    ]);
    expect(result.markdownPdfDeterministicWriteCalls).toEqual([
      { artifact: "profile", candidateId: "deterministic-2" },
    ]);
  });

  test("dispatches page-chrome revision without changing other formal-guide groups", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...RECIPES_ENTRY,
        "profile",
        "formal-guide",
        "article",
        "A4",
        "preset-default",
        "preset-default",
        "revise-page-chrome",
        "cancel",
      ],
      checkboxQueue: [
        ["top-left", "top-right", "bottom-left", "bottom-right"],
        ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"],
      ],
      inputQueue: [
        "Initial header",
        "{title}",
        "Initial footer",
        "{date}",
        "Revised header",
        "{company}",
        "{title}",
        "Revised footer",
        "{author}",
        "{date}",
      ],
      confirmQueue: [false, false, false, true, true],
    });

    expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(2);
    const initial = result.markdownPdfDeterministicPrepareCalls[0]?.formalGuideAnswers as Record<
      string,
      unknown
    >;
    const revised = result.markdownPdfDeterministicPrepareCalls[1]?.formalGuideAnswers as Record<
      string,
      unknown
    >;
    for (const group of ["layout", "margins", "toc", "code", "pageNumbers"] as const) {
      expect(revised[group]).toEqual(initial[group]);
    }
    expect(initial.pageChrome).toEqual({
      header: { left: "Initial header", center: "", right: "{title}" },
      footer: { left: "Initial footer", center: "", right: "{date}" },
    });
    expect(revised.pageChrome).toEqual({
      header: { left: "Revised header", center: "{company}", right: "{title}" },
      footer: { left: "Revised footer", center: "{author}", right: "{date}" },
    });
    expect(result.markdownPdfDeterministicBindCalls).toEqual([]);
    expect(result.markdownPdfDeterministicWriteCalls).toEqual([]);
    expect(result.stderr).not.toContain("replace configured footer.center content");
  });

  test("keeps Template formal-guide prompts and review free of reusable Profile settings", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...RECIPES_ENTRY,
        "template-bundle",
        "formal-guide",
        "article",
        "A4",
        "preset-default",
        "preset-default",
        "cancel",
      ],
      confirmQueue: [false],
    });

    expect(result.markdownPdfDeterministicPrepareCalls[0]).not.toHaveProperty(
      "formalGuideAnswers.code",
    );
    expect(
      result.promptCalls.some(
        (call) => call.message === "Enable code highlighting in this Profile?",
      ),
    ).toBe(false);
    expect(result.stderr).not.toContain("Reusable Profile settings:");
    expect(result.stderr).not.toContain("Reusable Profile page numbering:");
    expect(result.stderr).not.toContain("Advisory renderer capability requirements:");
    expect(
      result.selectChoicesByMessage["Recipe review next step"]?.map((choice) => choice.value),
    ).not.toContain("revise-code");
    expect(
      result.selectChoicesByMessage["Recipe review next step"]?.map((choice) => choice.value),
    ).not.toContain("revise-page-numbers");
    expect(
      result.selectChoicesByMessage["Recipe review next step"]?.map((choice) => choice.value),
    ).not.toContain("revise-page-chrome");
  });

  test("changes durable output without preparing the candidate again", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...RECIPES_ENTRY, "profile", "starter", "save", "change-output", "exit"],
      requiredPathQueue: ["recipes/first.yml", "recipes/final.yml"],
      confirmQueue: [false, false, true, true],
    });

    expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicBindCalls.map((call) => call.candidateId)).toEqual([
      "deterministic-1",
      "deterministic-1",
    ]);
    expect(result.markdownPdfDeterministicWriteCalls).toEqual([
      { artifact: "profile", candidateId: "deterministic-1" },
    ]);
  });

  test("returns from a declined final save to the same reviewed candidate", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...RECIPES_ENTRY, "profile", "starter", "save", "review", "cancel"],
      requiredPathQueue: ["recipes/report.yml"],
      confirmQueue: [false, false],
    });

    expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicBindCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicWriteCalls).toEqual([]);
    expect(result.stderr.match(/Markdown PDF recipe review/g)).toHaveLength(2);
  });

  test("recovers from a destination error without discarding the candidate", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfDeterministicBindErrorMessage: "Output already exists",
      selectQueue: [...RECIPES_ENTRY, "profile", "starter", "save", "change-output", "exit"],
      requiredPathQueue: ["recipes/existing.yml", "recipes/final.yml"],
      confirmQueue: [false, true, true],
    });

    expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicBindCalls.map((call) => call.candidateId)).toEqual([
      "deterministic-1",
      "deterministic-1",
    ]);
    expect(result.markdownPdfDeterministicWriteCalls).toEqual([
      { artifact: "profile", candidateId: "deterministic-1" },
    ]);
    expect(result.stderr).toContain("Unable to save recipe: Output already exists");
    expect(result.promptCalls).toContainEqual({
      kind: "select",
      message: "Recipe save recovery",
    });
  });

  test("changes preparation mode explicitly without changing the artifact", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...RECIPES_ENTRY, "profile", "starter", "change-mode", "back", "cancel"],
    });

    expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(1);
    expect(
      result.promptCalls.filter((call) => call.message === "Choose preparation mode"),
    ).toHaveLength(2);
    expect(result.markdownPdfDeterministicBindCalls).toEqual([]);
  });

  test("changes the artifact explicitly before preparing a replacement candidate", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...RECIPES_ENTRY,
        "profile",
        "starter",
        "change-artifact",
        "template-bundle",
        "starter",
        "cancel",
      ],
    });

    expect(result.markdownPdfDeterministicPrepareCalls.map((call) => call.artifact)).toEqual([
      "profile",
      "template-bundle",
    ]);
    expect(result.markdownPdfDeterministicBindCalls).toEqual([]);
  });

  test("adds Phase 5 Project and Codex choices without preparing a deterministic candidate", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...RECIPES_ENTRY, "profile", "back", "cancel"],
    });

    expect(
      result.selectChoicesByMessage["What would you like to create?"]?.map(
        (choice) => choice.value,
      ),
    ).toEqual(["profile", "template-bundle", "project-bundle", "back", "cancel"]);
    expect(
      result.selectChoicesByMessage["Choose preparation mode"]?.map((choice) => choice.value),
    ).toEqual(["starter", "formal-guide", "codex-assistant", "back", "cancel"]);
    expect(result.markdownPdfDeterministicPrepareCalls).toEqual([]);
  });

  test("materializes and renders a temporary deterministic Profile with an enabled override", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "profile",
        "starter",
        "temporary-render",
        "enable",
        "enable",
        "default",
      ],
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicBindCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicWriteCalls).toEqual([
      { artifact: "profile", candidateId: "deterministic-1" },
    ]);
    expect(result.markdownPdfPrepareCalls).toEqual([
      expect.objectContaining({ codeHighlight: true, pageNumbers: true }),
    ]);
    expect(result.markdownPdfExecuteCalls).toHaveLength(1);
    expect(result.stderr).toContain("Render override:\n- Enable for this render");
    expect(result.stderr).toContain("Effective render:");
    expect(result.stderr).toContain("- Highlighting: enabled");
    expect(result.stderr).toContain("Page numbers:");
    expect(result.stderr).toContain("- One-render override: enable for this PDF");
    expect(result.stdout).toContain("Wrote PDF:");
  });

  test("saves and renders a durable deterministic Template with a disabled override", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "template-bundle",
        "starter",
        "save-and-render",
        "disable",
        "disable",
        "custom",
        "default",
      ],
      requiredPathQueue: ["fixtures/report.md", "recipes/durable-template"],
      confirmQueue: [false, false, true],
    });

    expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicBindCalls).toEqual([
      expect.objectContaining({ output: "recipes/durable-template", overwrite: false }),
    ]);
    expect(result.markdownPdfDeterministicWriteCalls).toHaveLength(1);
    expect(result.markdownPdfPrepareCalls).toEqual([
      expect.objectContaining({ codeHighlight: false, pageNumbers: false }),
    ]);
    expect(result.markdownPdfExecuteCalls).toHaveLength(1);
    expect(result.stderr).not.toContain("Reusable Profile settings:");
    expect(result.stderr).toContain("Render override:\n- Disable for this render");
    expect(result.stderr).toContain("- One-render override: disable for this PDF");
    expect(result.stderr).toContain("- Highlighting: disabled");
    expect(result.stderr).toContain("Recipe cleanup: never");
  });

  test("cancels a reviewed deterministic candidate without binding or writing", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...RECIPES_ENTRY, "profile", "starter", "cancel"],
    });

    expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicBindCalls).toEqual([]);
    expect(result.markdownPdfDeterministicWriteCalls).toEqual([]);
  });
});
