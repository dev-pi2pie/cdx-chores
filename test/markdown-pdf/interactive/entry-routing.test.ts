import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "../../cli-foundations/interactive-harness";

describe("interactive Markdown PDF entry routing", () => {
  test("returns from markdown pdf source selection to the markdown submenu", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: ["md", "md:to-pdf", "back", "cancel"],
      requiredPathQueue: ["fixtures/doc.md"],
    });

    expect(result.markdownPdfPrepareCalls).toEqual([]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose a markdown command",
      "select:Choose a recipe for this PDF",
      "select:Choose a markdown command",
    ]);
  });
});
