import { describe, expect, test } from "bun:test";

import {
  acceptSiblingPreview,
  advanceSiblingPreview,
  clearInteractionState,
  deriveGhostSuffixFromPreview,
  derivePreferredGhostSuffix,
  enterSiblingPreviewState,
  getActiveSiblingPreviewReplacement,
  setCycleState,
  type InlinePromptInteractionState,
} from "../src/cli/prompts/path-inline-state";

describe("inline path prompt interaction state", () => {
  test("entering sibling preview mode abandons any active Tab cycle", () => {
    const cycleState: InlinePromptInteractionState = {
      cycleState: {
        replacements: ["docs/", "downloads/"],
        index: 1,
      },
    };

    const nextState = enterSiblingPreviewState(cycleState, {
      scopeKey: "./",
      replacements: ["docs/", "downloads/"],
      activeIndex: 0,
    });

    expect(nextState.cycleState).toBeUndefined();
    expect(nextState.siblingPreviewState).toEqual({
      scopeKey: "./",
      replacements: ["docs/", "downloads/"],
      activeIndex: 0,
    });
    expect(getActiveSiblingPreviewReplacement(nextState)).toBe("docs/");
  });

  test("starting a new Tab cycle clears any active sibling preview", () => {
    const previewState = enterSiblingPreviewState(clearInteractionState(), {
      scopeKey: "./docs/",
      replacements: ["./docs/guides/", "./docs/researches/"],
      activeIndex: 1,
    });

    const nextState = setCycleState(previewState, {
      replacements: ["./docs/guides/", "./docs/researches/"],
      index: 0,
    });

    expect(nextState.siblingPreviewState).toBeUndefined();
    expect(nextState.cycleState).toEqual({
      replacements: ["./docs/guides/", "./docs/researches/"],
      index: 0,
    });
  });

  test("accepting a sibling preview commits the previewed value and clears transient state", () => {
    const previewState = enterSiblingPreviewState(clearInteractionState(), {
      scopeKey: "./docs/",
      replacements: ["./docs/guides/", "./docs/researches/"],
      activeIndex: 1,
    });

    const result = acceptSiblingPreview("./docs/", previewState);

    expect(result).toEqual({
      accepted: true,
      nextState: {},
      nextValue: "./docs/researches/",
    });
  });

  test("accepting a sibling preview without an active preview is a no-op", () => {
    const cycleState = setCycleState(clearInteractionState(), {
      replacements: ["./docs/guides/"],
      index: 0,
    });

    const result = acceptSiblingPreview("./docs/", cycleState);

    expect(result).toEqual({
      accepted: false,
      nextState: cycleState,
      nextValue: "./docs/",
    });
  });

  test("deriveGhostSuffixFromPreview returns only the uncommitted suffix", () => {
    expect(deriveGhostSuffixFromPreview("./docs/", "./docs/researches/")).toBe("researches/");
    expect(deriveGhostSuffixFromPreview("./docs/", "./other/")).toBe("");
    expect(deriveGhostSuffixFromPreview("./docs/", "./docs/")).toBe("");
    expect(deriveGhostSuffixFromPreview("./docs/", undefined)).toBe("");
  });

  test("derivePreferredGhostSuffix keeps an active sibling preview ahead of fallback suggestions", () => {
    const previewState = enterSiblingPreviewState(clearInteractionState(), {
      scopeKey: "./docs/",
      replacements: ["./docs/researches/"],
      activeIndex: 0,
    });

    expect(
      derivePreferredGhostSuffix({
        value: "./docs/",
        state: previewState,
        fallbackReplacement: "./docs/guides/",
      }),
    ).toBe("researches/");
  });

  test("derivePreferredGhostSuffix falls back to the best suggestion when no preview is active", () => {
    expect(
      derivePreferredGhostSuffix({
        value: "./docs/",
        state: clearInteractionState(),
        fallbackReplacement: "./docs/guides/",
      }),
    ).toBe("guides/");
  });

  test("advanceSiblingPreview wraps through the cached sibling set", () => {
    const initialState = clearInteractionState();
    const candidates = {
      scopeKey: "./docs/",
      replacements: ["./docs/guides/", "./docs/researches/"],
    };

    const first = advanceSiblingPreview(initialState, candidates, "next");
    const second = advanceSiblingPreview(first.nextState, candidates, "next");
    const wrapped = advanceSiblingPreview(second.nextState, candidates, "next");
    const previous = advanceSiblingPreview(first.nextState, candidates, "previous");

    expect(first.previewReplacement).toBe("./docs/guides/");
    expect(second.previewReplacement).toBe("./docs/researches/");
    expect(wrapped.previewReplacement).toBe("./docs/guides/");
    expect(previous.previewReplacement).toBe("./docs/researches/");
  });

  test("advanceSiblingPreview beeps at zero candidates but wraps to self for one candidate", () => {
    const empty = advanceSiblingPreview(
      setCycleState(clearInteractionState(), {
        replacements: ["./docs/guides/"],
        index: 0,
      }),
      {
        scopeKey: "./docs/",
        replacements: [],
      },
      "next",
    );
    const single = advanceSiblingPreview(
      clearInteractionState(),
      {
        scopeKey: "./docs/",
        replacements: ["./docs/guides/"],
      },
      "previous",
    );

    expect(empty.changed).toBe(false);
    expect(empty.nextState).toEqual({});
    expect(single.changed).toBe(true);
    expect(single.previewReplacement).toBe("./docs/guides/");
  });
});
