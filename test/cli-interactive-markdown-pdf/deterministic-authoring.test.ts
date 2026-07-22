import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "../cli-interactive-routing.helpers";

const RECIPES_ENTRY = ["md", "md:pdf-recipes"];
const TO_PDF_ENTRY = ["md", "md:to-pdf"];

describe("interactive Markdown PDF deterministic authoring", () => {
  test("prepares, reviews, binds, and saves one starter Profile", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...RECIPES_ENTRY, "profile", "starter", "save"],
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
      selectQueue: [...RECIPES_ENTRY, "template-bundle", "starter", "save"],
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
        "revise-margins",
        "custom",
        "save",
      ],
      inputQueue: ["15mm", "10mm", "11mm", "12mm", "13mm"],
      requiredPathQueue: ["recipes/formal.json"],
      confirmQueue: [true, false, true],
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
  });

  test("changes durable output without preparing the candidate again", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...RECIPES_ENTRY, "profile", "starter", "save", "change-output"],
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

  test("keeps Project and Codex modes out of the deterministic Phase 4 matrix", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...RECIPES_ENTRY, "profile", "back", "cancel"],
    });

    expect(
      result.selectChoicesByMessage["What would you like to create?"]?.map(
        (choice) => choice.value,
      ),
    ).toEqual(["profile", "template-bundle", "back", "cancel"]);
    expect(
      result.selectChoicesByMessage["Choose preparation mode"]?.map((choice) => choice.value),
    ).toEqual(["starter", "formal-guide", "back", "cancel"]);
    expect(result.markdownPdfDeterministicPrepareCalls).toEqual([]);
  });

  test.each([
    ["temporary render", "profile", "temporary-render"],
    ["save and render", "template-bundle", "save-and-render"],
  ] as const)(
    "fails closed for deferred to-pdf %s before any materialization",
    (_label, artifact, lifecycle) => {
      const result = runInteractiveHarness(
        {
          mode: "run",
          markdownPdfMocks: true,
          selectQueue: [...TO_PDF_ENTRY, "generated", artifact, "starter", lifecycle],
          requiredPathQueue: ["fixtures/report.md"],
        },
        { allowFailure: true },
      );

      expect(result.error).toBe(
        "Interactive rendering for a generated Markdown PDF recipe is not implemented yet.",
      );
      expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(1);
      expect(result.markdownPdfDeterministicBindCalls).toEqual([]);
      expect(result.markdownPdfDeterministicWriteCalls).toEqual([]);
      expect(result.markdownPdfPlanCalls).toEqual([]);
      expect(result.markdownPdfExecuteCalls).toEqual([]);
      expect(result.removedPaths).toEqual([]);
    },
  );

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
