import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "./helpers/interactive-harness";

describe("interactive rename routing", () => {
  test("uses the shortened custom template hint text", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:file", "custom", "path_asc"],
      requiredPathQueue: ["README.md"],
      inputQueue: ["{date}-{stem}-{serial}", "1", ""],
      confirmQueue: [true, false],
    });

    expect(result.promptCalls).toContainEqual({
      kind: "input",
      message: "Template",
    });
  });

  test("forwards the session Codex timeout without enabling rename analyzers", () => {
    const result = runInteractiveHarness({
      mode: "run",
      codexTimeoutMs: 30_000,
      selectQueue: ["rename", "rename:file", "default", "utc"],
      requiredPathQueue: ["README.md"],
      inputQueue: [""],
      confirmQueue: [true, false],
    });

    expect(result.actionCalls).toContainEqual({
      name: "rename:file",
      options: expect.objectContaining({
        codexDocs: false,
        codexImages: false,
        codexTimeoutMs: 30_000,
      }),
    });
  });

  test("forwards a configured session timeout to batch rename analyzers", () => {
    const result = runInteractiveHarness({
      mode: "run",
      codexTimeoutMs: 120_000,
      selectQueue: ["rename", "rename:batch", "docs", "default", "utc", "summary", "docs"],
      requiredPathQueue: ["docs"],
      inputQueue: [""],
      confirmQueue: [false, true, true],
    });

    expect(result.actionCalls).toContainEqual({
      name: "rename:batch",
      options: expect.objectContaining({
        codexDocs: true,
        codexImages: false,
        codexTimeoutMs: 120_000,
      }),
    });
  });
});
