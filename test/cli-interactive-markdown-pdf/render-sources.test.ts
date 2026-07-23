import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "../cli-interactive-routing.helpers";

const ENTRY_SELECTIONS = ["md", "md:to-pdf"];

describe("interactive Markdown PDF render sources", () => {
  test("describes generated authoring with the complete artifact matrix", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...ENTRY_SELECTIONS, "cancel"],
      requiredPathQueue: ["fixtures/report.md"],
    });

    expect(result.selectChoicesByMessage["Choose a recipe for this PDF"]).toContainEqual({
      name: "Create a recipe",
      value: "generated",
      description: "Prepare a Profile, Template bundle, or Project bundle",
    });
  });

  test("prepares, reviews, plans, and renders the built-in recipe once", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...ENTRY_SELECTIONS, "built-in", "inherit", "default"],
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfPrepareCalls).toEqual([
      { input: "fixtures/report.md", preparedId: "prepared-1" },
    ]);
    expect(result.markdownPdfPlanCalls).toHaveLength(1);
    expect(result.markdownPdfExecuteCalls).toEqual([
      {
        outputPath: expect.stringMatching(/fixtures\/report\.pdf$/),
        preparedId: "prepared-1",
      },
    ]);
    expect(result.stderr).toContain("Markdown PDF recipe review");
    expect(result.stderr).toContain("Recipe source: built-in");
    expect(result.stderr).not.toContain("Reusable Profile settings:");
    expect(result.stderr).toContain("Render override:\n- Use recipe setting");
    expect(result.stderr).toContain("Effective render:\n- Highlighting: disabled");
    expect(result.stderr).toContain("Dry run: no files have been written.");
    expect(result.stderr.indexOf("Markdown PDF recipe review")).toBeLessThan(
      result.stderr.indexOf("Final render review"),
    );
  });

  test("maps an existing Profile to one explicit prepared role", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...ENTRY_SELECTIONS, "existing-profile", "inherit", "default"],
      requiredPathQueue: ["fixtures/report.md", "fixtures/profile.yml"],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfPrepareCalls[0]).toMatchObject({
      input: "fixtures/report.md",
      profile: "fixtures/profile.yml",
    });
    expect(result.stderr).toContain("Profile:");
    expect(result.stderr).toContain("(explicit)");
  });

  for (const choice of ["inherit", "enable", "disable"] as const) {
    test(`propagates the ${choice} render override after source selection`, () => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [...ENTRY_SELECTIONS, "existing-profile", choice, "cancel"],
        requiredPathQueue: ["fixtures/report.md", "fixtures/profile.yml"],
      });

      if (choice === "inherit") {
        expect(result.markdownPdfPrepareCalls[0]).not.toHaveProperty("codeHighlight");
      } else {
        expect(result.markdownPdfPrepareCalls[0]).toHaveProperty(
          "codeHighlight",
          choice === "enable",
        );
      }
      expect(result.stderr).toContain("Reusable Profile settings:");
      expect(result.stderr).toContain(
        choice === "inherit"
          ? "- Use recipe setting"
          : choice === "enable"
            ? "- Enable for this render"
            : "- Disable for this render",
      );
      expect(result.stderr).toContain("Effective render:");
      expect(result.stderr).toContain(
        choice === "disable" ? "- Highlighting: disabled" : "- Highlighting: enabled",
      );
    });
  }

  test("enables highlighting for a Template-only bundle without inventing Profile settings", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfBundleRoles: ["template"],
      selectQueue: [...ENTRY_SELECTIONS, "existing-bundle", "enable", "cancel"],
      requiredPathQueue: ["fixtures/report.md", "fixtures/template-bundle"],
    });

    expect(result.markdownPdfPrepareCalls[0]).toHaveProperty("codeHighlight", true);
    expect(result.stderr).not.toContain("Reusable Profile settings:");
    expect(result.stderr).toContain("Render override:\n- Enable for this render");
    expect(result.stderr).toContain("Effective render:\n- Highlighting: enabled");
    expect(result.stderr).toContain("- Code highlighting theme: github-light");
    expect(result.stderr).toContain("- Line numbers: disabled");
  });

  test("offers the complete render-override decision before authoritative preparation", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...ENTRY_SELECTIONS, "existing-bundle", "cancel"],
      requiredPathQueue: ["fixtures/report.md", "fixtures/report-bundle"],
    });

    expect(result.selectChoicesByMessage["Code highlighting for this PDF"]).toEqual([
      { name: "Use recipe setting", value: "inherit" },
      { name: "Enable for this render", value: "enable" },
      { name: "Disable for this render", value: "disable" },
      { name: "Back", value: "back" },
      { name: "Cancel", value: "cancel" },
    ]);
    expect(result.markdownPdfPrepareCalls).toEqual([]);
  });

  test("offers the complete override after Custom selection without preparing it first", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...ENTRY_SELECTIONS, "custom-inputs", "explicit", "cancel"],
      checkboxQueue: [["profile"]],
      requiredPathQueue: ["fixtures/report.md", "fixtures/profile.yml"],
    });

    expect(result.selectChoicesByMessage["Code highlighting for this PDF"]).toEqual([
      { name: "Use recipe setting", value: "inherit" },
      { name: "Enable for this render", value: "enable" },
      { name: "Disable for this render", value: "disable" },
      { name: "Back", value: "back" },
      { name: "Cancel", value: "cancel" },
    ]);
    expect(result.markdownPdfPrepareCalls).toEqual([]);
  });

  test("reviews discovered bundle roles and ignored-file warnings", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfBundleRoles: ["profile", "template", "css"],
      markdownPdfIgnoredBundleFiles: ["notes.yml"],
      selectQueue: [...ENTRY_SELECTIONS, "existing-bundle", "inherit", "default"],
      requiredPathQueue: ["fixtures/report.md", "fixtures/report-bundle"],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfPrepareCalls[0]).toMatchObject({
      bundle: "fixtures/report-bundle",
    });
    expect(result.stderr).toContain("(bundle)");
    expect(result.stderr).toContain("Ignored unclassified YAML or JSON file: notes.yml");
  });

  test("collects only selected explicit Custom roles", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...ENTRY_SELECTIONS, "custom-inputs", "explicit", "inherit", "default"],
      checkboxQueue: [["profile", "css"]],
      requiredPathQueue: ["fixtures/report.md", "fixtures/profile.yml", "fixtures/print.css"],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfPrepareCalls[0]).toMatchObject({
      profile: "fixtures/profile.yml",
      css: "fixtures/print.css",
    });
    expect(result.markdownPdfPrepareCalls[0]).not.toHaveProperty("template");
  });

  test("previews bundle roles and keeps explicit Custom precedence authoritative", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfBundleRoles: ["profile", "template", "css"],
      selectQueue: [
        ...ENTRY_SELECTIONS,
        "custom-inputs",
        "bundle-with-explicit",
        "inherit",
        "default",
      ],
      checkboxQueue: [["template"]],
      requiredPathQueue: ["fixtures/report.md", "fixtures/report-bundle", "fixtures/custom.html"],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfBundleDiscoveryCalls).toEqual([
      {
        directory: expect.stringMatching(/fixtures\/report-bundle$/),
      },
    ]);
    expect(result.markdownPdfPrepareCalls[0]).toMatchObject({
      bundle: "fixtures/report-bundle",
      template: "fixtures/custom.html",
    });
    expect(result.stderr).toContain("Bundle provides: Profile, Template, Stylesheet");
    expect(result.stderr).toContain("custom.html (explicit)");
    expect(result.stderr).toContain("profile.yml (bundle)");
  });

  test("rejects an empty explicit-role selection before preparation", () => {
    const result = runInteractiveHarness(
      {
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [...ENTRY_SELECTIONS, "custom-inputs", "explicit"],
        checkboxQueue: [[]],
        requiredPathQueue: ["fixtures/report.md"],
      },
      { allowFailure: true },
    );

    expect(result.error).toBe("Select at least one explicit Markdown PDF input.");
    expect(result.markdownPdfPrepareCalls).toEqual([]);
    expect(result.markdownPdfExecuteCalls).toEqual([]);
  });

  test("returns from Custom mode to recipe-source selection without re-prompting input", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...ENTRY_SELECTIONS, "custom-inputs", "back", "built-in", "inherit", "default"],
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfPrepareCalls).toHaveLength(1);
    expect(result.pathCalls.filter((call) => call.message === "Input Markdown file")).toHaveLength(
      1,
    );
    expect(
      result.promptCalls.filter((call) => call.message === "Choose a recipe for this PDF"),
    ).toHaveLength(2);
  });

  test("returns from the override decision to source selection before preparing", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...ENTRY_SELECTIONS,
        "custom-inputs",
        "bundle-with-explicit",
        "back",
        "built-in",
        "enable",
        "cancel",
      ],
      checkboxQueue: [["template"]],
      requiredPathQueue: ["fixtures/report.md", "fixtures/report-bundle", "fixtures/custom.html"],
    });

    expect(result.markdownPdfPrepareCalls).toEqual([
      { input: "fixtures/report.md", codeHighlight: true, preparedId: "prepared-1" },
    ]);
    expect(
      result.promptCalls.filter((call) => call.message === "Choose a recipe for this PDF"),
    ).toHaveLength(2);
    expect(result.pathCalls.filter((call) => call.message === "Input Markdown file")).toHaveLength(
      1,
    );
  });

  test("changes code highlighting from recipe review without reselecting the source", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...ENTRY_SELECTIONS,
        "built-in",
        "inherit",
        "change-code-highlighting",
        "enable",
        "cancel",
      ],
      requiredPathQueue: ["fixtures/report.md"],
    });

    expect(result.markdownPdfPrepareCalls).toEqual([
      { input: "fixtures/report.md", preparedId: "prepared-1" },
      { input: "fixtures/report.md", codeHighlight: true, preparedId: "prepared-2" },
    ]);
    expect(
      result.promptCalls.filter((call) => call.message === "Choose a recipe for this PDF"),
    ).toHaveLength(1);
    expect(result.pathCalls.filter((call) => call.message === "Input Markdown file")).toHaveLength(
      1,
    );
    expect(result.markdownPdfPlanCalls).toEqual([]);
    expect(result.stderr).toContain("Render override:\n- Enable for this render");
  });

  test("keeps the prepared source when recipe review reselects the current override", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...ENTRY_SELECTIONS,
        "built-in",
        "inherit",
        "change-code-highlighting",
        "inherit",
        "cancel",
      ],
      requiredPathQueue: ["fixtures/report.md"],
    });

    expect(result.markdownPdfPrepareCalls).toEqual([
      { input: "fixtures/report.md", preparedId: "prepared-1" },
    ]);
    expect(result.markdownPdfPlanCalls).toEqual([]);
  });

  test("changes code highlighting from final review without planning a new output", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...ENTRY_SELECTIONS,
        "existing-profile",
        "inherit",
        "default",
        "change-code-highlighting",
        "disable",
      ],
      requiredPathQueue: ["fixtures/report.md", "fixtures/profile.yml"],
      confirmQueue: [false, false, true],
    });

    expect(result.markdownPdfPrepareCalls).toHaveLength(2);
    expect(result.markdownPdfPrepareCalls[1]).toMatchObject({
      input: "fixtures/report.md",
      profile: "fixtures/profile.yml",
      codeHighlight: false,
      preparedId: "prepared-2",
    });
    expect(result.markdownPdfPlanCalls).toHaveLength(1);
    expect(result.markdownPdfExecuteCalls).toEqual([
      {
        outputPath: expect.stringMatching(/fixtures\/report\.pdf$/),
        preparedId: "prepared-2",
      },
    ]);
    expect(result.stderr).toContain("Render override:\n- Disable for this render");
    expect(result.stderr).toContain("Effective render:\n- Highlighting: disabled");
    expect(result.stderr).toContain("Reusable Profile settings:");
    expect(result.stderr).toContain("- Code highlighting theme: light-plus");
  });

  for (const action of ["back", "cancel"] as const) {
    test(`handles ${action} from a final-review highlighting change without repreparing or replanning`, () => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [
          ...ENTRY_SELECTIONS,
          "built-in",
          "inherit",
          "default",
          "change-code-highlighting",
          action,
        ],
        requiredPathQueue: ["fixtures/report.md"],
        confirmQueue: action === "back" ? [false, false, true] : [false, false],
      });

      expect(result.markdownPdfPrepareCalls).toEqual([
        { input: "fixtures/report.md", preparedId: "prepared-1" },
      ]);
      expect(result.markdownPdfPlanCalls).toHaveLength(1);
      expect(result.markdownPdfExecuteCalls).toHaveLength(action === "back" ? 1 : 0);
    });
  }

  test("keeps the prepared plan when final review reselects the current override", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...ENTRY_SELECTIONS,
        "built-in",
        "inherit",
        "default",
        "change-code-highlighting",
        "inherit",
      ],
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, false, true],
    });

    expect(result.markdownPdfPrepareCalls).toEqual([
      { input: "fixtures/report.md", preparedId: "prepared-1" },
    ]);
    expect(result.markdownPdfPlanCalls).toHaveLength(1);
    expect(result.markdownPdfExecuteCalls).toEqual([
      {
        outputPath: expect.stringMatching(/fixtures\/report\.pdf$/),
        preparedId: "prepared-1",
      },
    ]);
  });

  test("changes PDF output without preparing the recipe again", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...ENTRY_SELECTIONS,
        "built-in",
        "inherit",
        "default",
        "change-output",
        "custom",
      ],
      requiredPathQueue: ["fixtures/report.md", "output/final.pdf"],
      confirmQueue: [false, false, true, true],
    });

    expect(result.markdownPdfPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfPlanCalls).toHaveLength(2);
    expect(result.markdownPdfPlanCalls.map((call) => call.preparedId)).toEqual([
      "prepared-1",
      "prepared-1",
    ]);
    expect(result.markdownPdfExecuteCalls).toEqual([
      {
        outputPath: expect.stringMatching(/output\/final\.pdf$/),
        preparedId: "prepared-1",
      },
    ]);
  });

  test("re-prompts PDF output after a recoverable planning error", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfOutputErrorMessages: ["Output already exists"],
      selectQueue: [...ENTRY_SELECTIONS, "built-in", "inherit", "default", "custom"],
      requiredPathQueue: ["fixtures/report.md", "output/recovered.pdf"],
      confirmQueue: [false, true, true],
    });

    expect(result.markdownPdfPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfPlanCalls).toHaveLength(2);
    expect(result.markdownPdfExecuteCalls).toHaveLength(1);
    expect(result.stderr).toContain("Unable to prepare PDF output: Output already exists");
  });

  test("plans a custom output and preserves explicit overwrite intent", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...ENTRY_SELECTIONS, "built-in", "inherit", "custom"],
      requiredPathQueue: ["fixtures/report.md", "output/custom.pdf"],
      confirmQueue: [true, true],
    });

    expect(result.markdownPdfPlanCalls).toEqual([
      {
        output: "output/custom.pdf",
        outputPath: expect.stringMatching(/output\/custom\.pdf$/),
        overwrite: true,
        preparedId: "prepared-1",
      },
    ]);
    expect(result.markdownPdfExecuteCalls[0]?.outputPath).toMatch(/output\/custom\.pdf$/);
  });

  test("changing the recipe source retains the Markdown input and prepares a new candidate", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...ENTRY_SELECTIONS,
        "built-in",
        "inherit",
        "change-source",
        "existing-profile",
        "inherit",
        "default",
      ],
      requiredPathQueue: ["fixtures/report.md", "fixtures/profile.yml"],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfPrepareCalls.map((call) => call.preparedId)).toEqual([
      "prepared-1",
      "prepared-2",
    ]);
    expect(result.markdownPdfPrepareCalls.map((call) => call.input)).toEqual([
      "fixtures/report.md",
      "fixtures/report.md",
    ]);
    expect(result.pathCalls.filter((call) => call.message === "Input Markdown file")).toHaveLength(
      1,
    );
    expect(result.markdownPdfExecuteCalls[0]?.preparedId).toBe("prepared-2");
  });

  test("prints renderer warnings without suppressing the success summary", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfRenderWarnings: ["Fallback font used", "Cover image was resized"],
      selectQueue: [...ENTRY_SELECTIONS, "built-in", "inherit", "default"],
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, true],
    });

    expect(result.stderr).toContain("Markdown PDF render warnings:");
    expect(result.stderr).toContain("- Fallback font used");
    expect(result.stderr).toContain("- Cover image was resized");
    expect(result.stdout).toContain("Wrote PDF:");
  });

  test("cancels after declining final render confirmation without executing", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...ENTRY_SELECTIONS, "built-in", "inherit", "default", "cancel"],
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, false],
    });

    expect(result.markdownPdfPlanCalls).toHaveLength(1);
    expect(result.markdownPdfExecuteCalls).toEqual([]);
    expect(result.stdout).not.toContain("Wrote PDF:");
  });

  test("stops before output selection when authoritative bundle preparation fails", () => {
    const result = runInteractiveHarness(
      {
        mode: "run",
        markdownPdfMocks: true,
        markdownPdfPrepareErrorMessage: "Bundle has unresolved Profile candidates.",
        selectQueue: [...ENTRY_SELECTIONS, "existing-bundle", "inherit"],
        requiredPathQueue: ["fixtures/report.md", "fixtures/ambiguous-bundle"],
      },
      { allowFailure: true },
    );

    expect(result.error).toBe("Bundle has unresolved Profile candidates.");
    expect(result.markdownPdfPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfPlanCalls).toEqual([]);
    expect(result.markdownPdfExecuteCalls).toEqual([]);
  });

  test("cancels the override decision without preparing, planning, or rendering", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...ENTRY_SELECTIONS, "built-in", "cancel"],
      requiredPathQueue: ["fixtures/report.md"],
    });

    expect(result.markdownPdfPrepareCalls).toEqual([]);
    expect(result.markdownPdfPlanCalls).toEqual([]);
    expect(result.markdownPdfExecuteCalls).toEqual([]);
    expect(result.removedPaths).toEqual([]);
  });
});
