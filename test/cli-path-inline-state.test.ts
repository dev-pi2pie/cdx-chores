import { describe, expect, test } from "bun:test";

import {
  acceptSiblingPreview,
  clearInteractionState,
  deriveGhostSuffixFromPreview,
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
});
