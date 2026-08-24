import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "../../cli-foundations/interactive-harness";
import {
  RECIPES_ENTRY,
  TO_PDF_ENTRY,
  recipesCodexSelections,
} from "../../markdown-pdf/interactive/codex-authoring-fixtures";

describe("interactive Markdown PDF Codex authoring", () => {
  test.each(["profile", "template-bundle", "project-bundle"] as const)(
    "uses the configured Interactive timeout for %s preparation without adding a prompt",
    (artifact) => {
      const result = runInteractiveHarness({
        codexTimeoutMs: 120_000,
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [...recipesCodexSelections(artifact), "continue", "cancel"],
        inputQueue: [""],
        confirmQueue: [false, true],
      });

      expect(result.markdownPdfCodexPrepareCalls).toEqual([
        expect.objectContaining({
          artifact,
          timeoutMs: 120_000,
        }),
      ]);
      expect(
        result.promptCalls.every((call) => !call.message.toLowerCase().includes("timeout")),
      ).toBe(true);
    },
  );

  test("uses the default Interactive timeout for omitted Markdown Codex configuration", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [...recipesCodexSelections("profile"), "continue", "cancel"],
      inputQueue: [""],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfCodexPrepareCalls).toEqual([
      expect.objectContaining({ timeoutMs: 30_000 }),
    ]);
  });

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
        codexTimeoutMs: 120_000,
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
          timeoutMs: 120_000,
        }),
      ]);
      expect(
        result.promptCalls.some((call) => call.message === "Markdown preparation sample"),
      ).toBe(false);
      expect(result.promptCalls).toContainEqual({
        kind: "input",
        message: "PDF intent (optional)\n ",
        defaultValue: "",
      });
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
      message: "PDF intent (optional)",
      defaultValue: "",
      postfix: ".md",
    });
    expect(result.markdownPdfCodexPrepareCalls).toEqual([
      expect.objectContaining({ intent: "Restrained report\nwith compact tables" }),
    ]);
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
});
