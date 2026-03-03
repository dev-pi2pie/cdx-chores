import { describe, expect, test } from "bun:test";

import {
  suggestRenameCleanupWithCodex,
  type RenameCleanupAnalyzerEvidence,
} from "../src/cli/actions";

const SAMPLE_EVIDENCE: RenameCleanupAnalyzerEvidence = {
  targetKind: "directory",
  targetPath: "/tmp/cleanup-dir",
  totalCandidateCount: 12,
  sampledCount: 4,
  sampleNames: [
    "app-00001.log",
    "app-00002.log",
    "app-00003.log",
    "nested/app-00004.log",
  ],
  groupedPatterns: [
    {
      pattern: "app-{serial}.log",
      count: 4,
      examples: ["app-00001.log", "app-00002.log", "nested/app-00004.log"],
    },
  ],
};

describe("cli action modules: rename cleanup codex suggestions", () => {
  test("normalizes a structured Codex cleanup suggestion", async () => {
    const result = await suggestRenameCleanupWithCodex({
      evidence: SAMPLE_EVIDENCE,
      workingDirectory: process.cwd(),
      runner: async () =>
        JSON.stringify({
          recommended_hints: ["serial", "serial"],
          recommended_style: "slug",
          recommended_timestamp_action: "none",
          confidence: 1.2,
          reasoning_summary: "Most sampled names differ only by trailing counters.",
        }),
    });

    expect(result).toEqual({
      suggestion: {
        recommendedHints: ["serial"],
        recommendedStyle: "slug",
        recommendedTimestampAction: undefined,
        confidence: 1,
        reasoningSummary: "Most sampled names differ only by trailing counters.",
      },
    });
  });

  test("requires timestamp action when timestamp hint is suggested", async () => {
    const result = await suggestRenameCleanupWithCodex({
      evidence: SAMPLE_EVIDENCE,
      workingDirectory: process.cwd(),
      runner: async () =>
        JSON.stringify({
          recommended_hints: ["timestamp"],
          recommended_style: "preserve",
          recommended_timestamp_action: "none",
          confidence: 0.85,
          reasoning_summary: "The sampled names consistently include screenshot timestamps.",
        }),
    });

    expect(result.suggestion).toBeUndefined();
    expect(result.errorMessage).toContain("timestamp action");
  });

  test("surfaces runner failures without throwing", async () => {
    const result = await suggestRenameCleanupWithCodex({
      evidence: SAMPLE_EVIDENCE,
      workingDirectory: process.cwd(),
      runner: async () => {
        throw new Error("mocked codex failure");
      },
    });

    expect(result).toEqual({
      errorMessage: "mocked codex failure",
    });
  });
});
