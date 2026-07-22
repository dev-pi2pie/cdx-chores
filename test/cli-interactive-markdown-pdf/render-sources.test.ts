import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "../cli-interactive-routing.helpers";

const ENTRY_SELECTIONS = ["md", "md:to-pdf"];

describe("interactive Markdown PDF render sources", () => {
  test("prepares, reviews, plans, and renders the built-in recipe once", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...ENTRY_SELECTIONS, "built-in", "default"],
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
    expect(result.stderr).toContain("Dry run: no files have been written.");
    expect(result.stderr.indexOf("Markdown PDF recipe review")).toBeLessThan(
      result.stderr.indexOf("Final render review"),
    );
  });

  test("maps an existing Profile to one explicit prepared role", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...ENTRY_SELECTIONS, "existing-profile", "default"],
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

  test("reviews discovered bundle roles and ignored-file warnings", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfBundleRoles: ["profile", "template", "css"],
      markdownPdfIgnoredBundleFiles: ["notes.yml"],
      selectQueue: [...ENTRY_SELECTIONS, "existing-bundle", "default"],
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
      selectQueue: [...ENTRY_SELECTIONS, "custom-inputs", "explicit", "default"],
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
      selectQueue: [...ENTRY_SELECTIONS, "custom-inputs", "bundle-with-explicit", "default"],
      checkboxQueue: [["template"]],
      requiredPathQueue: ["fixtures/report.md", "fixtures/report-bundle", "fixtures/custom.html"],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfBundleDiscoveryCalls).toEqual([
      {
        directory: expect.stringMatching(/fixtures\/report-bundle$/),
        options: { mode: "preview" },
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
      selectQueue: [...ENTRY_SELECTIONS, "custom-inputs", "back", "built-in", "default"],
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

  test("changes PDF output without preparing the recipe again", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...ENTRY_SELECTIONS, "built-in", "default", "change-output", "custom"],
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

  test("plans a custom output and preserves explicit overwrite intent", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...ENTRY_SELECTIONS, "built-in", "custom"],
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
        "change-source",
        "existing-profile",
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
      selectQueue: [...ENTRY_SELECTIONS, "built-in", "default"],
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, true],
    });

    expect(result.stderr).toContain("Markdown PDF render warnings:");
    expect(result.stderr).toContain("- Fallback font used");
    expect(result.stderr).toContain("- Cover image was resized");
    expect(result.stdout).toContain("Wrote PDF:");
  });

  test("stops before output selection when authoritative bundle preparation fails", () => {
    const result = runInteractiveHarness(
      {
        mode: "run",
        markdownPdfMocks: true,
        markdownPdfPrepareErrorMessage: "Bundle has unresolved Profile candidates.",
        selectQueue: [...ENTRY_SELECTIONS, "existing-bundle"],
        requiredPathQueue: ["fixtures/report.md", "fixtures/ambiguous-bundle"],
      },
      { allowFailure: true },
    );

    expect(result.error).toBe("Bundle has unresolved Profile candidates.");
    expect(result.markdownPdfPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfPlanCalls).toEqual([]);
    expect(result.markdownPdfExecuteCalls).toEqual([]);
  });

  test("cancels without planning or rendering", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...ENTRY_SELECTIONS, "built-in", "cancel"],
      requiredPathQueue: ["fixtures/report.md"],
    });

    expect(result.markdownPdfPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfPlanCalls).toEqual([]);
    expect(result.markdownPdfExecuteCalls).toEqual([]);
    expect(result.removedPaths).toEqual([]);
  });
});
