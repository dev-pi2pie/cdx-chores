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
      selectQueue: [...projectSaveSelections("choose"), "sample", "default"],
      inputQueue: [""],
      requiredPathQueue: ["fixtures/sample.md"],
      confirmQueue: [true, false, true, false, true],
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
    expect(result.markdownPdfExecuteCalls).toHaveLength(1);
  });

  test("keeps preparation sample and render input distinct when another file is chosen", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...projectSaveSelections("choose"), "choose", "default"],
      inputQueue: [""],
      requiredPathQueue: ["fixtures/sample.md", "fixtures/render.md"],
      confirmQueue: [true, false, true, false, true],
    });

    expect(result.markdownPdfCodexPrepareCalls[0]?.sample).toBe("fixtures/sample.md");
    expect(result.markdownPdfPrepareCalls[0]?.input).toBe("fixtures/render.md");
  });

  test("requires normal Markdown selection when preparation had no sample", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...projectSaveSelections("none"), "default"],
      inputQueue: [""],
      requiredPathQueue: ["fixtures/render.md"],
      confirmQueue: [true, false, true, false, true],
    });

    expect(result.markdownPdfCodexPrepareCalls[0]?.sample).toBeUndefined();
    expect(result.markdownPdfPrepareCalls[0]?.input).toBe("fixtures/render.md");
    expect(result.promptCalls).toContainEqual({
      kind: "select",
      message: "What next?",
    });
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
