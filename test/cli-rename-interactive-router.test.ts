import { describe, expect, test } from "bun:test";

import {
  resolveAutoCodexFlagsForBatchProfile,
  resolveAutoCodexFlagsForFilePath,
  resolveCodexFlagsFromScope,
} from "../src/cli/rename-interactive-router";

describe("rename interactive smart router", () => {
  test("resolves auto flags from batch profile", () => {
    expect(resolveAutoCodexFlagsForBatchProfile("images")).toEqual({
      codexImages: true,
      codexDocs: false,
    });
    expect(resolveAutoCodexFlagsForBatchProfile("media")).toEqual({
      codexImages: true,
      codexDocs: false,
    });
    expect(resolveAutoCodexFlagsForBatchProfile("docs")).toEqual({
      codexImages: false,
      codexDocs: true,
    });
    expect(resolveAutoCodexFlagsForBatchProfile("all")).toEqual({
      codexImages: true,
      codexDocs: true,
    });
  });

  test("resolves auto flags from file extension", () => {
    expect(resolveAutoCodexFlagsForFilePath("/tmp/a.PNG")).toEqual({
      codexImages: true,
      codexDocs: false,
    });
    expect(resolveAutoCodexFlagsForFilePath("/tmp/a.pdf")).toEqual({
      codexImages: false,
      codexDocs: true,
    });
    expect(resolveAutoCodexFlagsForFilePath("/tmp/a.mp4")).toEqual({
      codexImages: false,
      codexDocs: false,
    });
  });

  test("applies scope override rules", () => {
    const fallback = { codexImages: true, codexDocs: true };

    expect(
      resolveCodexFlagsFromScope({
        scope: "auto",
        fallbackAuto: fallback,
      }),
    ).toEqual(fallback);

    expect(
      resolveCodexFlagsFromScope({
        scope: "images",
        fallbackAuto: fallback,
      }),
    ).toEqual({
      codexImages: true,
      codexDocs: false,
    });

    expect(
      resolveCodexFlagsFromScope({
        scope: "docs",
        fallbackAuto: fallback,
      }),
    ).toEqual({
      codexImages: false,
      codexDocs: true,
    });
  });
});
