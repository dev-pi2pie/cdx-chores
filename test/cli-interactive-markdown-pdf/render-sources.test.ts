import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "../cli-interactive-routing.helpers";

const ANSI_PATTERN = new RegExp(String.raw`\u001B\[[0-9;]*m`, "g");

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
    expect(
      result.promptCalls.filter((call) => call.message === "Page numbers for this PDF"),
    ).toEqual([]);
  });

  test("prepares, reviews, plans, and renders the built-in recipe once", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...ENTRY_SELECTIONS, "built-in", "inherit", "inherit", "default"],
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
      selectQueue: [...ENTRY_SELECTIONS, "existing-profile", "inherit", "inherit", "default"],
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
        selectQueue: [...ENTRY_SELECTIONS, "existing-profile", choice, "inherit", "cancel"],
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
      selectQueue: [...ENTRY_SELECTIONS, "existing-bundle", "enable", "inherit", "cancel"],
      requiredPathQueue: ["fixtures/report.md", "fixtures/template-bundle"],
    });

    expect(result.markdownPdfPrepareCalls[0]).toHaveProperty("codeHighlight", true);
    expect(result.stderr).not.toContain("Reusable Profile settings:");
    expect(result.stderr).toContain("Render override:\n- Enable for this render");
    expect(result.stderr).toContain("Effective render:\n- Highlighting: enabled");
    expect(result.stderr).toContain("- Code highlighting theme: github-light");
    expect(result.stderr).toContain("- Line numbers: disabled");
  });

  test.each([
    { choice: "enable", expected: true },
    { choice: "disable", expected: false },
  ] as const)(
    "applies the $choice page-number override to a Template/CSS-only bundle without inventing Profile state",
    ({ choice, expected }) => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        markdownPdfBundleRoles: ["template", "css"],
        selectQueue: [...ENTRY_SELECTIONS, "existing-bundle", "inherit", choice, "cancel"],
        requiredPathQueue: ["fixtures/report.md", "fixtures/template-css-bundle"],
      });

      expect(result.markdownPdfPrepareCalls[0]).toMatchObject({
        bundle: "fixtures/template-css-bundle",
        input: "fixtures/report.md",
        pageNumbers: expected,
      });
      expect(result.stderr).not.toContain("reusable Profile");
      expect(result.stderr).toContain("normalized default");
      expect(result.stderr).toContain(
        `- One-render override: ${expected ? "enable" : "disable"} for this PDF`,
      );
    },
  );

  test.each([
    { choice: "inherit", expectedOverride: undefined, effective: true },
    { choice: "disable", expectedOverride: false, effective: false },
    { choice: "enable", expectedOverride: true, effective: true },
  ] as const)(
    "resolves a complete bundle Profile with $choice page numbers",
    ({ choice, effective, expectedOverride }) => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        markdownPdfBundleRoles: ["profile", "template", "css"],
        markdownPdfProfilePageNumbersEnabled: true,
        selectQueue: [...ENTRY_SELECTIONS, "existing-bundle", "inherit", choice, "cancel"],
        requiredPathQueue: ["fixtures/report.md", "fixtures/complete-bundle"],
      });

      expect(result.markdownPdfPrepareCalls[0]).toMatchObject({
        bundle: "fixtures/complete-bundle",
        input: "fixtures/report.md",
      });
      if (expectedOverride === undefined) {
        expect(result.markdownPdfPrepareCalls[0]).not.toHaveProperty("pageNumbers");
      } else {
        expect(result.markdownPdfPrepareCalls[0]).toHaveProperty("pageNumbers", expectedOverride);
      }
      expect(result.stderr).toContain("- Recipe setting: enabled (reusable Profile)");
      expect(result.stderr).toContain(`- Effective result: ${effective ? "enabled" : "disabled"}`);
    },
  );

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
      stderrIsTTY: true,
      markdownPdfMocks: true,
      markdownPdfBundleRoles: ["profile", "template", "css"],
      markdownPdfIgnoredBundleFiles: ["notes.yml"],
      selectQueue: [...ENTRY_SELECTIONS, "existing-bundle", "inherit", "inherit", "default"],
      requiredPathQueue: ["fixtures/report.md", "fixtures/report-bundle"],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfPrepareCalls[0]).toMatchObject({
      bundle: "fixtures/report-bundle",
    });
    expect(result.stderr).toContain("(bundle)");
    expect(result.stderr).toContain("\u001b[33mBundle warnings:\u001b[39m");
    expect(result.stderr.replace(ANSI_PATTERN, "")).toContain(
      "Bundle warnings:\n- Ignored unclassified YAML or JSON file: notes.yml",
    );
    expect(result.stderr).toContain("Ignored unclassified YAML or JSON file: notes.yml");

    const redirected = runInteractiveHarness({
      mode: "run",
      stderrIsTTY: false,
      markdownPdfMocks: true,
      markdownPdfBundleRoles: ["profile", "template", "css"],
      markdownPdfIgnoredBundleFiles: ["notes.yml"],
      selectQueue: [...ENTRY_SELECTIONS, "existing-bundle", "inherit", "inherit", "default"],
      requiredPathQueue: ["fixtures/report.md", "fixtures/report-bundle"],
      confirmQueue: [false, true],
    });
    expect(redirected.stderr).toContain(
      "Bundle warnings:\n- Ignored unclassified YAML or JSON file: notes.yml",
    );
    expect(redirected.stderr).not.toContain(String.fromCharCode(27));
  });

  test("collects only selected explicit Custom roles", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...ENTRY_SELECTIONS,
        "custom-inputs",
        "explicit",
        "inherit",
        "inherit",
        "default",
      ],
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

  test("propagates a page-number choice through Custom explicit inputs", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...ENTRY_SELECTIONS,
        "custom-inputs",
        "explicit",
        "inherit",
        "enable",
        "cancel",
      ],
      checkboxQueue: [["profile", "css"]],
      requiredPathQueue: ["fixtures/report.md", "fixtures/profile.yml", "fixtures/print.css"],
    });

    expect(result.markdownPdfPrepareCalls[0]).toMatchObject({
      input: "fixtures/report.md",
      profile: "fixtures/profile.yml",
      css: "fixtures/print.css",
      pageNumbers: true,
    });
    expect(result.markdownPdfPrepareCalls[0]).not.toHaveProperty("template");
    expect(result.stderr).toContain("- One-render override: enable for this PDF");
  });

  test("propagates page numbers through Custom bundle inputs without weakening explicit precedence", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfBundleRoles: ["profile", "template", "css"],
      selectQueue: [
        ...ENTRY_SELECTIONS,
        "custom-inputs",
        "bundle-with-explicit",
        "inherit",
        "disable",
        "cancel",
      ],
      checkboxQueue: [["template"]],
      requiredPathQueue: ["fixtures/report.md", "fixtures/report-bundle", "fixtures/custom.html"],
    });

    expect(result.markdownPdfPrepareCalls[0]).toMatchObject({
      bundle: "fixtures/report-bundle",
      input: "fixtures/report.md",
      pageNumbers: false,
      template: "fixtures/custom.html",
    });
    expect(result.stderr).toContain("custom.html (explicit)");
    expect(result.stderr).toContain("profile.yml (bundle)");
    expect(result.stderr).toContain("- One-render override: disable for this PDF");
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
      selectQueue: [
        ...ENTRY_SELECTIONS,
        "custom-inputs",
        "back",
        "built-in",
        "inherit",
        "inherit",
        "default",
      ],
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
        "inherit",
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

  test("retains code highlighting when backing from the initial page-number decision", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...ENTRY_SELECTIONS, "built-in", "enable", "back", "cancel"],
      requiredPathQueue: ["fixtures/report.md"],
    });

    expect(result.markdownPdfPrepareCalls).toEqual([]);
    expect(result.markdownPdfPlanCalls).toEqual([]);
    expect(result.markdownPdfExecuteCalls).toEqual([]);
    expect(result.selectDefaultsByMessage["Code highlighting for this PDF"]).toEqual([
      "inherit",
      "enable",
    ]);
  });

  test("keeps the prepared plan when final review reselects the current override", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...ENTRY_SELECTIONS,
        "built-in",
        "inherit",
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
      selectQueue: [...ENTRY_SELECTIONS, "built-in", "inherit", "inherit", "default", "custom"],
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
      selectQueue: [...ENTRY_SELECTIONS, "built-in", "inherit", "inherit", "custom"],
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
        "inherit",
        "change-source",
        "existing-profile",
        "inherit",
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
      selectQueue: [...ENTRY_SELECTIONS, "built-in", "inherit", "inherit", "default"],
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
      selectQueue: [...ENTRY_SELECTIONS, "built-in", "inherit", "inherit", "default", "cancel"],
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
        selectQueue: [...ENTRY_SELECTIONS, "existing-bundle", "inherit", "inherit"],
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

  for (const action of ["back", "cancel"] as const) {
    test(`${action}s from the initial page-number decision without doing render work`, () => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue:
          action === "back"
            ? [...ENTRY_SELECTIONS, "built-in", "inherit", "back", "cancel"]
            : [...ENTRY_SELECTIONS, "built-in", "inherit", "cancel"],
        requiredPathQueue: ["fixtures/report.md"],
      });

      expect(result.markdownPdfPrepareCalls).toEqual([]);
      expect(result.markdownPdfPlanCalls).toEqual([]);
      expect(result.markdownPdfExecuteCalls).toEqual([]);
      expect(result.removedPaths).toEqual([]);
      expect(
        result.promptCalls.filter((call) => call.message === "Page numbers for this PDF"),
      ).toHaveLength(1);
    });
  }

  test.each([
    { choice: "inherit", expected: undefined },
    { choice: "enable", expected: true },
    { choice: "disable", expected: false },
  ] as const)(
    "maps the $choice page-number choice after direct source selection",
    ({ choice, expected }) => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [...ENTRY_SELECTIONS, "built-in", "inherit", choice, "cancel"],
        requiredPathQueue: ["fixtures/report.md"],
      });

      if (expected === undefined) {
        expect(result.markdownPdfPrepareCalls[0]).not.toHaveProperty("pageNumbers");
      } else {
        expect(result.markdownPdfPrepareCalls[0]).toHaveProperty("pageNumbers", expected);
      }
      expect(result.stderr).toContain(
        expected === undefined
          ? "- One-render override: use recipe setting"
          : expected
            ? "- One-render override: enable for this PDF"
            : "- One-render override: disable for this PDF",
      );
    },
  );

  test("changes page numbers from recipe review while preserving code highlighting", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...ENTRY_SELECTIONS,
        "built-in",
        "enable",
        "inherit",
        "change-page-numbers",
        "enable",
        "cancel",
      ],
      requiredPathQueue: ["fixtures/report.md"],
    });

    expect(result.markdownPdfPrepareCalls).toEqual([
      { input: "fixtures/report.md", codeHighlight: true, preparedId: "prepared-1" },
      {
        input: "fixtures/report.md",
        codeHighlight: true,
        pageNumbers: true,
        preparedId: "prepared-2",
      },
    ]);
    expect(result.markdownPdfPlanCalls).toEqual([]);
    expect(result.stderr).toContain("- Effective result: enabled");
  });

  test("changes code highlighting while preserving the page-number choice", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...ENTRY_SELECTIONS,
        "built-in",
        "inherit",
        "enable",
        "change-code-highlighting",
        "enable",
        "cancel",
      ],
      requiredPathQueue: ["fixtures/report.md"],
    });

    expect(result.markdownPdfPrepareCalls).toEqual([
      { input: "fixtures/report.md", pageNumbers: true, preparedId: "prepared-1" },
      {
        input: "fixtures/report.md",
        codeHighlight: true,
        pageNumbers: true,
        preparedId: "prepared-2",
      },
    ]);
  });

  test("keeps one prepared source when page-number review reselects the current choice", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...ENTRY_SELECTIONS,
        "built-in",
        "inherit",
        "inherit",
        "change-page-numbers",
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

  test("reprepares and rebinds the existing plan after a final-review page-number change", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...ENTRY_SELECTIONS,
        "built-in",
        "inherit",
        "inherit",
        "default",
        "change-page-numbers",
        "disable",
      ],
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, false, true],
    });

    expect(result.markdownPdfPrepareCalls).toEqual([
      { input: "fixtures/report.md", preparedId: "prepared-1" },
      { input: "fixtures/report.md", pageNumbers: false, preparedId: "prepared-2" },
    ]);
    expect(result.markdownPdfPlanCalls).toHaveLength(1);
    expect(result.markdownPdfExecuteCalls).toEqual([
      {
        outputPath: expect.stringMatching(/fixtures\/report\.pdf$/),
        preparedId: "prepared-2",
      },
    ]);
  });

  test.each(["back", "cancel", "inherit"] as const)(
    "handles final-review page-number %s without unintended preparation or planning",
    (pageNumberAction) => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [
          ...ENTRY_SELECTIONS,
          "built-in",
          "inherit",
          "inherit",
          "default",
          "change-page-numbers",
          pageNumberAction,
        ],
        requiredPathQueue: ["fixtures/report.md"],
        confirmQueue: pageNumberAction === "cancel" ? [false, false] : [false, false, true],
      });

      expect(result.markdownPdfPrepareCalls).toEqual([
        { input: "fixtures/report.md", preparedId: "prepared-1" },
      ]);
      expect(result.markdownPdfPlanCalls).toHaveLength(1);
      expect(result.markdownPdfExecuteCalls).toEqual(
        pageNumberAction === "cancel"
          ? []
          : [
              {
                outputPath: expect.stringMatching(/fixtures\/report\.pdf$/),
                preparedId: "prepared-1",
              },
            ],
      );
    },
  );

  test("resets page-number state when changing the selected recipe source", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...ENTRY_SELECTIONS,
        "built-in",
        "inherit",
        "enable",
        "change-source",
        "existing-profile",
        "inherit",
        "inherit",
        "cancel",
      ],
      requiredPathQueue: ["fixtures/report.md", "fixtures/profile.yml"],
    });

    expect(result.markdownPdfPrepareCalls[0]).toHaveProperty("pageNumbers", true);
    expect(result.markdownPdfPrepareCalls[1]).not.toHaveProperty("pageNumbers");
    expect(result.selectDefaultsByMessage["Page numbers for this PDF"]).toEqual([
      "inherit",
      "inherit",
    ]);
  });

  test("keeps review free of warnings and prints requested actual capability posture once", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfRenderWarnings: ["Page-number diagnostic warning"],
      markdownPdfRendererCapabilityRequests: [
        { capabilityId: "pageNumbers.start", requestedBy: ["pageNumbers.start"] },
      ],
      selectQueue: [...ENTRY_SELECTIONS, "existing-profile", "inherit", "inherit", "default"],
      requiredPathQueue: ["fixtures/report.md", "fixtures/profile.yml"],
      confirmQueue: [false, true],
    });

    expect(result.stderr.match(/Page-number diagnostic warning/g)).toHaveLength(1);
    expect(result.stderr.match(/Markdown PDF renderer capability assessment:/g)).toHaveLength(1);
    expect(result.stderr).toContain("- weasyprint: installed (69.0)");
    expect(result.stderr).toContain("- pageNumbers.start: satisfied, minimum=65.1");
    expect(result.stderr.indexOf("Final render review")).toBeLessThan(
      result.stderr.indexOf("Page-number diagnostic warning"),
    );
  });

  test("prints one accurate unsupported requested capability result only after execution", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfRendererCapabilityRequests: [
        { capabilityId: "pageNumbers.start", requestedBy: ["pageNumbers.start"] },
      ],
      markdownPdfRendererCapabilities: {
        renderer: { name: "weasyprint", available: true, version: "64.0" },
        capabilities: [
          {
            id: "pageNumbers.start",
            fields: ["pageNumbers.start"],
            minimumVersion: "65.1",
            status: "unsupported",
            diagnosticConditionId: "MARKDOWN_PDF_RENDERER_CAPABILITY_UNSUPPORTED",
          },
        ],
      },
      selectQueue: [...ENTRY_SELECTIONS, "existing-profile", "inherit", "inherit", "default"],
      requiredPathQueue: ["fixtures/report.md", "fixtures/profile.yml"],
      confirmQueue: [false, true],
    });

    expect(result.stderr.match(/Markdown PDF renderer capability assessment:/g)).toHaveLength(1);
    expect(result.stderr).toContain("- weasyprint: installed (64.0)");
    expect(result.stderr).toContain(
      "- pageNumbers.start: unsupported, minimum=65.1, diagnostic=MARKDOWN_PDF_RENDERER_CAPABILITY_UNSUPPORTED",
    );
    expect(result.stderr.lastIndexOf("Final render review")).toBeLessThan(
      result.stderr.indexOf("Markdown PDF renderer capability assessment:"),
    );
  });

  test("emits warnings and requested capability posture once after final-review backtracking", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfRenderWarnings: ["Page-number diagnostic warning"],
      markdownPdfRendererCapabilityRequests: [
        { capabilityId: "pageNumbers.start", requestedBy: ["pageNumbers.start"] },
      ],
      selectQueue: [
        ...ENTRY_SELECTIONS,
        "built-in",
        "inherit",
        "inherit",
        "default",
        "change-page-numbers",
        "enable",
      ],
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, false, true],
    });

    expect(result.markdownPdfPrepareCalls).toEqual([
      { input: "fixtures/report.md", preparedId: "prepared-1" },
      { input: "fixtures/report.md", pageNumbers: true, preparedId: "prepared-2" },
    ]);
    expect(result.selectChoicesByMessage["Final render next step"]).toContainEqual({
      name: "Change page numbers",
      value: "change-page-numbers",
    });
    expect(result.markdownPdfExecuteCalls).toEqual([
      {
        outputPath: expect.stringMatching(/fixtures\/report\.pdf$/),
        preparedId: "prepared-2",
      },
    ]);
    expect(result.stderr.match(/Page-number diagnostic warning/g)).toHaveLength(1);
    expect(result.stderr.match(/Markdown PDF renderer capability assessment:/g)).toHaveLength(1);
    expect(result.stderr.match(/Final render review/g)).toHaveLength(2);
    expect(result.stderr.lastIndexOf("Final render review")).toBeLessThan(
      result.stderr.indexOf("Page-number diagnostic warning"),
    );
    expect(result.stderr.lastIndexOf("Final render review")).toBeLessThan(
      result.stderr.indexOf("Markdown PDF renderer capability assessment:"),
    );
  });

  test("keeps code and non-inherited page state through recoverable output planning", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfOutputErrorMessages: ["Output already exists"],
      selectQueue: [...ENTRY_SELECTIONS, "built-in", "enable", "disable", "default", "custom"],
      requiredPathQueue: ["fixtures/report.md", "output/recovered.pdf"],
      confirmQueue: [false, true, true],
    });

    expect(result.markdownPdfPrepareCalls).toEqual([
      {
        input: "fixtures/report.md",
        codeHighlight: true,
        pageNumbers: false,
        preparedId: "prepared-1",
      },
    ]);
    expect(result.markdownPdfPlanCalls).toHaveLength(2);
    expect(result.markdownPdfPlanCalls.map((call) => call.preparedId)).toEqual([
      "prepared-1",
      "prepared-1",
    ]);
    expect(result.markdownPdfExecuteCalls).toEqual([
      {
        outputPath: expect.stringMatching(/output\/recovered\.pdf$/),
        preparedId: "prepared-1",
      },
    ]);
    expect(result.stderr).toContain("Render override:\n- Enable for this render");
    expect(result.stderr).toContain("- One-render override: disable for this PDF");
  });

  test("rejects effective page numbers when the selected render disables default CSS", () => {
    const result = runInteractiveHarness(
      {
        mode: "run",
        markdownPdfMocks: true,
        markdownPdfNoDefaultCss: true,
        selectQueue: [...ENTRY_SELECTIONS, "built-in", "inherit", "enable"],
        requiredPathQueue: ["fixtures/report.md"],
      },
      { allowFailure: true },
    );

    expect(result.error).toContain(
      "Effective page numbers require the generated default stylesheet",
    );
    expect(result.markdownPdfPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfPlanCalls).toEqual([]);
    expect(result.markdownPdfExecuteCalls).toEqual([]);
  });

  test("rejects inherited enabled Profile page numbers when default CSS is disabled", () => {
    const result = runInteractiveHarness(
      {
        mode: "run",
        markdownPdfMocks: true,
        markdownPdfNoDefaultCss: true,
        markdownPdfProfilePageNumbersEnabled: true,
        selectQueue: [...ENTRY_SELECTIONS, "existing-profile", "inherit", "inherit"],
        requiredPathQueue: ["fixtures/report.md", "fixtures/profile.yml"],
      },
      { allowFailure: true },
    );

    expect(result.error).toContain(
      "Effective page numbers require the generated default stylesheet",
    );
    expect(result.markdownPdfPrepareCalls).toEqual([
      {
        input: "fixtures/report.md",
        profile: "fixtures/profile.yml",
        preparedId: "prepared-1",
      },
    ]);
    expect(result.markdownPdfPlanCalls).toEqual([]);
    expect(result.markdownPdfExecuteCalls).toEqual([]);
  });
});
