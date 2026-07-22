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

  test("offers the full helper-aligned Codex matrix from to-pdf", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      requiredPathQueue: ["fixtures/report.md"],
      inputQueue: [""],
      confirmQueue: [false],
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
    ).toEqual(["starter", "formal-guide", "codex-assistant", "back", "cancel"]);
    expect(result.promptCalls.some((call) => call.message === "Markdown preparation sample")).toBe(
      false,
    );
    expect(result.stderr).toContain("Project bundles are prepared with Codex Assistant.");
    expect(result.markdownPdfCodexPrepareCalls).toEqual([]);
  });

  test.each(["profile", "template-bundle"] as const)(
    "reuses the selected to-pdf Markdown input for %s Codex preparation",
    (artifact) => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        requiredPathQueue: ["fixtures/report.md"],
        inputQueue: ["Editorial report"],
        confirmQueue: [false, true],
        selectQueue: [
          ...TO_PDF_ENTRY,
          "generated",
          artifact,
          "codex-assistant",
          "continue",
          "cancel",
        ],
      });

      expect(result.markdownPdfCodexPrepareCalls).toEqual([
        expect.objectContaining({
          artifact,
          intent: "Editorial report",
          sample: "fixtures/report.md",
        }),
      ]);
      expect(
        result.promptCalls.some((call) => call.message === "Markdown preparation sample"),
      ).toBe(false);
    },
  );

  test("keeps the optional sample in pdf-recipes and treats blank intent as empty", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...recipesCodexSelections("profile"), "continue", "cancel"],
      inputQueue: ["   "],
      confirmQueue: [false, false],
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
      confirmQueue: [false],
    });

    const setupMessage =
      artifact === "profile"
        ? "Profile setup next step"
        : artifact === "template-bundle"
          ? "Template bundle setup next step"
          : "Project bundle setup next step";
    const choices = result.selectChoicesByMessage[setupMessage]?.map((choice) => choice.value);
    expect(choices).toEqual([
      "intent",
      "base-profile",
      ...(hasCoverChoice ? ["cover-image"] : []),
      "font-hints",
      "continue",
      "back",
      "cancel",
    ]);
  });

  test("collects optional multiline PDF intent before the setup review", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...recipesCodexSelections("profile"), "continue", "cancel"],
      editorQueue: ["  Restrained report\nwith compact tables  "],
      confirmQueue: [true, true],
    });

    expect(result.promptCalls).toContainEqual({
      kind: "editor",
      message:
        "Describe the PDF intent:\n  Optional. Describe the audience, tone, layout, or visual direction.",
      defaultValue: "",
      postfix: ".md",
    });
    expect(result.markdownPdfCodexPrepareCalls).toEqual([
      expect.objectContaining({ intent: "Restrained report\nwith compact tables" }),
    ]);
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
      confirmQueue: [false],
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
      confirmQueue: [false, true],
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
      confirmQueue: [false, false, false, true],
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
      confirmQueue: [false, true, true],
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
          "exit",
        ],
        inputQueue: [""],
        confirmQueue: [false, true, false, true],
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
        "exit",
      ],
      inputQueue: [""],
      requiredPathQueue: ["reports/first.json", "recipes/first.yml", "recipes/final.yml"],
      confirmQueue: [false, true, false, true, true],
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
        confirmQueue: [false, true],
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
          "exit",
        ],
        inputQueue: [""],
        requiredPathQueue: [output],
        confirmQueue: [false, true, false, true],
      });

      expect(result.markdownPdfCodexBindCalls).toEqual([expect.objectContaining({ output })]);
      expect(result.markdownPdfCodexWriteCalls).toHaveLength(1);
    },
  );

  test("uses an explicit Project save output exactly for a durable save", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...recipesCodexSelections("project-bundle"),
        "continue",
        "save",
        "none",
        "custom",
        "exit",
      ],
      inputQueue: [""],
      requiredPathQueue: ["recipes/exact-project"],
      confirmQueue: [false, true, false, true],
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
        confirmQueue: [false, true],
      });

      expect(result.stderr).toContain("Codex request: no usable candidate");
      expect(
        result.selectChoicesByMessage["Recipe review next step"]?.map((choice) => choice.value),
      ).toEqual(["regenerate", "change-setup", "change-artifact", "cancel"]);
      expect(result.markdownPdfCodexBindCalls).toEqual([]);
      expect(result.markdownPdfCodexWriteCalls).toEqual([]);
    },
  );

  test("temporary Project rendering resolves output only after lifecycle choice", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "project-bundle",
        "continue",
        "temporary-render",
        "none",
        "default",
      ],
      inputQueue: [""],
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, true, false, true],
    });

    expect(result.markdownPdfCodexPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfCodexBindCalls).toHaveLength(1);
    expect(result.markdownPdfCodexWriteCalls).toHaveLength(1);
    expect(result.markdownPdfExecuteCalls).toHaveLength(1);
  });

  test.each([
    ["temporary-render", "external"],
    ["save-and-render", "with-artifact"],
  ] as const)(
    "materializes and renders accepted to-pdf lifecycle %s after report selection",
    (lifecycle, report) => {
      const requiredPathQueue = ["fixtures/report.md"];
      if (report === "external") {
        requiredPathQueue.push("reports/render.json");
      }
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [
          ...TO_PDF_ENTRY,
          "generated",
          "project-bundle",
          "continue",
          lifecycle,
          report,
          ...(lifecycle === "save-and-render" ? ["suggested"] : []),
          "default",
        ],
        inputQueue: [""],
        requiredPathQueue,
        confirmQueue:
          lifecycle === "save-and-render"
            ? [false, true, false, false, true]
            : [false, true, false, true],
      });

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
      expect(result.markdownPdfCodexBindCalls).toHaveLength(1);
      expect(result.markdownPdfCodexWriteCalls).toHaveLength(1);
      expect(result.markdownPdfPlanCalls).toHaveLength(1);
      expect(result.markdownPdfExecuteCalls).toHaveLength(1);
    },
  );
});
