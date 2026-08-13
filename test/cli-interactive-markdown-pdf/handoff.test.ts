import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "../cli-interactive-routing.helpers";

const RECIPES_ENTRY = ["md", "md:pdf-recipes"];

function projectSaveSelections(sample: "none" | "choose") {
  return [
    ...RECIPES_ENTRY,
    "project-bundle",
    sample,
    "continue",
    "save",
    "none",
    "suggested",
    "render",
  ];
}

describe("interactive Markdown PDF saved-recipe handoff", () => {
  test("preselects a saved bundle and uses its sample only after explicit selection", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...projectSaveSelections("choose"), "sample", "inherit", "default"],
      inputQueue: [""],
      requiredPathQueue: ["fixtures/sample.md"],
      confirmQueue: [false, true, false, true, false, true],
    });

    expect(result.markdownPdfPrepareCalls).toEqual([
      expect.objectContaining({
        bundle: expect.stringContaining("codex-project-bundle-1"),
        input: "fixtures/sample.md",
      }),
    ]);
    expect(
      result.promptCalls.filter((call) => call.message === "Choose a recipe for this PDF"),
    ).toEqual([]);
    expect(
      result.promptCalls.filter((call) => call.message === "Page numbers for this PDF"),
    ).toEqual([]);
    expect(result.markdownPdfPrepareCalls[0]).not.toHaveProperty("codeHighlight");
    expect(result.markdownPdfExecuteCalls).toHaveLength(1);
  });

  for (const choice of ["enable", "disable"] as const) {
    test(`applies the ${choice} override to a saved Project bundle`, () => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [...projectSaveSelections("choose"), "sample", choice, "cancel"],
        inputQueue: [""],
        requiredPathQueue: ["fixtures/sample.md"],
        confirmQueue: [false, true, false, true],
      });

      expect(result.markdownPdfPrepareCalls).toEqual([
        expect.objectContaining({
          bundle: expect.stringContaining("codex-project-bundle-1"),
          input: "fixtures/sample.md",
          codeHighlight: choice === "enable",
        }),
      ]);
      expect(
        result.promptCalls.filter((call) => call.message === "Choose a recipe for this PDF"),
      ).toEqual([]);
      expect(result.markdownPdfPlanCalls).toEqual([]);
    });
  }

  test("returns from the handoff override to Markdown input selection", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...projectSaveSelections("choose"),
        "sample",
        "back",
        "sample",
        "enable",
        "cancel",
      ],
      inputQueue: [""],
      requiredPathQueue: ["fixtures/sample.md"],
      confirmQueue: [false, true, false, true],
    });

    expect(
      result.promptCalls.filter((call) => call.message === "Markdown input for rendering"),
    ).toHaveLength(2);
    expect(result.markdownPdfPrepareCalls).toEqual([
      expect.objectContaining({
        input: "fixtures/sample.md",
        codeHighlight: true,
      }),
    ]);
    expect(
      result.promptCalls.filter((call) => call.message === "Choose a recipe for this PDF"),
    ).toEqual([]);
  });

  test("cancels a saved-recipe handoff before authoritative preparation", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...projectSaveSelections("choose"), "sample", "cancel"],
      inputQueue: [""],
      requiredPathQueue: ["fixtures/sample.md"],
      confirmQueue: [false, true, false, true],
    });

    expect(result.markdownPdfPrepareCalls).toEqual([]);
    expect(result.markdownPdfPlanCalls).toEqual([]);
    expect(result.markdownPdfExecuteCalls).toEqual([]);
    expect(result.markdownPdfCodexWriteCalls).toHaveLength(1);
  });

  test("keeps preparation sample and render input distinct when another file is chosen", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...projectSaveSelections("choose"), "choose", "inherit", "default"],
      inputQueue: [""],
      requiredPathQueue: ["fixtures/sample.md", "fixtures/render.md"],
      confirmQueue: [false, true, false, true, false, true],
    });

    expect(result.markdownPdfCodexPrepareCalls[0]?.sample).toBe("fixtures/sample.md");
    expect(result.markdownPdfPrepareCalls[0]?.input).toBe("fixtures/render.md");
  });

  test("requires normal Markdown selection when preparation had no sample", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...projectSaveSelections("none"), "inherit", "default"],
      inputQueue: [""],
      requiredPathQueue: ["fixtures/render.md"],
      confirmQueue: [false, true, false, true, false, true],
    });

    expect(result.markdownPdfCodexPrepareCalls[0]?.sample).toBeUndefined();
    expect(result.markdownPdfPrepareCalls[0]?.input).toBe("fixtures/render.md");
    expect(result.promptCalls).toContainEqual({
      kind: "select",
      message: "What next?",
    });
  });

  test("changes a saved Project handoff override without rewriting or replanning", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...projectSaveSelections("choose"),
        "sample",
        "inherit",
        "default",
        "change-code-highlighting",
        "enable",
      ],
      inputQueue: [""],
      requiredPathQueue: ["fixtures/sample.md"],
      confirmQueue: [false, true, false, true, false, false, true],
    });

    expect(result.markdownPdfCodexWriteCalls).toHaveLength(1);
    expect(result.markdownPdfPrepareCalls).toHaveLength(2);
    expect(result.markdownPdfPrepareCalls[0]).not.toHaveProperty("codeHighlight");
    expect(result.markdownPdfPrepareCalls[1]).toEqual(
      expect.objectContaining({ codeHighlight: true }),
    );
    expect(result.markdownPdfPlanCalls).toHaveLength(1);
    expect(result.markdownPdfExecuteCalls).toEqual([
      expect.objectContaining({ preparedId: "prepared-2" }),
    ]);
    expect(result.promptCalls.filter((call) => call.message === "Choose preparation mode")).toEqual(
      [],
    );
  });

  test("can create another recipe after a durable save", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...RECIPES_ENTRY, "profile", "starter", "save", "create", "cancel"],
      requiredPathQueue: ["recipes/report.yml"],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(1);
    expect(
      result.promptCalls.filter((call) => call.message === "What would you like to create?"),
    ).toHaveLength(2);
  });
});
