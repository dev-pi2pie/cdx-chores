import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "../../cli-foundations/interactive-harness";
import {
  TO_PDF_ENTRY,
  recipesCodexSelections,
} from "../../markdown-pdf/interactive/codex-authoring-fixtures";

describe("interactive Markdown PDF Codex authoring", () => {
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
      codexTimeoutMs: 120_000,
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
        timeoutMs: 120_000,
      }),
      expect.objectContaining({
        artifact: "profile",
        artifactCount: 2,
        candidateId: "codex-profile-2",
        timeoutMs: 120_000,
      }),
    ]);
    expect(result.markdownPdfCodexBindCalls).toEqual([]);
    expect(result.markdownPdfCodexWriteCalls).toEqual([]);
  });

  test("preserves the accepted candidate after a no-op font-hint review", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...recipesCodexSelections("profile"),
        "continue",
        "change-setup",
        "font-hints",
        "done",
        "continue",
        "cancel",
      ],
      inputQueue: [""],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfCodexPrepareCalls).toHaveLength(1);
    expect(
      result.promptCalls.filter(
        (call) =>
          call.kind === "confirm" &&
          call.message === "Send this intent and prepared document signals to Codex Assistant?",
      ),
    ).toHaveLength(1);
  });

  test("invalidates the candidate only after an accepted font-hint change", () => {
    const result = runInteractiveHarness({
      codexTimeoutMs: 120_000,
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...recipesCodexSelections("profile"),
        "continue",
        "change-setup",
        "font-hints",
        "custom",
        "accept",
        "done",
        "continue",
        "cancel",
      ],
      inputQueue: ["", "Prefer Inter for headings and titles"],
      confirmQueue: [false, true, true],
    });

    expect(result.markdownPdfCodexPrepareCalls).toHaveLength(2);
    expect(result.markdownPdfCodexPrepareCalls.map((call) => call.timeoutMs)).toEqual([
      120_000, 120_000,
    ]);
    expect(result.markdownPdfCodexPrepareCalls[1]?.fontHints).toEqual([
      "Prefer Inter for headings and titles",
    ]);
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
      expect(result.markdownPdfCodexPrepareCalls[0]).not.toHaveProperty("codexTimeoutMs");
      expect(result.markdownPdfCodexBindCalls[0]).not.toHaveProperty("timeoutMs");
      expect(result.markdownPdfCodexWriteCalls[0]).not.toHaveProperty("timeoutMs");
    },
  );

  test("resets the retained override after Codex regeneration", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "project-bundle",
        "continue",
        "temporary-render",
        "enable",
        "inherit",
        "none",
        "default",
        "review",
        "regenerate",
        "temporary-render",
        "cancel",
      ],
      inputQueue: [""],
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, true, false, false, true],
    });

    expect(result.markdownPdfCodexPrepareCalls.map((call) => call.candidateId)).toEqual([
      "codex-project-bundle-1",
      "codex-project-bundle-2",
    ]);
    expect(result.selectDefaultsByMessage["Code highlighting for this PDF"]).toEqual([
      "inherit",
      "inherit",
    ]);
    expect(result.promptCalls.filter((call) => call.message === "Choose preparation mode")).toEqual(
      [],
    );
    expect(result.markdownPdfCodexBindCalls).toEqual([]);
    expect(result.markdownPdfCodexWriteCalls).toEqual([]);
  });
});
