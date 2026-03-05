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

  test("bounds prompt payload when evidence contains oversized samples and grouped examples", async () => {
    let capturedPrompt = "";
    const longTail = "x".repeat(300);
    const evidence: RenameCleanupAnalyzerEvidence = {
      targetKind: "directory",
      targetPath: "/tmp/cleanup-dir",
      totalCandidateCount: 120,
      sampledCount: 45,
      sampleNames: Array.from({ length: 45 }, (_, index) => `sample-${index + 1}-${longTail}.log`),
      groupedPatterns: Array.from({ length: 18 }, (_, index) => ({
        pattern: `group-${index + 1}-{serial}.log`,
        count: 5,
        examples: [
          `group-${index + 1}-example-a-${longTail}.log`,
          `group-${index + 1}-example-b-${longTail}.log`,
          `group-${index + 1}-example-c-${longTail}.log`,
        ],
      })),
    };
    const result = await suggestRenameCleanupWithCodex({
      evidence,
      workingDirectory: process.cwd(),
      runner: async (options) => {
        capturedPrompt = options.prompt;
        return JSON.stringify({
          recommended_hints: ["serial"],
          recommended_style: "slug",
          recommended_timestamp_action: "none",
          confidence: 0.84,
          reasoning_summary: "Trailing counters dominate grouped filenames.",
        });
      },
    });

    expect(result.suggestion).toBeDefined();
    expect(capturedPrompt).toContain("Sample filenames (showing 40 of 45):");
    expect(capturedPrompt).toContain("additional sample name(s) omitted for prompt safety");
    expect(capturedPrompt).toContain("grouped pattern(s) omitted for prompt safety");
    expect(capturedPrompt.length).toBeLessThan(12_000);
  });

  test("keeps mixed-family grouped context in Codex prompt", async () => {
    let capturedPrompt = "";
    const mixedEvidence: RenameCleanupAnalyzerEvidence = {
      targetKind: "directory",
      targetPath: "/tmp/cleanup-dir",
      totalCandidateCount: 8,
      sampledCount: 8,
      sampleNames: [
        "Screenshot 2026-03-02 at 4.53.04 PM.png",
        "Meeting Notes 2026-03-02.txt",
        "draft (3).txt",
        "report uid-7k3m9q2x4t final.txt",
      ],
      groupedPatterns: [
        {
          pattern: "screenshot-{timestamp}.png",
          count: 2,
          examples: [
            "Screenshot 2026-03-02 at 4.53.04 PM.png",
            "Screenshot 2026-03-02 at 4.53.05 PM.png",
          ],
        },
        {
          pattern: "meeting-notes-{date}.txt",
          count: 2,
          examples: ["Meeting Notes 2026-03-02.txt", "Meeting Notes 2026-03-03.txt"],
        },
        {
          pattern: "draft-{serial}.txt",
          count: 2,
          examples: ["draft (3).txt", "draft (4).txt"],
        },
        {
          pattern: "report-{uid}-final.txt",
          count: 2,
          examples: ["report uid-7k3m9q2x4t final.txt", "report uid-9m4k2q7x1v final.txt"],
        },
      ],
    };
    const result = await suggestRenameCleanupWithCodex({
      evidence: mixedEvidence,
      workingDirectory: process.cwd(),
      runner: async (options) => {
        capturedPrompt = options.prompt;
        return JSON.stringify({
          recommended_hints: ["timestamp", "date", "serial", "uid"],
          recommended_style: "preserve",
          recommended_timestamp_action: "keep",
          confidence: 0.88,
          reasoning_summary: "Mixed families are represented in grouped evidence.",
        });
      },
    });

    expect(result.suggestion?.recommendedHints).toEqual(["timestamp", "date", "serial", "uid"]);
    expect(capturedPrompt).toContain("pattern=screenshot-{timestamp}.png");
    expect(capturedPrompt).toContain("pattern=meeting-notes-{date}.txt");
    expect(capturedPrompt).toContain("pattern=draft-{serial}.txt");
    expect(capturedPrompt).toContain("pattern=report-{uid}-final.txt");
  });
});
