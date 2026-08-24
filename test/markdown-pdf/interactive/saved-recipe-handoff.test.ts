import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "../../cli-foundations/interactive-harness";

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

function deterministicSaveSelections(artifact: "profile" | "template-bundle") {
  return [...RECIPES_ENTRY, artifact, "starter", "save", "render"];
}

describe("interactive Markdown PDF saved-recipe handoff", () => {
  test.each(
    (["profile", "template-bundle"] as const).flatMap((artifact) =>
      (["inherit", "enable", "disable"] as const).map((choice) => [artifact, choice] as const),
    ),
  )("passes saved %s page numbers %s to one fresh preparation", (artifact, choice) => {
    const compiled = choice === "inherit" ? undefined : choice === "enable";
    const output = artifact === "profile" ? "recipes/saved.yml" : "recipes/saved-template";
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...deterministicSaveSelections(artifact), "inherit", choice, "cancel"],
      requiredPathQueue: [output, "fixtures/render.md"],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfPrepareCalls).toEqual([
      {
        input: "fixtures/render.md",
        ...(artifact === "profile" ? { profile: output } : { bundle: output }),
        ...(compiled === undefined ? {} : { pageNumbers: compiled }),
        preparedId: "prepared-1",
      },
    ]);
    expect(result.markdownPdfDeterministicWriteCalls).toHaveLength(1);
    expect(result.markdownPdfCodexWriteCalls).toEqual([]);
    expect(result.markdownPdfPlanCalls).toEqual([]);
    expect(result.markdownPdfExecuteCalls).toEqual([]);
  });

  test("preselects a saved bundle and uses its sample only after explicit selection", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...projectSaveSelections("choose"), "sample", "inherit", "inherit", "default"],
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
    ).toHaveLength(1);
    expect(result.markdownPdfPrepareCalls[0]).not.toHaveProperty("codeHighlight");
    expect(result.markdownPdfExecuteCalls).toHaveLength(1);
  });

  test("uses the current saved Project Profile instead of stale candidate state", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfCodexFinalProfile: {
        profile: {
          id: "md-pdf-profile-20260101T000000Z-abc12345",
          source: "codex",
          createdAt: "2026-01-01T00:00:00Z",
        },
        pageNumbers: { enabled: false },
      },
      markdownPdfProfilePageNumbersEnabled: true,
      selectQueue: [...projectSaveSelections("choose"), "sample", "inherit", "inherit", "default"],
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
    expect(result.markdownPdfPrepareCalls[0]).not.toHaveProperty("pageNumbers");
    expect(result.stderr).toContain("- Recipe setting: enabled (reusable Profile)");
    expect(result.stderr).toContain("- One-render override: use recipe setting");
    expect(result.markdownPdfCodexWriteCalls).toHaveLength(1);
    expect(result.markdownPdfPlanCalls).toHaveLength(1);
    expect(result.markdownPdfExecuteCalls).toHaveLength(1);
  });

  for (const choice of ["enable", "disable"] as const) {
    test(`applies the ${choice} code-highlighting override to a saved Project bundle`, () => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [...projectSaveSelections("choose"), "sample", choice, "inherit", "cancel"],
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

  for (const choice of ["enable", "disable"] as const) {
    test(`applies the ${choice} page-number override to a saved Project bundle`, () => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [...projectSaveSelections("choose"), "sample", "inherit", choice, "cancel"],
        inputQueue: [""],
        requiredPathQueue: ["fixtures/sample.md"],
        confirmQueue: [false, true, false, true],
      });

      expect(result.markdownPdfPrepareCalls).toEqual([
        expect.objectContaining({
          bundle: expect.stringContaining("codex-project-bundle-1"),
          input: "fixtures/sample.md",
          pageNumbers: choice === "enable",
        }),
      ]);
      expect(result.markdownPdfPrepareCalls[0]).not.toHaveProperty("codeHighlight");
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
        "inherit",
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

  test("returns from page numbers to code highlighting without losing the code choice", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...projectSaveSelections("choose"),
        "sample",
        "enable",
        "back",
        "enable",
        "disable",
        "cancel",
      ],
      inputQueue: [""],
      requiredPathQueue: ["fixtures/sample.md"],
      confirmQueue: [false, true, false, true],
    });

    expect(result.markdownPdfPrepareCalls).toEqual([
      expect.objectContaining({ codeHighlight: true, pageNumbers: false }),
    ]);
    expect(
      result.promptCalls.filter((call) => call.message === "Page numbers for this PDF"),
    ).toHaveLength(2);
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

  test.each([
    ["missing", "Missing required Project files:\n- profile.yml"],
    ["ambiguous", "Multiple Project profile candidates:\n- profile.yml\n- alternate.yml"],
    ["invalid", "Invalid Project profile files:\n- profile.yml"],
  ] as const)(
    "fails closed when a saved Project has a %s canonical Profile",
    (_condition, completenessError) => {
      const result = runInteractiveHarness(
        {
          mode: "run",
          markdownPdfMocks: true,
          markdownPdfProjectCompletenessErrorMessage: completenessError,
          selectQueue: [...projectSaveSelections("choose"), "sample", "inherit", "inherit"],
          inputQueue: [""],
          requiredPathQueue: ["fixtures/sample.md"],
          confirmQueue: [false, true, false, true],
        },
        { allowFailure: true },
      );

      expect(result.error).toContain(completenessError);
      expect(result.markdownPdfCodexWriteCalls).toHaveLength(1);
      expect(result.markdownPdfPrepareCalls).toEqual([]);
      expect(result.markdownPdfPlanCalls).toEqual([]);
      expect(result.markdownPdfExecuteCalls).toEqual([]);
      expect(result.removedPaths).toEqual([]);
    },
  );

  test("keeps preparation sample and render input distinct when another file is chosen", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...projectSaveSelections("choose"), "choose", "inherit", "inherit", "default"],
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
      selectQueue: [...projectSaveSelections("none"), "inherit", "inherit", "default"],
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
