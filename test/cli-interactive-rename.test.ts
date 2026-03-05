import { describe, expect, test } from "bun:test";

import { REPO_ROOT } from "./helpers/cli-test-utils";
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
      message: [
        "Custom filename template",
        "Main placeholders: {prefix}, {timestamp}, {date}, {stem}, {uid}, {serial}",
        "Advanced: explicit timestamp variants and {serial...} params are also supported.",
      ].join("\n"),
    });
  });

  test("routes a cleanup file flow", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:cleanup", "date", "done", "preserve", "skip"],
      requiredPathQueue: ["README.md"],
      confirmQueue: [false, true],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "rename:cleanup",
        options: {
          path: "README.md",
          hints: ["date"],
          style: "preserve",
          conflictStrategy: "skip",
          dryRun: true,
        },
      },
    ]);
  });

  test("routes a cleanup directory dry-run flow and offers immediate apply", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "rename",
        "rename:cleanup",
        "timestamp",
        "done",
        "slug",
        "remove",
        "number",
        "detailed",
      ],
      requiredPathQueue: ["docs"],
      inputQueue: [""],
      confirmQueue: [true, false, false, true, true, true, true],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "rename:cleanup",
        options: {
          path: "docs",
          hints: ["timestamp"],
          style: "slug",
          timestampAction: "remove",
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
    expect(result.promptCalls).toContainEqual({
      kind: "select",
      message: "Cleanup conflict strategy",
    });
    expect(result.promptCalls).toContainEqual({
      kind: "confirm",
      message: "Filter files before cleanup?",
    });
  });

  test("re-prompts cleanup max depth until a non-negative integer is provided", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:cleanup", "date", "done", "preserve", "skip", "summary"],
      requiredPathQueue: ["docs"],
      inputQueue: ["1.5", "1"],
      confirmQueue: [true, false, false, true, false, true],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "rename:cleanup",
        options: {
          path: "docs",
          hints: ["date"],
          style: "preserve",
          conflictStrategy: "skip",
          recursive: true,
          maxDepth: 1,
          dryRun: true,
          previewSkips: "summary",
        },
      },
    ]);
  });

  test("routes an analyzer-assisted cleanup flow without manual hint prompts", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:cleanup", "number", "detailed"],
      checkboxQueue: [["timestamp", "date", "serial", "uid"]],
      requiredPathQueue: ["docs"],
      inputQueue: [""],
      confirmQueue: [true, false, true, false, true, true, true, true],
      cleanupAnalyzerSuggestion: {
        recommendedHints: ["serial"],
        recommendedStyle: "slug",
        confidence: 0.86,
        reasoningSummary: "Most sampled names differ only by trailing counters.",
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "rename:cleanup",
        options: {
          path: "docs",
          hints: ["serial"],
          style: "slug",
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
    expect(result.stdout).toContain("Sampling filenames for cleanup analysis...");
    expect(result.stdout).toContain("Grouping filename patterns for cleanup analysis...");
    expect(result.stdout).toContain("Waiting for Codex cleanup suggestions...");
    expect(result.stdout).toContain("Analyzer families selected: timestamp, date, serial, uid");
    expect(result.stdout).toContain("Grouped analyzer review:");
    expect(result.stdout).toContain("Codex cleanup suggestion:");
    expect(result.stdout).toContain("Deterministic cleanup settings (global):");
    expect(result.stdout).toContain("- hints: serial");
    expect(result.promptCalls).toContainEqual({
      kind: "checkbox",
      message: "Analyzer families to focus on (all selected by default)",
    });
    expect(result.promptCalls).toContainEqual({
      kind: "confirm",
      message: "Write grouped cleanup analysis report CSV?",
    });
    expect(result.promptCalls).not.toContainEqual({
      kind: "select",
      message: "Cleanup output style",
    });
  });

  test("writes an analysis report csv during analyzer-assisted cleanup flow", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:cleanup", "number", "detailed"],
      checkboxQueue: [["timestamp", "date", "serial", "uid"]],
      requiredPathQueue: ["docs"],
      inputQueue: [""],
      confirmQueue: [true, false, true, true, true, true, true, true, true],
      cleanupAnalysisReportPath: `${REPO_ROOT}/reports/cleanup-analysis.csv`,
      cleanupAnalyzerSuggestion: {
        recommendedHints: ["serial"],
        recommendedStyle: "slug",
        confidence: 0.86,
        reasoningSummary: "Most sampled names differ only by trailing counters.",
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "rename:cleanup:analysis-report",
        options: {
          csvPath: `${REPO_ROOT}/reports/cleanup-analysis.csv`,
        },
      },
      {
        name: "rename:cleanup",
        options: {
          path: "docs",
          hints: ["serial"],
          style: "slug",
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
    expect(result.stdout).toContain("Wrote cleanup analysis report: reports/cleanup-analysis.csv");
    expect(result.stdout).not.toContain(REPO_ROOT);
    expect(result.promptCalls).toContainEqual({
      kind: "confirm",
      message: "Keep applied plan CSV?",
    });
    expect(result.promptCalls).toContainEqual({
      kind: "confirm",
      message: "Keep cleanup analysis report CSV?",
    });
  });

  test("retains analysis report cleanup when suggested settings are rejected", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:cleanup", "date", "done", "preserve", "number", "detailed"],
      checkboxQueue: [["timestamp", "date", "serial", "uid"]],
      requiredPathQueue: ["docs"],
      inputQueue: [""],
      confirmQueue: [true, false, true, true, false, true, true, false, true],
      cleanupAnalysisReportPath: `${REPO_ROOT}/reports/cleanup-analysis.csv`,
      cleanupAnalyzerSuggestion: {
        recommendedHints: ["serial"],
        recommendedStyle: "slug",
        confidence: 0.86,
        reasoningSummary: "Most sampled names differ only by trailing counters.",
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "rename:cleanup:analysis-report",
        options: {
          csvPath: `${REPO_ROOT}/reports/cleanup-analysis.csv`,
        },
      },
      {
        name: "rename:cleanup",
        options: {
          path: "docs",
          hints: ["date"],
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
    expect(result.stdout).toContain("Wrote cleanup analysis report: reports/cleanup-analysis.csv");
    expect(result.stdout).toContain("Cleanup plan CSV removed: plans/cleanup.csv");
    expect(result.promptCalls).toContainEqual({
      kind: "confirm",
      message: "Use these as deterministic cleanup settings?",
    });
    expect(result.promptCalls).toContainEqual({
      kind: "confirm",
      message: "Keep applied plan CSV?",
    });
    expect(result.promptCalls).toContainEqual({
      kind: "confirm",
      message: "Keep cleanup analysis report CSV?",
    });
  });

  test("falls back to manual cleanup settings when analyzer suggestion fails", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:cleanup", "date", "done", "preserve", "skip"],
      checkboxQueue: [["timestamp", "date", "serial", "uid"]],
      requiredPathQueue: ["README.md"],
      confirmQueue: [true, true],
      cleanupAnalyzerErrorMessage: "mocked analyzer failure",
    });

    expect(result.actionCalls).toEqual([
      {
        name: "rename:cleanup",
        options: {
          path: "README.md",
          hints: ["date"],
          style: "preserve",
          conflictStrategy: "skip",
          dryRun: true,
        },
      },
    ]);
    expect(result.stdout).toContain("Sampling filenames for cleanup analysis...");
    expect(result.stdout).toContain("Waiting for Codex cleanup suggestions...");
    expect(result.stdout).toContain("Codex cleanup suggestion unavailable: mocked analyzer failure");
    expect(result.stdout).toContain("Falling back to manual cleanup settings.");
    expect(result.promptCalls).toContainEqual({
      kind: "select",
      message: "Cleanup output style",
    });
  });

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
            examples: [
              "report uid-7k3m9q2x4t final.txt",
              "nested/report uid-9m4k2q7x1v final.txt",
            ],
          },
          {
            pattern: "report-{date}-final.txt",
            count: 2,
            examples: [
              "report 2026-03-02 final.txt",
              "nested/report 2026-03-03 final.txt",
            ],
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
            examples: [
              "report uid-7k3m9q2x4t final.txt",
              "nested/report uid-9m4k2q7x1v final.txt",
            ],
          },
          {
            pattern: "report-{date}-final.txt",
            count: 2,
            examples: [
              "report 2026-03-02 final.txt",
              "nested/report 2026-03-03 final.txt",
            ],
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
              examples: [
                "report 2026-03-02 final.txt",
                "nested/report 2026-03-03 final.txt",
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
    expect(result.stdout).toContain("Analyzer families selected: timestamp, date, serial, uid");
  });

  test("supports plan-only retention choice in dry-run no-apply flow", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:cleanup", "date", "done", "preserve", "skip", "summary"],
      requiredPathQueue: ["docs"],
      inputQueue: [""],
      confirmQueue: [true, false, false, true, false, false],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "rename:cleanup",
        options: {
          path: "docs",
          hints: ["date"],
          style: "preserve",
          conflictStrategy: "skip",
          recursive: true,
          dryRun: true,
          previewSkips: "summary",
        },
      },
    ]);
    expect(result.promptCalls).toContainEqual({
      kind: "confirm",
      message: "Keep dry-run plan CSV for later `rename apply`?",
    });
    expect(result.stdout).toContain("Cleanup plan CSV removed: plans/cleanup.csv");
  });

  test("supports independent plan/report retention choices in dry-run no-apply flow", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:cleanup", "number", "detailed"],
      checkboxQueue: [["timestamp", "date", "serial", "uid"]],
      requiredPathQueue: ["docs"],
      inputQueue: [""],
      confirmQueue: [true, false, true, true, true, true, false, false, true],
      cleanupAnalysisReportPath: `${REPO_ROOT}/reports/cleanup-analysis.csv`,
      cleanupAnalyzerSuggestion: {
        recommendedHints: ["serial"],
        recommendedStyle: "slug",
        confidence: 0.86,
        reasoningSummary: "Most sampled names differ only by trailing counters.",
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "rename:cleanup:analysis-report",
        options: {
          csvPath: `${REPO_ROOT}/reports/cleanup-analysis.csv`,
        },
      },
      {
        name: "rename:cleanup",
        options: {
          path: "docs",
          hints: ["serial"],
          style: "slug",
          conflictStrategy: "number",
          recursive: true,
          dryRun: true,
          previewSkips: "detailed",
        },
      },
    ]);
    expect(result.promptCalls).toContainEqual({
      kind: "confirm",
      message: "Keep dry-run plan CSV for later `rename apply`?",
    });
    expect(result.promptCalls).toContainEqual({
      kind: "confirm",
      message: "Keep cleanup analysis report CSV?",
    });
    expect(result.stdout).toContain("Cleanup plan CSV removed: plans/cleanup.csv");
  });

  test("keeps artifacts on apply failure by skipping retention cleanup", () => {
    const result = runInteractiveHarness(
      {
        mode: "run",
        selectQueue: ["rename", "rename:cleanup", "date", "done", "preserve", "skip", "summary"],
        requiredPathQueue: ["docs"],
        inputQueue: [""],
        confirmQueue: [true, false, false, true, true],
        renameApplyErrorMessage: "mocked apply failure",
      },
      { allowFailure: true },
    );

    expect(result.error).toContain("mocked apply failure");
    expect(result.actionCalls).toEqual([
      {
        name: "rename:cleanup",
        options: {
          path: "docs",
          hints: ["date"],
          style: "preserve",
          conflictStrategy: "skip",
          recursive: true,
          dryRun: true,
          previewSkips: "summary",
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
    expect(result.stdout).not.toContain("Cleanup plan CSV removed:");
    expect(result.stdout).not.toContain("Cleanup analysis report removed:");
    expect(result.promptCalls).not.toContainEqual({
      kind: "confirm",
      message: "Keep applied plan CSV?",
    });
  });

  test("supports removing analysis report while keeping applied plan csv", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:cleanup", "number", "detailed"],
      checkboxQueue: [["timestamp", "date", "serial", "uid"]],
      requiredPathQueue: ["docs"],
      inputQueue: [""],
      confirmQueue: [true, false, true, true, true, true, true, true, false],
      cleanupAnalysisReportPath: `${REPO_ROOT}/reports/cleanup-analysis.csv`,
      cleanupAnalyzerSuggestion: {
        recommendedHints: ["serial"],
        recommendedStyle: "slug",
        confidence: 0.86,
        reasoningSummary: "Most sampled names differ only by trailing counters.",
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "rename:cleanup:analysis-report",
        options: {
          csvPath: `${REPO_ROOT}/reports/cleanup-analysis.csv`,
        },
      },
      {
        name: "rename:cleanup",
        options: {
          path: "docs",
          hints: ["serial"],
          style: "slug",
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
    expect(result.promptCalls).toContainEqual({
      kind: "confirm",
      message: "Keep cleanup analysis report CSV?",
    });
    expect(result.stdout).toContain("Cleanup analysis report removed: reports/cleanup-analysis.csv");
    expect(result.stdout).not.toContain("Cleanup plan CSV removed:");
  });

  test("falls back to manual settings when selected analyzer families match no grouped patterns", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:cleanup", "date", "done", "preserve", "skip"],
      checkboxQueue: [["uid"]],
      requiredPathQueue: ["README.md"],
      confirmQueue: [true, true],
      captureCleanupSuggestInput: true,
    });

    expect(result.actionCalls).toEqual([
      {
        name: "rename:cleanup",
        options: {
          path: "README.md",
          hints: ["date"],
          style: "preserve",
          conflictStrategy: "skip",
          dryRun: true,
        },
      },
    ]);
    expect(result.stdout).toContain(
      "Codex cleanup suggestion unavailable: No grouped analyzer patterns matched selected families.",
    );
    expect(result.stdout).toContain("Falling back to manual cleanup settings.");
    expect(result.promptCalls).toContainEqual({
      kind: "select",
      message: "Cleanup output style",
    });
    expect(
      result.actionCalls.some((actionCall) => actionCall.name === "rename:cleanup:codex-suggest"),
    ).toBe(false);
  });
});
