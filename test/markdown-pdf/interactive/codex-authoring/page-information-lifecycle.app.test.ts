import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "../../../cli-foundations/interactive-harness";
import { RECIPES_ENTRY, TO_PDF_ENTRY } from "../codex-authoring-fixtures";

function entry(artifact: "profile" | "project-bundle") {
  return [
    ...RECIPES_ENTRY,
    artifact,
    ...(artifact === "profile" ? ["codex-assistant"] : []),
    "none",
  ];
}

function numberedPageInformation() {
  return ["edit", "numbers", "body", "page", "bottom-center", "continue"];
}

describe("Interactive Codex page-information candidate lifecycle", () => {
  test("requires an explicit first page-information choice in new harness scenarios", () => {
    const result = runInteractiveHarness(
      {
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [...entry("profile"), "continue"],
      },
      { allowFailure: true },
    );

    expect(result.error).toBe(
      "Unexpected selection at Specify page information in this Profile?: continue",
    );
    expect(result.markdownPdfCodexPrepareCalls).toEqual([]);
  });

  test.each(["profile", "project-bundle"] as const)(
    "%s prepares and saves explicit page information without an unnecessary model consent",
    (artifact) => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [
          ...entry(artifact),
          ...numberedPageInformation(),
          "continue",
          "save",
          "none",
          "suggested",
          "exit",
        ],
        inputQueue: [""],
        confirmQueue: [true, false, false, true],
      });

      expect(result.markdownPdfCodexPrepareCalls).toEqual([
        expect.objectContaining({
          artifact,
          pageInformation: {
            pageNumbers: expect.objectContaining({
              enabled: true,
              position: "bottom-center",
              format: "Page {page}",
            }),
          },
        }),
      ]);
      expect(result.markdownPdfCodexBindCalls).toEqual([
        expect.objectContaining({ artifact, candidateId: `codex-${artifact}-1` }),
      ]);
      expect(result.markdownPdfCodexWriteCalls).toEqual([
        expect.objectContaining({ artifact, candidateId: `codex-${artifact}-1` }),
      ]);
      expect(
        result.promptCalls.filter((call) =>
          call.message.includes("Send these prepared signals to Codex Assistant?"),
        ),
      ).toHaveLength(0);
    },
  );

  test("keeps the saved Profile while one-render numbers OFF recovers without repreparation", () => {
    const savedProfile = {
      pageNumbers: {
        enabled: true,
        scope: "body",
        countFrom: "body",
        start: 1,
        increment: 1,
        position: "bottom-center",
        format: "Page {page}",
      },
      footer: { center: "Retained footer text" },
    };
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfCodexFinalProfile: savedProfile,
      markdownPdfPrepareErrorMessages: ["bundle admission failed"],
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "profile",
        "codex-assistant",
        ...numberedPageInformation(),
        "continue",
        "save-and-render",
        "inherit",
        "inherit",
        "none",
        "suggested",
        "default",
        "review",
        "save-and-render",
        "inherit",
        "disable",
        "none",
      ],
      inputQueue: [""],
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [true, false, true, false, false, true, true],
    });

    expect(result.markdownPdfCodexPrepareCalls).toEqual([
      expect.objectContaining({
        candidateId: "codex-profile-1",
        pageInformation: {
          pageNumbers: expect.objectContaining({ enabled: true, format: "Page {page}" }),
        },
      }),
    ]);
    expect(result.markdownPdfCodexBindCalls).toHaveLength(1);
    expect(result.markdownPdfCodexWriteCalls).toEqual([
      expect.objectContaining({ candidateId: "codex-profile-1", savedProfile }),
    ]);
    expect(result.markdownPdfPrepareCalls).toHaveLength(2);
    expect(result.markdownPdfPrepareCalls[0]).not.toHaveProperty("pageNumbers");
    expect(result.markdownPdfPrepareCalls[1]).toEqual(
      expect.objectContaining({ pageNumbers: false }),
    );
    expect(result.markdownPdfExecuteCalls).toHaveLength(1);
    expect(result.stderr).toContain("bundle admission failed");
    expect(result.selectChoicesByMessage).toHaveProperty("Renderer preparation recovery");
    expect(result.selectDefaultsByMessage["Page numbers for this PDF"]).toEqual([
      "inherit",
      "inherit",
    ]);
  });

  test("saves and renders a Project with explicit page numbers and repeating text", () => {
    const savedProfile = {
      pageNumbers: {
        enabled: true,
        scope: "body",
        countFrom: "body",
        start: 1,
        increment: 1,
        position: "bottom-center",
        format: "Page {page}",
      },
      header: { left: "Exact Project header" },
    };
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfCodexFinalProfile: savedProfile,
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "project-bundle",
        "edit",
        "numbers",
        "body",
        "page",
        "bottom-center",
        "repeating",
        "continue",
        "continue",
        "save-and-render",
        "inherit",
        "inherit",
        "none",
        "suggested",
        "default",
      ],
      checkboxQueue: [["top-left"]],
      inputQueue: ["Exact Project header", ""],
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [true, true, false, true, false, false, true],
    });

    expect(result.markdownPdfCodexPrepareCalls).toEqual([
      expect.objectContaining({
        artifact: "project-bundle",
        candidateId: "codex-project-bundle-1",
        pageInformation: {
          pageNumbers: expect.objectContaining({ enabled: true, position: "bottom-center" }),
          repeatingContent: {
            enabled: true,
            selected: ["top-left"],
            text: { "top-left": "Exact Project header" },
          },
        },
      }),
    ]);
    expect(result.markdownPdfCodexBindCalls).toHaveLength(1);
    expect(result.markdownPdfCodexWriteCalls).toEqual([
      expect.objectContaining({ candidateId: "codex-project-bundle-1", savedProfile }),
    ]);
    expect(result.markdownPdfPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfPrepareCalls[0]).not.toHaveProperty("pageNumbers");
    expect(result.markdownPdfExecuteCalls).toHaveLength(1);
    expect(
      result.promptCalls.filter(
        (call) => call.message === "Send these prepared signals to Codex Assistant?",
      ),
    ).toHaveLength(1);
  });

  test("reuses the candidate after reviewing unchanged page information", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...entry("profile"),
        ...numberedPageInformation(),
        "continue",
        "change-setup",
        "page-information",
        "continue",
        "continue",
        "cancel",
      ],
      inputQueue: [""],
      confirmQueue: [true, false],
    });

    expect(result.markdownPdfCodexPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfCodexBindCalls).toEqual([]);
  });

  test.each(["numbers", "repeating"] as const)(
    "removing the explicit %s group invalidates the accepted candidate",
    (group) => {
      const repeating = group === "repeating";
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [
          ...entry("profile"),
          ...(repeating ? ["edit", "repeating", "continue"] : numberedPageInformation()),
          "continue",
          "change-setup",
          "page-information",
          repeating ? "remove-repeating" : "remove-numbers",
          "continue",
          "continue",
          "cancel",
        ],
        inputQueue: repeating ? ["Running title", ""] : [""],
        checkboxQueue: repeating ? [["top-left"]] : [],
        confirmQueue: repeating ? [true, false, true] : [true, false, true],
      });

      expect(result.markdownPdfCodexPrepareCalls.map((call) => call.candidateId)).toEqual([
        "codex-profile-1",
        "codex-profile-2",
      ]);
      expect(result.markdownPdfCodexPrepareCalls[0]?.pageInformation).toHaveProperty(
        group === "numbers" ? "pageNumbers" : "repeatingContent",
      );
      expect(result.markdownPdfCodexPrepareCalls[1]?.pageInformation).toBeUndefined();
      expect(result.markdownPdfCodexBindCalls).toEqual([]);
    },
  );

  test("changing authored header text prepares a replacement candidate with the exact revision", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...entry("project-bundle"),
        "edit",
        "repeating",
        "continue",
        "continue",
        "change-setup",
        "page-information",
        "repeating",
        "continue",
        "continue",
        "cancel",
      ],
      inputQueue: ["First title", "", "Revised title"],
      checkboxQueue: [["top-left"], ["top-left"]],
      confirmQueue: [true, false, true],
    });

    expect(result.markdownPdfCodexPrepareCalls.map((call) => call.candidateId)).toEqual([
      "codex-project-bundle-1",
      "codex-project-bundle-2",
    ]);
    expect(result.markdownPdfCodexPrepareCalls[0]?.pageInformation).toMatchObject({
      repeatingContent: { enabled: true, text: { "top-left": "First title" } },
    });
    expect(result.markdownPdfCodexPrepareCalls[1]?.pageInformation).toMatchObject({
      repeatingContent: { enabled: true, text: { "top-left": "Revised title" } },
    });
    expect(result.markdownPdfCodexBindCalls).toEqual([]);
  });

  test("changing the page-number position prepares a replacement candidate", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...entry("profile"),
        ...numberedPageInformation(),
        "continue",
        "change-setup",
        "page-information",
        "numbers",
        "body",
        "page",
        "bottom-right",
        "continue",
        "continue",
        "cancel",
      ],
      inputQueue: [""],
      confirmQueue: [true, false, true],
    });

    expect(result.markdownPdfCodexPrepareCalls.map((call) => call.candidateId)).toEqual([
      "codex-profile-1",
      "codex-profile-2",
    ]);
    expect(result.markdownPdfCodexPrepareCalls[0]?.pageInformation).toMatchObject({
      pageNumbers: { enabled: true, position: "bottom-center" },
    });
    expect(result.markdownPdfCodexPrepareCalls[1]?.pageInformation).toMatchObject({
      pageNumbers: { enabled: true, position: "bottom-right" },
    });
    expect(result.markdownPdfCodexBindCalls).toEqual([]);
  });

  test("revises a late candidate conflict against the latest text before review", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfCodexPrepareConflicts: [
        { position: "bottom-center", text: "First footer", source: "candidate" },
        { position: "bottom-center", text: "Changed footer", source: "candidate" },
      ],
      selectQueue: [...entry("profile"), ...numberedPageInformation(), "continue", "cancel"],
      inputQueue: [""],
      confirmQueue: [true, false, false, true],
    });

    expect(result.markdownPdfCodexPrepareCalls).toHaveLength(3);
    expect(result.markdownPdfCodexPrepareCalls[1]?.pageInformation).toMatchObject({
      occupiedNumberSlot: {
        position: "bottom-center",
        choice: "retain",
        conflictingText: "First footer",
        source: "model",
      },
    });
    expect(result.markdownPdfCodexPrepareCalls[2]?.pageInformation).toMatchObject({
      occupiedNumberSlot: {
        position: "bottom-center",
        choice: "clear",
        conflictingText: "Changed footer",
        source: "model",
      },
    });
    expect(result.markdownPdfCodexBindCalls).toEqual([]);
  });

  test("confirms retained model text when it disappears on the next preparation", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfCodexPrepareConflicts: [
        { position: "bottom-center", text: "Model footer", source: "candidate" },
        {
          position: "bottom-center",
          text: "Model footer",
          source: "candidate",
          candidateAbsent: true,
        },
      ],
      selectQueue: [...entry("profile"), ...numberedPageInformation(), "continue", "cancel"],
      inputQueue: [""],
      confirmQueue: [true, false, false, false],
    });

    expect(result.markdownPdfCodexPrepareCalls).toHaveLength(3);
    expect(result.markdownPdfCodexPrepareCalls[2]?.pageInformation).toMatchObject({
      occupiedNumberSlot: {
        choice: "retain",
        conflictingText: "Model footer",
        source: "model",
        candidateAbsentConfirmed: true,
      },
    });
    expect(result.markdownPdfCodexWriteCalls).toEqual([]);
  });

  test("cancels from a late explicit conflict without accepting a candidate", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfCodexPrepareConflicts: [
        { position: "bottom-center", text: "Authored text", source: "explicit" },
      ],
      selectQueue: [
        ...entry("profile"),
        ...numberedPageInformation(),
        "continue",
        "revise",
        "cancel",
      ],
      inputQueue: [""],
      confirmQueue: [true, false],
    });

    expect(result.markdownPdfCodexPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfCodexBindCalls).toEqual([]);
    expect(result.markdownPdfCodexWriteCalls).toEqual([]);
    expect(result.promptCalls).toContainEqual({
      kind: "select",
      message:
        "Repeating text is selected at bottom-center, which page numbers now use. Revise one group.",
    });
  });
});
