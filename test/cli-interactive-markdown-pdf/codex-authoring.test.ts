import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "../cli-interactive-routing.helpers";

const RECIPES_ENTRY = ["md", "md:pdf-recipes"];
const TO_PDF_ENTRY = ["md", "md:to-pdf"];

type CodexArtifact = "profile" | "template-bundle" | "project-bundle";

function recipesCodexSelections(artifact: CodexArtifact): string[] {
  return [
    ...RECIPES_ENTRY,
    artifact,
    ...(artifact === "project-bundle" ? [] : ["codex-assistant"]),
    "none",
  ];
}

describe("interactive Markdown PDF Codex authoring", () => {
  test("offers Profile, Template, and direct Project Codex authoring from pdf-recipes", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...RECIPES_ENTRY,
        "profile",
        "back",
        "template-bundle",
        "back",
        "project-bundle",
        "back",
        "cancel",
      ],
    });

    expect(
      result.selectChoicesByMessage["What would you like to create?"]?.map(
        (choice) => choice.value,
      ),
    ).toEqual(["profile", "template-bundle", "project-bundle", "back", "cancel"]);
    expect(
      result.selectChoicesByMessage["Choose preparation mode"]?.map((choice) => choice.value),
    ).toEqual(["starter", "formal-guide", "codex-assistant", "back", "cancel"]);
    expect(result.stderr).toContain("Project bundles are prepared with Codex Assistant.");
    expect(result.markdownPdfCodexPrepareCalls).toEqual([]);
  });

  test("offers direct Project authoring from to-pdf without Profile or Template Codex modes", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      requiredPathQueue: ["fixtures/report.md"],
      inputQueue: [""],
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "profile",
        "back",
        "template-bundle",
        "back",
        "project-bundle",
        "cancel",
      ],
    });

    expect(
      result.selectChoicesByMessage["What would you like to create?"]?.map(
        (choice) => choice.value,
      ),
    ).toContain("project-bundle");
    expect(
      result.selectChoicesByMessage["Choose preparation mode"]?.map((choice) => choice.value),
    ).toEqual(["starter", "formal-guide", "back", "cancel"]);
    expect(result.promptCalls.some((call) => call.message === "Markdown preparation sample")).toBe(
      false,
    );
    expect(result.stderr).toContain("Project bundles are prepared with Codex Assistant.");
    expect(result.markdownPdfCodexPrepareCalls).toEqual([]);
  });

  test("keeps the optional sample in pdf-recipes and treats blank intent as empty", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...recipesCodexSelections("profile"), "continue", "cancel"],
      inputQueue: ["   "],
      confirmQueue: [false],
    });

    expect(result.promptCalls).toContainEqual({
      kind: "select",
      message: "Markdown preparation sample",
    });
    expect(result.stderr).toContain("Intent: none");
    expect(result.markdownPdfCodexPrepareCalls).toEqual([]);
    expect(result.markdownPdfCodexBindCalls).toEqual([]);
    expect(result.markdownPdfCodexWriteCalls).toEqual([]);
  });

  test.each([
    ["profile", false],
    ["template-bundle", true],
    ["project-bundle", true],
  ] as const)("shows artifact-specific setup choices for %s", (artifact, hasCoverChoice) => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...recipesCodexSelections(artifact), "cancel"],
      inputQueue: [""],
    });

    const setupMessage =
      artifact === "profile"
        ? "Profile setup next step"
        : artifact === "template-bundle"
          ? "Template bundle setup next step"
          : "Project bundle setup next step";
    const choices = result.selectChoicesByMessage[setupMessage]?.map((choice) => choice.value);
    expect(choices?.includes("cover-image")).toBe(hasCoverChoice);
    expect(choices?.includes("output")).toBe(artifact === "project-bundle");
  });

  test("adds and removes font hints and retains a Template cover choice", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...recipesCodexSelections("template-bundle"),
        "font-hints",
        "add",
        "add",
        "remove",
        "Inter",
        "done",
        "cover-image",
        "continue",
        "cancel",
      ],
      inputQueue: ["", "Inter", "Source Serif 4"],
      requiredPathQueue: ["fixtures/cover.png"],
      confirmQueue: [true],
    });

    expect(result.markdownPdfCodexPrepareCalls).toEqual([
      expect.objectContaining({
        artifact: "template-bundle",
        candidateId: "codex-template-bundle-1",
        coverImage: "fixtures/cover.png",
        fontHints: ["Source Serif 4"],
      }),
    ]);
    expect(result.markdownPdfCodexWriteCalls).toEqual([]);
  });

  test("offers base-profile and cover-image clearing only when those values are set", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...recipesCodexSelections("template-bundle"),
        "base-profile",
        "cover-image",
        "cancel",
      ],
      inputQueue: [""],
      requiredPathQueue: ["fixtures/base.yml", "fixtures/cover.png"],
    });

    expect(
      result.selectChoicesByMessage["Template bundle setup next step"]?.map(
        (choice) => choice.value,
      ),
    ).toEqual(expect.arrayContaining(["clear-base-profile", "clear-cover-image"]));
  });

  test("clears selected base-profile and cover-image values before preparation", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...recipesCodexSelections("template-bundle"),
        "base-profile",
        "cover-image",
        "clear-base-profile",
        "clear-cover-image",
        "continue",
        "cancel",
      ],
      inputQueue: [""],
      requiredPathQueue: ["fixtures/base.yml", "fixtures/cover.png"],
      confirmQueue: [true],
    });

    expect(result.markdownPdfCodexPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfCodexPrepareCalls[0]?.baseProfile).toBeUndefined();
    expect(result.markdownPdfCodexPrepareCalls[0]?.coverImage).toBeUndefined();
  });

  test("declining consent, revising setup, and re-consenting prepares exactly once", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...recipesCodexSelections("profile"),
        "continue",
        "setup",
        "intent",
        "continue",
        "cancel",
      ],
      inputQueue: ["", "Revised direction"],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfCodexPrepareCalls).toEqual([
      expect.objectContaining({ intent: "Revised direction" }),
    ]);
    expect(result.markdownPdfCodexBindCalls).toEqual([]);
    expect(result.markdownPdfCodexWriteCalls).toEqual([]);
  });

  test("prepares a new stable candidate only after explicit regeneration", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...recipesCodexSelections("profile"), "continue", "regenerate", "cancel"],
      inputQueue: [""],
      confirmQueue: [true, true],
    });

    expect(result.markdownPdfCodexPrepareCalls).toEqual([
      expect.objectContaining({
        artifact: "profile",
        artifactCount: 1,
        candidateId: "codex-profile-1",
      }),
      expect.objectContaining({
        artifact: "profile",
        artifactCount: 2,
        candidateId: "codex-profile-2",
      }),
    ]);
    expect(result.markdownPdfCodexBindCalls).toEqual([]);
    expect(result.markdownPdfCodexWriteCalls).toEqual([]);
  });

  test.each(["profile", "template-bundle", "project-bundle"] as const)(
    "binds and writes one durable %s candidate once",
    (artifact) => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [
          ...recipesCodexSelections(artifact),
          "continue",
          "save",
          "with-artifact",
          "suggested",
        ],
        inputQueue: [""],
        confirmQueue: [true, false, true],
      });

      const candidateId = `codex-${artifact}-1`;
      expect(result.markdownPdfCodexPrepareCalls).toEqual([
        expect.objectContaining({ artifact, artifactCount: 1, candidateId }),
      ]);
      expect(result.markdownPdfCodexBindCalls).toEqual([
        expect.objectContaining({
          artifact,
          candidateId,
          output: expect.stringContaining(candidateId),
          overwrite: false,
          report: { kind: "with-artifact" },
        }),
      ]);
      expect(result.markdownPdfCodexWriteCalls).toEqual([
        expect.objectContaining({
          artifact,
          candidateId,
          overwrite: false,
          report: { kind: "with-artifact" },
        }),
      ]);
      expect(result.markdownPdfCodexWriteCalls[0]?.outputFiles).toEqual(
        expect.arrayContaining([expect.stringContaining("codex-report.json")]),
      );
    },
  );

  test("changes output and report binding without preparing the candidate again", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfCodexBindErrorMessage: "Output already exists",
      selectQueue: [
        ...recipesCodexSelections("profile"),
        "continue",
        "save",
        "external",
        "custom",
        "review",
        "save",
        "none",
        "custom",
      ],
      inputQueue: [""],
      requiredPathQueue: ["reports/first.json", "recipes/first.yml", "recipes/final.yml"],
      confirmQueue: [true, false, true, true],
    });

    expect(result.markdownPdfCodexPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfCodexBindCalls).toEqual([
      expect.objectContaining({
        candidateId: "codex-profile-1",
        output: "recipes/first.yml",
        report: { kind: "external", path: "reports/first.json" },
      }),
      expect.objectContaining({
        candidateId: "codex-profile-1",
        output: "recipes/final.yml",
        report: { kind: "none" },
      }),
    ]);
    expect(result.markdownPdfCodexWriteCalls).toEqual([
      expect.objectContaining({
        candidateId: "codex-profile-1",
        outputPath: "recipes/final.yml",
      }),
    ]);
    expect(result.stderr).toContain("Unable to save recipe: Output already exists");
  });

  test.each(["review", "cancel"] as const)(
    "offers immediate %s from output selection without destination binding",
    (next) => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [
          ...recipesCodexSelections("profile"),
          "continue",
          "save",
          "none",
          next,
          ...(next === "review" ? ["cancel"] : []),
        ],
        inputQueue: [""],
        confirmQueue: [true],
      });

      expect(
        result.selectChoicesByMessage["Profile output destination"]?.map((choice) => choice.value),
      ).toEqual(["suggested", "custom", "review", "cancel"]);
      expect(result.markdownPdfCodexPrepareCalls).toHaveLength(1);
      expect(result.markdownPdfCodexBindCalls).toEqual([]);
      expect(result.markdownPdfCodexWriteCalls).toEqual([]);
    },
  );

  test.each(["review", "cancel"] as const)(
    "treats the custom output path %s as a destination instead of navigation",
    (output) => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [
          ...recipesCodexSelections("template-bundle"),
          "continue",
          "save",
          "none",
          "custom",
        ],
        inputQueue: [""],
        requiredPathQueue: [output],
        confirmQueue: [true, false, true],
      });

      expect(result.markdownPdfCodexBindCalls).toEqual([expect.objectContaining({ output })]);
      expect(result.markdownPdfCodexWriteCalls).toHaveLength(1);
    },
  );

  test("uses an explicit Project setup output exactly for a durable save", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...recipesCodexSelections("project-bundle"),
        "output",
        "continue",
        "save",
        "none",
        "suggested",
      ],
      inputQueue: [""],
      requiredPathQueue: ["recipes/exact-project"],
      confirmQueue: [true, false, true],
    });

    expect(result.markdownPdfCodexBindCalls).toEqual([
      expect.objectContaining({ output: "recipes/exact-project" }),
    ]);
  });

  test.each(["profile", "template-bundle", "project-bundle"] as const)(
    "removes acceptance actions for an unusable %s candidate",
    (artifact) => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        markdownPdfCodexUnusableArtifacts: [artifact],
        selectQueue: [...recipesCodexSelections(artifact), "continue", "cancel"],
        inputQueue: [""],
        confirmQueue: [true],
      });

      expect(result.stderr).toContain("Codex request: no usable candidate");
      expect(
        result.selectChoicesByMessage["Recipe review next step"]?.map((choice) => choice.value),
      ).toEqual(["regenerate", "change-setup", "change-artifact", "cancel"]);
      expect(result.markdownPdfCodexBindCalls).toEqual([]);
      expect(result.markdownPdfCodexWriteCalls).toEqual([]);
    },
  );

  test("temporary Project rendering ignores an explicit durable output preference", () => {
    const result = runInteractiveHarness(
      {
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [
          ...TO_PDF_ENTRY,
          "generated",
          "project-bundle",
          "output",
          "continue",
          "temporary-render",
          "none",
        ],
        inputQueue: [""],
        requiredPathQueue: ["fixtures/report.md", "recipes/durable-project"],
        confirmQueue: [true],
      },
      { allowFailure: true },
    );

    expect(result.error).toBe(
      "Interactive materialization for an accepted Markdown PDF recipe is not implemented yet.",
    );
    expect(result.markdownPdfCodexPrepareCalls).toEqual([
      expect.objectContaining({ outputPreference: "recipes/durable-project" }),
    ]);
    expect(result.markdownPdfCodexBindCalls).toEqual([]);
    expect(result.markdownPdfCodexWriteCalls).toEqual([]);
  });

  test.each([
    ["temporary-render", "external"],
    ["save-and-render", "with-artifact"],
  ] as const)(
    "keeps accepted to-pdf lifecycle %s fail-closed after report selection",
    (lifecycle, report) => {
      const requiredPathQueue = ["fixtures/report.md"];
      if (report === "external") {
        requiredPathQueue.push("reports/render.json");
      }
      const result = runInteractiveHarness(
        {
          mode: "run",
          markdownPdfMocks: true,
          selectQueue: [
            ...TO_PDF_ENTRY,
            "generated",
            "project-bundle",
            "continue",
            lifecycle,
            report,
          ],
          inputQueue: [""],
          requiredPathQueue,
          confirmQueue: [true],
        },
        { allowFailure: true },
      );

      expect(result.error).toBe(
        "Interactive materialization for an accepted Markdown PDF recipe is not implemented yet.",
      );
      expect(result.markdownPdfCodexPrepareCalls).toEqual([
        expect.objectContaining({
          artifact: "project-bundle",
          candidateId: "codex-project-bundle-1",
          sample: "fixtures/report.md",
        }),
      ]);
      expect(
        result.promptCalls.some((call) => call.message === "Markdown preparation sample"),
      ).toBe(false);
      expect(result.promptCalls).toContainEqual({
        kind: "select",
        message: "Keep a Codex diagnostic report?",
      });
      expect(result.markdownPdfCodexBindCalls).toEqual([]);
      expect(result.markdownPdfCodexWriteCalls).toEqual([]);
      expect(result.markdownPdfPlanCalls).toEqual([]);
      expect(result.markdownPdfExecuteCalls).toEqual([]);
    },
  );
});
