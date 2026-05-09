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
});
