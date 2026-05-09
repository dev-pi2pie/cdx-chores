import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "./helpers/interactive-harness";

describe("interactive rename routing", () => {
  test("forwards timestamp action from analyzer-assisted cleanup settings", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:cleanup", "skip", "detailed"],
      checkboxQueue: [["timestamp", "date", "serial", "uid"]],
      requiredPathQueue: ["docs"],
      inputQueue: [""],
      confirmQueue: [true, false, true, false, true, true, false, true],
      cleanupAnalyzerSuggestion: {
        recommendedHints: ["timestamp"],
        recommendedStyle: "preserve",
        recommendedTimestampAction: "remove",
        confidence: 0.91,
        reasoningSummary: "Sampled names differ by timestamp fragments.",
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "rename:cleanup",
        options: {
          path: "docs",
          hints: ["timestamp"],
          style: "preserve",
          timestampAction: "remove",
          conflictStrategy: "skip",
          recursive: true,
          dryRun: true,
          previewSkips: "detailed",
        },
      },
    ]);
    expect(result.stdout).toContain("- timestamp action: remove");
    expect(result.promptCalls).not.toContainEqual({
      kind: "select",
      message: "Timestamp fragment handling",
    });
  });
});
