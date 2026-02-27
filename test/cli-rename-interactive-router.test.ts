import { describe, expect, test } from "bun:test";

import {
  resolveAutoCodexFlagsForBatchProfile,
  resolveAutoCodexFlagsForFilePath,
  resolveAutoCodexFlagsForPaths,
  resolveCodexFlagsFromCliOptions,
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

  test("resolves auto flags from a mixed path list", () => {
    expect(resolveAutoCodexFlagsForPaths(["/tmp/a.png", "/tmp/b.md"])).toEqual({
      codexImages: true,
      codexDocs: true,
    });
    expect(resolveAutoCodexFlagsForPaths(["/tmp/a.mp4"])).toEqual({
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

  test("applies CLI codex auto and explicit precedence rules", () => {
    const fallback = { codexImages: true, codexDocs: true };

    expect(
      resolveCodexFlagsFromCliOptions({
        cli: { codex: true },
        fallbackAuto: fallback,
      }),
    ).toEqual(fallback);

    expect(
      resolveCodexFlagsFromCliOptions({
        cli: { codex: true, codexImages: true },
        fallbackAuto: fallback,
      }),
    ).toEqual({
      codexImages: true,
      codexDocs: false,
    });

    expect(
      resolveCodexFlagsFromCliOptions({
        cli: { codex: true, codexDocs: true },
        fallbackAuto: fallback,
      }),
    ).toEqual({
      codexImages: false,
      codexDocs: true,
    });

    expect(
      resolveCodexFlagsFromCliOptions({
        cli: { codexImages: true, codexDocs: true },
        fallbackAuto: fallback,
      }),
    ).toEqual({
      codexImages: true,
      codexDocs: true,
    });

    expect(
      resolveCodexFlagsFromCliOptions({
        cli: {},
        fallbackAuto: fallback,
      }),
    ).toEqual({
      codexImages: false,
      codexDocs: false,
    });
  });
});
