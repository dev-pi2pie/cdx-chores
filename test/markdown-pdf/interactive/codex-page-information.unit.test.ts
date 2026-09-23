import { describe, expect, test } from "bun:test";

import { normalizeMarkdownPdfProfile } from "../../../src/cli/markdown-pdf/profile";
import {
  collectMarkdownPdfCodexPageInformation,
  type MarkdownPdfCodexPageInformationAction,
  type MarkdownPdfCodexPageInformationPrompts,
} from "../../../src/cli/interactive/markdown/codex-page-information";

type Action = MarkdownPdfCodexPageInformationAction;

function prompts(
  actions: Action[],
  overrides: Partial<MarkdownPdfCodexPageInformationPrompts["formalGuide"]> = {},
) {
  const events: string[] = [];
  const promptSet: MarkdownPdfCodexPageInformationPrompts = {
    initial: async () => {
      events.push("initial");
      return "edit";
    },
    action: async () => {
      const action = actions.shift();
      if (!action) throw new Error("Unexpected page-information action");
      events.push(action);
      return action;
    },
    conflict: async (position) => {
      events.push(`conflict:${position}`);
    },
    formalGuide: {
      pageNumbersEnabled: () => true,
      pageNumberOutcome: () => "body",
      pageNumberLabel: () => "Page {page}",
      pageNumberPosition: () => "bottom-center",
      repeatingContentEnabled: () => true,
      repeatingContentPositions: ({ current }) => current ?? [],
      repeatingContent: ({ current }) => current ?? "New text",
      clearOccupiedPageNumberPosition: () => false,
      ...overrides,
    },
  };
  return { promptSet, events };
}

const base = normalizeMarkdownPdfProfile({
  profile: {
    header: { left: "Base left", right: "Base right" },
    footer: { center: "Base center" },
    pageNumbers: { enabled: false },
  },
}).profile;

