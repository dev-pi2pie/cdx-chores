import { describe, expect, test } from "bun:test";

import { sameCodexSetup } from "../../../../src/cli/interactive/markdown/codex-authoring";
import type { MarkdownPdfCodexSetup } from "../../../../src/cli/interactive/markdown/codex-types";

const setup: MarkdownPdfCodexSetup = {
  artifact: "profile",
  fontHints: [],
  pageInformation: {
    pageNumbers: {
      enabled: true,
      scope: "body",
      countFrom: "body",
      start: 1,
      increment: 1,
      position: "bottom-center",
      format: "Page {page}",
    },
    repeatingContent: {
      enabled: true,
      selected: ["top-left"],
      text: { "top-left": "Running title" },
    },
    occupiedNumberSlot: {
      choice: "retain",
      position: "bottom-center",
      conflictingText: "Existing footer",
    },
  },
};

describe("Interactive Codex candidate setup equality", () => {
  test("reuses unchanged page answers even after collection copies the nested values", () => {
    const copied = structuredClone(setup);
    expect(sameCodexSetup(setup, copied)).toBe(true);
  });

  test("invalidates a candidate when page text, group presence, or conflict choice changes", () => {
    const edited = structuredClone(setup);
    edited.pageInformation!.repeatingContent!.text["top-left"] = "Changed title";
    expect(sameCodexSetup(setup, edited)).toBe(false);

    const removed = structuredClone(setup);
    delete removed.pageInformation!.repeatingContent;
    expect(sameCodexSetup(setup, removed)).toBe(false);

    const choiceChanged = structuredClone(setup);
    choiceChanged.pageInformation!.occupiedNumberSlot!.choice = "clear";
    expect(sameCodexSetup(setup, choiceChanged)).toBe(false);
  });
});
