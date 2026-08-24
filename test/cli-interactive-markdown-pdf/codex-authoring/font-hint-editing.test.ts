import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "../../cli-foundations/interactive-harness";
import { recipesCodexSelections } from "../../markdown-pdf/interactive/codex-authoring-fixtures";

describe("interactive Markdown PDF Codex authoring", () => {
  test("adds and removes font hints and retains a Template cover choice", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...recipesCodexSelections("template-bundle"),
        "font-hints",
        "custom",
        "accept",
        "custom",
        "accept",
        "remove",
        0,
        "done",
        "cover-image",
        "continue",
        "cancel",
      ],
      inputQueue: ["", "Inter", "Source Serif 4"],
      requiredPathQueue: ["fixtures/cover.png"],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfCodexPrepareCalls).toEqual([
      expect.objectContaining({
        artifact: "template-bundle",
        candidateId: "codex-template-bundle-1",
        coverImage: "fixtures/cover.png",
        fontHints: ["Source Serif 4"],
      }),
    ]);
    expect(result.markdownPdfFontDiscoveryCalls).toEqual([]);
    expect(result.markdownPdfCodexWriteCalls).toEqual([]);
  });

  test("builds a language-specific hint from bounded installed-family suggestions", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfFontFamilies: [
        "Noto Color Emoji",
        "Noto Mono",
        "Noto Music",
        "Noto Nastaliq",
        "Noto Sans",
        "Noto Sans Symbols",
        "Noto Serif JP",
        "noto serif jp",
      ],
      selectQueue: [
        ...recipesCodexSelections("profile"),
        "font-hints",
        "guided",
        { kind: "language-body", language: "" },
        "accept",
        "done",
        "continue",
        "cancel",
      ],
      searchQueue: [{ term: "Noto", value: "Noto Serif JP" }],
      inputQueue: ["", "Japanese"],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfFontDiscoveryCalls).toEqual([
      { discovery: "fontconfig", hasSignal: true, timeoutMs: 10_000 },
    ]);
    expect(result.searchChoicesByMessage["Font preference"]?.[0]).toEqual({
      name: "Noto",
      value: "Noto",
      description: "Use the typed text as a custom font preference.",
    });
    expect(result.searchChoicesByMessage["Font preference"]).toHaveLength(7);
    expect(result.markdownPdfCodexPrepareCalls[0]?.fontHints).toEqual([
      "Prefer Noto Serif JP for Japanese body text",
    ]);
    expect(result.stderr).toContain("--font-hint = Prefer Noto Serif JP for Japanese body text");
    expect(result.stderr).not.toContain("/private/font-");
  });

  test("falls back to ordinary preference input without blocking the builder", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfFontFamilies: [],
      selectQueue: [
        ...recipesCodexSelections("template-bundle"),
        "font-hints",
        "guided",
        { kind: "body" },
        "accept",
        "done",
        "continue",
        "cancel",
      ],
      inputQueue: ["", "Brand Sans"],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfFontDiscoveryCalls).toHaveLength(1);
    expect(result.promptCalls).toContainEqual({
      kind: "input",
      message: "Font preference",
      defaultValue: "",
    });
    expect(result.stderr).toContain(
      "Installed font suggestions are unavailable; continuing with custom input.",
    );
    expect(result.markdownPdfCodexPrepareCalls[0]?.fontHints).toEqual([
      "Prefer Brand Sans for body text",
    ]);
  });

  test("shows direct add actions without the retry branch", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfFontFamilies: [],
      selectQueue: [
        ...recipesCodexSelections("profile"),
        "font-hints",
        "guided",
        { kind: "body" },
        "accept",
        "guided",
        { kind: "general-body" },
        "accept",
        "done",
        "continue",
        "cancel",
      ],
      inputQueue: ["", "Brand Sans", "Inter"],
      confirmQueue: [false, true],
    });

    expect(result.selectChoicesByMessage["Edit font hints"]?.map((choice) => choice.value)).toEqual(
      ["guided", "custom", "edit", "remove", "move", "done"],
    );
    expect(result.markdownPdfFontDiscoveryCalls).toHaveLength(1);
    expect(result.markdownPdfCodexPrepareCalls[0]?.fontHints).toEqual([
      "Prefer Brand Sans for body text",
      "Prefer Inter",
    ]);
    expect(result.stderr.match(/^1\. Prefer Brand Sans for body text$/gm)).toHaveLength(2);
    expect(result.stderr.match(/^2\. Prefer Inter$/gm)).toHaveLength(1);
    expect(result.promptCalls).not.toContainEqual({ kind: "select", message: "Add font hint" });
  });

  test("offers only direct additions and Done for an empty collection", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...recipesCodexSelections("profile"),
        "font-hints",
        "done",
        "continue",
        "cancel",
      ],
      inputQueue: [""],
      confirmQueue: [false, true],
    });

    expect(result.selectChoicesByMessage["Edit font hints"]?.map((choice) => choice.value)).toEqual(
      ["guided", "custom", "done"],
    );
  });

  test("adds mutation actions only after the collection has an item", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...recipesCodexSelections("profile"),
        "font-hints",
        "custom",
        "accept",
        "done",
        "continue",
        "cancel",
      ],
      inputQueue: ["", "Prefer Inter"],
      confirmQueue: [false, true],
    });

    expect(result.selectChoicesByMessage["Edit font hints"]?.map((choice) => choice.value)).toEqual(
      ["guided", "custom", "edit", "remove", "done"],
    );
    expect(result.stderr.match(/^1\. Prefer Inter$/gm)).toHaveLength(1);
  });

  test("keeps the visible collection and payload ordered across every mutation", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...recipesCodexSelections("profile"),
        "font-hints",
        "custom",
        "accept",
        "custom",
        "accept",
        "move",
        1,
        "up",
        "edit",
        0,
        "accept",
        "remove",
        1,
        "done",
        "continue",
        "cancel",
      ],
      inputQueue: ["", "First hint", "Second hint", "Second hint revised"],
      confirmQueue: [false, true],
    });

    const snapshots = [
      "Font hints:\n- none",
      "Font hints:\n1. First hint",
      "Font hints:\n1. First hint\n2. Second hint",
      "Font hints:\n1. Second hint\n2. First hint",
      "Font hints:\n1. Second hint revised\n2. First hint",
      "Font hints:\n1. Second hint revised",
    ];
    let previousIndex = -1;
    for (const snapshot of snapshots) {
      const index = result.stderr.indexOf(snapshot, previousIndex + 1);
      expect(index).toBeGreaterThan(previousIndex);
      previousIndex = index;
    }
    expect(result.markdownPdfCodexPrepareCalls[0]?.fontHints).toEqual(["Second hint revised"]);
  });

  test("preserves mode transitions while editing a font hint", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfFontFamilies: ["Inter"],
      selectQueue: [
        ...recipesCodexSelections("profile"),
        "font-hints",
        "custom",
        "accept",
        "edit",
        0,
        "builder",
        { kind: "body" },
        "switch-to-custom",
        "accept",
        "done",
        "continue",
        "cancel",
      ],
      inputQueue: ["", "Initial custom hint", "Initial custom hint", "Final custom hint"],
      searchQueue: [{ term: "Int", value: "Inter" }],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfCodexPrepareCalls[0]?.fontHints).toEqual(["Final custom hint"]);
  });

  test("shows and rejects an exact duplicate compiled hint", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...recipesCodexSelections("profile"),
        "font-hints",
        "custom",
        "accept",
        "custom",
        "accept",
        "done",
        "continue",
        "cancel",
      ],
      inputQueue: [
        "",
        "Prefer Inter for headings and titles",
        "Prefer Inter for headings and titles",
      ],
      confirmQueue: [false, true],
    });

    expect(result.stderr).toContain(
      "That font hint already exists: Prefer Inter for headings and titles",
    );
    expect(result.markdownPdfCodexPrepareCalls[0]?.fontHints).toEqual([
      "Prefer Inter for headings and titles",
    ]);
    expect(result.markdownPdfFontDiscoveryCalls).toEqual([]);
  });
});