describe("internal Markdown PDF Codex page-information collection", () => {
  test("keeps both groups unspecified when skipped", async () => {
    const { promptSet, events } = prompts([]);
    promptSet.initial = async () => {
      events.push("initial");
      return "skip";
    };
    const result = await collectMarkdownPdfCodexPageInformation({
      mode: "initial",
      prompts: promptSet,
    });
    expect(result).toEqual({ kind: "answers" });
    expect(events).toEqual(["initial"]);
  });

  test("collects ON numbers independently with body scope and fixed counters", async () => {
    const { promptSet, events } = prompts(["numbers", "continue"]);
    const result = await collectMarkdownPdfCodexPageInformation({
      mode: "initial",
      prompts: promptSet,
    });
    expect(result).toEqual({
      kind: "answers",
      answers: {
        pageNumbers: {
          enabled: true,
          scope: "body",
          countFrom: "body",
          start: 1,
          increment: 1,
          format: "Page {page}",
          position: "bottom-center",
        },
      },
    });
    expect(events).toEqual(["initial", "numbers", "continue"]);
  });

  test("retains OFF number details and OFF repeating selections for later revision", async () => {
    const { promptSet } = prompts(["numbers", "repeating", "continue"], {
      pageNumbersEnabled: () => false,
      repeatingContentEnabled: () => false,
    });
    const result = await collectMarkdownPdfCodexPageInformation({
      mode: "revision",
      base,
      prompts: promptSet,
      current: {
        repeatingContent: {
          enabled: true,
          selected: ["top-left"],
          text: { "top-left": "Exact retained text" },
        },
      },
    });
    expect(result.kind).toBe("answers");
    if (result.kind !== "answers") return;
    expect(result.answers?.pageNumbers?.enabled).toBe(false);
    expect(result.answers?.repeatingContent).toEqual({
      enabled: false,
      selected: ["top-left"],
      text: { "top-left": "Exact retained text" },
    });
    expect(result.answers?.occupiedNumberSlot).toBeUndefined();
  });

  test("preselects eligible occupied base slots only on the first repeating edit", async () => {
    const seen: Array<readonly string[] | undefined> = [];
    const { promptSet } = prompts(["repeating", "continue"], {
      repeatingContentPositions: ({ current }) => {
        seen.push(current);
        return current ?? [];
      },
    });
    const first = await collectMarkdownPdfCodexPageInformation({
      mode: "revision",
      base,
      prompts: promptSet,
    });
    expect(seen).toEqual([["top-left", "top-right", "bottom-center"]]);
    expect(first.kind).toBe("answers");
    if (first.kind !== "answers") return;
    expect(first.answers?.repeatingContent?.text).toEqual({
      "top-left": "Base left",
      "top-right": "Base right",
      "bottom-center": "Base center",
    });

    const replacement = normalizeMarkdownPdfProfile({
      profile: { header: { left: "Changed base left", center: "New base center" } },
    }).profile;
    const revised = prompts(["repeating", "continue"], {
      repeatingContentPositions: ({ current }) => {
        seen.push(current);
        return current ?? [];
      },
    });
    const second = await collectMarkdownPdfCodexPageInformation({
      mode: "revision",
      base: replacement,
      current: first.answers,
      prompts: revised.promptSet,
    });
    expect(seen.at(-1)).toEqual(["top-left", "top-right", "bottom-center"]);
    expect(second.kind).toBe("answers");
    if (second.kind !== "answers") return;
    expect(second.answers?.repeatingContent?.text["top-left"]).toBe("Base left");
    expect(second.answers?.repeatingContent?.selected).not.toContain("top-center");
  });

  test("uses the Formal Guide occupied-slot prompt and defaults to retain", async () => {
    const occupied: string[] = [];
    const { promptSet } = prompts(["numbers", "continue"], {
      clearOccupiedPageNumberPosition: ({ position, current }) => {
        occupied.push(`${position}:${current}`);
        return false;
      },
    });
    const result = await collectMarkdownPdfCodexPageInformation({
      mode: "revision",
      base,
      prompts: promptSet,
    });
    expect(occupied).toEqual(["bottom-center:Base center"]);
    expect(result).toMatchObject({
      kind: "answers",
      answers: { occupiedNumberSlot: { position: "bottom-center", choice: "retain" } },
    });
  });

  test("OFF repeating content clears the reserved-slot decision without prompting", async () => {
    const { promptSet } = prompts(["repeating", "numbers", "continue"], {
      repeatingContentEnabled: () => false,
      clearOccupiedPageNumberPosition: () => {
        throw new Error("OFF must not ask about a slot");
      },
    });
    const result = await collectMarkdownPdfCodexPageInformation({
      mode: "revision",
      base,
      prompts: promptSet,
    });
    expect(result.kind).toBe("answers");
    if (result.kind !== "answers") return;
    expect(result.answers?.repeatingContent?.enabled).toBe(false);
    expect(result.answers?.occupiedNumberSlot).toBeUndefined();
  });

  test("removes each explicit choice independently and discards obsolete conflicts", async () => {
    const { promptSet } = prompts(["remove-numbers", "continue"]);
    const result = await collectMarkdownPdfCodexPageInformation({
      mode: "revision",
      prompts: promptSet,
      current: {
        pageNumbers: {
          enabled: true,
          scope: "body",
          countFrom: "body",
          start: 1,
          increment: 1,
          format: "{page}",
          position: "bottom-center",
        },
        repeatingContent: { enabled: false, selected: [], text: {} },
        occupiedNumberSlot: {
          position: "bottom-center",
          choice: "retain",
          inheritedText: "Base center",
        },
      },
    });
    expect(result).toEqual({
      kind: "answers",
      answers: { repeatingContent: { enabled: false, selected: [], text: {} } },
    });
  });

  test("blocks a newly reserved explicit repeating position until revised", async () => {
    const { promptSet, events } = prompts(["numbers", "continue", "repeating", "continue"], {
      repeatingContentPositions: () => [],
    });
    const result = await collectMarkdownPdfCodexPageInformation({
      mode: "revision",
      prompts: promptSet,
      current: {
        repeatingContent: {
          enabled: true,
          selected: ["bottom-center"],
          text: { "bottom-center": "Literal" },
        },
      },
    });
    expect(events).toContain("conflict:bottom-center");
    expect(result.kind).toBe("answers");
    if (result.kind !== "answers") return;
    expect(result.answers?.repeatingContent?.selected).toEqual([]);
    expect(result.answers?.repeatingContent?.text["bottom-center"]).toBe("Literal");
  });

  test("removing the final explicit group leaves page information absent", async () => {
    const { promptSet } = prompts(["remove-numbers", "continue"], {
      clearOccupiedPageNumberPosition: () => {
        throw new Error("No explicit choice must not ask about inherited content");
      },
    });
    const result = await collectMarkdownPdfCodexPageInformation({
      mode: "revision",
      base,
      prompts: promptSet,
      current: {
        pageNumbers: {
          enabled: true,
          scope: "body",
          countFrom: "body",
          start: 1,
          increment: 1,
          format: "{page}",
          position: "bottom-center",
        },
      },
    });
    expect(result).toEqual({ kind: "answers" });
  });

  test("rechecks an inherited conflict when base text changes at the same position", async () => {
    const occupied: string[] = [];
    const changedBase = normalizeMarkdownPdfProfile({
      profile: { footer: { center: "Replaced center" } },
    }).profile;
    const { promptSet } = prompts(["continue"], {
      clearOccupiedPageNumberPosition: ({ current }) => {
        occupied.push(current);
        return true;
      },
    });
    const result = await collectMarkdownPdfCodexPageInformation({
      mode: "revision",
      base: changedBase,
      prompts: promptSet,
      current: {
        pageNumbers: {
          enabled: true,
          scope: "body",
          countFrom: "body",
          start: 1,
          increment: 1,
          format: "{page}",
          position: "bottom-center",
        },
        occupiedNumberSlot: {
          position: "bottom-center",
          choice: "retain",
          inheritedText: "Base center",
        },
      },
    });
    expect(occupied).toEqual(["Replaced center"]);
    expect(result).toMatchObject({
      kind: "answers",
      answers: { occupiedNumberSlot: { choice: "clear", inheritedText: "Replaced center" } },
    });
  });

  test("rechecks the occupied slot when the explicit number position changes", async () => {
    const occupied: string[] = [];
    const { promptSet } = prompts(["numbers", "continue"], {
      pageNumberPosition: () => "top-left",
      clearOccupiedPageNumberPosition: ({ position }) => {
        occupied.push(position);
        return true;
      },
    });
    const result = await collectMarkdownPdfCodexPageInformation({
      mode: "revision",
      base,
      prompts: promptSet,
      current: {
        pageNumbers: {
          enabled: true,
          scope: "body",
          countFrom: "body",
          start: 1,
          increment: 1,
          format: "{page}",
          position: "bottom-center",
        },
        occupiedNumberSlot: {
          position: "bottom-center",
          choice: "retain",
          inheritedText: "Base center",
        },
      },
    });
    expect(occupied).toEqual(["top-left"]);
    expect(result).toMatchObject({
      kind: "answers",
      answers: { occupiedNumberSlot: { position: "top-left", choice: "clear" } },
    });
  });

  test("asks about a base-reserved slot when repeating content is explicitly ON", async () => {
    const numberedBase = normalizeMarkdownPdfProfile({
      profile: {
        pageNumbers: { enabled: true, position: "bottom-center" },
        footer: { center: "Inherited footer" },
      },
    }).profile;
    const occupied: string[] = [];
    const { promptSet } = prompts(["repeating", "continue"], {
      repeatingContentPositions: ({ current }) => current ?? [],
      clearOccupiedPageNumberPosition: ({ position }) => {
        occupied.push(position);
        return false;
      },
    });
    const result = await collectMarkdownPdfCodexPageInformation({
      mode: "revision",
      base: numberedBase,
      prompts: promptSet,
    });
    expect(occupied).toEqual(["bottom-center"]);
    expect(result).toMatchObject({
      kind: "answers",
      answers: { occupiedNumberSlot: { choice: "retain" } },
    });
  });

  test("an explicit OFF choice remains OFF after a later base is selected", async () => {
    const current = {
      repeatingContent: {
        enabled: false,
        selected: ["top-left" as const],
        text: { "top-left": "Earlier" },
      },
    };
    const { promptSet } = prompts(["continue"], {
      clearOccupiedPageNumberPosition: () => {
        throw new Error("OFF must not prompt for a reserved slot");
      },
    });
    const result = await collectMarkdownPdfCodexPageInformation({
      mode: "revision",
      base,
      current,
      prompts: promptSet,
    });
    expect(result).toEqual({ kind: "answers", answers: current });
  });

  test.each(["back", "cancel"] as const)("%s returns without a candidate", async (action) => {
    const current = {
      repeatingContent: {
        enabled: true,
        selected: ["top-left" as const],
        text: { "top-left": "Exact" },
      },
    };
    const { promptSet } = prompts(["repeating", action], {
      repeatingContentPositions: () => ["top-right"],
      repeatingContent: () => "Changed",
    });
    const result = await collectMarkdownPdfCodexPageInformation({
      mode: "revision",
      current,
      prompts: promptSet,
    });
    expect(result).toEqual({ kind: action });
    expect(current.repeatingContent.selected).toEqual(["top-left"]);
    expect(current.repeatingContent.text).toEqual({ "top-left": "Exact" });
  });
});
