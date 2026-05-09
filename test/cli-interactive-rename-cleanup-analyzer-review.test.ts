import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "./helpers/interactive-harness";

describe("interactive rename routing", () => {
  test("narrows analyzer evidence by selected families before requesting Codex suggestion", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:cleanup", "number", "detailed"],
      checkboxQueue: [["uid"]],
      requiredPathQueue: ["docs"],
      inputQueue: [""],
      confirmQueue: [true, false, true, false, true, true, true, true],
      captureCleanupSuggestInput: true,
      cleanupAnalyzerEvidence: {
        targetKind: "directory",
        targetPath: "docs",
        totalCandidateCount: 4,
        sampledCount: 4,
        sampleNames: [
          "report uid-7k3m9q2x4t final.txt",
          "report 2026-03-02 final.txt",
          "nested/report uid-9m4k2q7x1v final.txt",
          "nested/report 2026-03-03 final.txt",
        ],
        groupedPatterns: [
          {
            pattern: "report-{uid}-final.txt",
            count: 2,
            examples: ["report uid-7k3m9q2x4t final.txt", "nested/report uid-9m4k2q7x1v final.txt"],
          },
          {
            pattern: "report-{date}-final.txt",
            count: 2,
            examples: ["report 2026-03-02 final.txt", "nested/report 2026-03-03 final.txt"],
          },
        ],
      },
      cleanupAnalyzerSuggestion: {
        recommendedHints: ["uid"],
        recommendedStyle: "preserve",
        confidence: 0.9,
        reasoningSummary: "Selected groups are dominated by uid fragments.",
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "rename:cleanup:codex-suggest",
        options: {
          targetKind: "directory",
          totalCandidateCount: 4,
          sampledCount: 2,
          sampleNames: [
            "report uid-7k3m9q2x4t final.txt",
            "nested/report uid-9m4k2q7x1v final.txt",
          ],
          groupedPatterns: [
            {
              pattern: "report-{uid}-final.txt",
              count: 2,
              examples: [
                "report uid-7k3m9q2x4t final.txt",
                "nested/report uid-9m4k2q7x1v final.txt",
              ],
            },
          ],
        },
      },
      {
        name: "rename:cleanup",
        options: {
          path: "docs",
          hints: ["uid"],
          style: "preserve",
          conflictStrategy: "number",
          recursive: true,
          dryRun: true,
          previewSkips: "detailed",
        },
      },
      {
        name: "rename:apply",
        options: {
          csv: "plans/cleanup.csv",
          autoClean: false,
        },
      },
    ]);
  });

  test("collects analyzer evidence with uncapped group count for family narrowing", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:cleanup", "number", "detailed"],
      checkboxQueue: [["uid"]],
      requiredPathQueue: ["docs"],
      inputQueue: [""],
      confirmQueue: [true, false, true, false, true, true, true, true],
      captureCleanupCollectInput: true,
      cleanupAnalyzerEvidence: {
        targetKind: "directory",
        targetPath: "docs",
        totalCandidateCount: 2,
        sampledCount: 2,
        sampleNames: ["report uid-7k3m9q2x4t final.txt", "nested/report uid-9m4k2q7x1v final.txt"],
        groupedPatterns: [
          {
            pattern: "report-{uid}-final.txt",
            count: 2,
            examples: ["report uid-7k3m9q2x4t final.txt", "nested/report uid-9m4k2q7x1v final.txt"],
          },
        ],
      },
      cleanupAnalyzerSuggestion: {
        recommendedHints: ["uid"],
        recommendedStyle: "preserve",
        confidence: 0.9,
        reasoningSummary: "Selected groups are dominated by uid fragments.",
      },
    });

    expect(result.actionCalls).toContainEqual({
      name: "rename:cleanup:collect-evidence",
      options: {
        path: "docs",
        recursive: true,
        maxDepth: undefined,
        matchRegex: undefined,
        skipRegex: undefined,
        ext: undefined,
        skipExt: undefined,
        sampleLimit: 40,
        groupLimit: 40,
        examplesPerGroup: undefined,
      },
    });
  });

  test("treats empty analyzer-family selection as full-scope analyzer review", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:cleanup", "number", "detailed"],
      checkboxQueue: [[]],
      requiredPathQueue: ["docs"],
      inputQueue: [""],
      confirmQueue: [true, false, true, false, true, true, true, true],
      captureCleanupSuggestInput: true,
      cleanupAnalyzerEvidence: {
        targetKind: "directory",
        targetPath: "docs",
        totalCandidateCount: 4,
        sampledCount: 4,
        sampleNames: [
          "report uid-7k3m9q2x4t final.txt",
          "report 2026-03-02 final.txt",
          "nested/report uid-9m4k2q7x1v final.txt",
          "nested/report 2026-03-03 final.txt",
        ],
        groupedPatterns: [
          {
            pattern: "report-{uid}-final.txt",
            count: 2,
            examples: ["report uid-7k3m9q2x4t final.txt", "nested/report uid-9m4k2q7x1v final.txt"],
          },
          {
            pattern: "report-{date}-final.txt",
            count: 2,
            examples: ["report 2026-03-02 final.txt", "nested/report 2026-03-03 final.txt"],
          },
        ],
      },
      cleanupAnalyzerSuggestion: {
        recommendedHints: ["uid"],
        recommendedStyle: "preserve",
        confidence: 0.9,
        reasoningSummary: "Selected groups are dominated by uid fragments.",
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "rename:cleanup:codex-suggest",
        options: {
          targetKind: "directory",
          totalCandidateCount: 4,
          sampledCount: 4,
          sampleNames: [
            "report uid-7k3m9q2x4t final.txt",
            "report 2026-03-02 final.txt",
            "nested/report uid-9m4k2q7x1v final.txt",
            "nested/report 2026-03-03 final.txt",
          ],
          groupedPatterns: [
            {
              pattern: "report-{uid}-final.txt",
              count: 2,
              examples: [
                "report uid-7k3m9q2x4t final.txt",
                "nested/report uid-9m4k2q7x1v final.txt",
              ],
            },
            {
              pattern: "report-{date}-final.txt",
              count: 2,
              examples: ["report 2026-03-02 final.txt", "nested/report 2026-03-03 final.txt"],
            },
          ],
        },
      },
      {
        name: "rename:cleanup",
        options: {
          path: "docs",
          hints: ["uid"],
          style: "preserve",
          conflictStrategy: "number",
          recursive: true,
          dryRun: true,
          previewSkips: "detailed",
        },
      },
      {
        name: "rename:apply",
        options: {
          csv: "plans/cleanup.csv",
          autoClean: false,
        },
      },
    ]);
    expect(result.stdout).toContain("Analyzer families selected: timestamp, date, serial, uid");
  });
});
