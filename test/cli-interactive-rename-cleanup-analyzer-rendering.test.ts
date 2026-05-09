import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "./helpers/interactive-harness";

describe("interactive rename routing", () => {
  test("shows grouped-pattern overflow indicator when analyzer groups exceed preview cap", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:cleanup", "number", "detailed"],
      checkboxQueue: [["timestamp", "date", "serial", "uid"]],
      requiredPathQueue: ["docs"],
      inputQueue: [""],
      confirmQueue: [true, false, true, false, true, true, true, true],
      cleanupAnalyzerEvidence: {
        targetKind: "directory",
        targetPath: "docs",
        totalCandidateCount: 26,
        sampledCount: 26,
        sampleNames: Array.from({ length: 26 }, (_, index) => `sample-${index + 1}.txt`),
        groupedPatterns: Array.from({ length: 13 }, (_, index) => ({
          pattern: `group-${index + 1}-{serial}.txt`,
          count: 2,
          examples: [`sample-${index + 1}.txt`, `sample-${index + 14}.txt`],
        })),
      },
      cleanupAnalyzerSuggestion: {
        recommendedHints: ["serial"],
        recommendedStyle: "slug",
        confidence: 0.82,
        reasoningSummary: "Grouped patterns are dominated by serial counters.",
      },
    });

    expect(result.stdout).toContain("- ... 1 additional grouped pattern(s) not shown");
  });

  test("shows example truncation indicator when grouped examples exceed line cap", () => {
    const longExampleA = `very-long-prefix-${"a".repeat(120)}.txt`;
    const longExampleB = `very-long-prefix-${"b".repeat(120)}.txt`;
    const longExampleC = `very-long-prefix-${"c".repeat(120)}.txt`;
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:cleanup", "number", "detailed"],
      checkboxQueue: [["timestamp", "date", "serial", "uid"]],
      requiredPathQueue: ["docs"],
      inputQueue: [""],
      confirmQueue: [true, false, true, false, true, true, true, true],
      cleanupAnalyzerEvidence: {
        targetKind: "directory",
        targetPath: "docs",
        totalCandidateCount: 3,
        sampledCount: 3,
        sampleNames: [longExampleA, longExampleB, longExampleC],
        groupedPatterns: [
          {
            pattern: "very-long-prefix-{serial}.txt",
            count: 3,
            examples: [longExampleA, longExampleB, longExampleC],
          },
        ],
      },
      cleanupAnalyzerSuggestion: {
        recommendedHints: ["serial"],
        recommendedStyle: "slug",
        confidence: 0.82,
        reasoningSummary: "Grouped patterns are dominated by serial counters.",
      },
    });

    expect(result.stdout).toContain("- ... examples truncated for 1 grouped pattern(s)");
  });
});
