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
      confirmQueue: [true, false, false, true, true, true],
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
          autoClean: true,
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
      confirmQueue: [true, false, false, true, false],
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
          autoClean: true,
        },
      },
    ]);
    expect(result.stdout).toContain("Sampling filenames for cleanup analysis...");
    expect(result.stdout).toContain("Grouping filename patterns for cleanup analysis...");
    expect(result.stdout).toContain("Waiting for Codex cleanup suggestions...");
    expect(result.stdout).toContain("Codex cleanup suggestion:");
    expect(result.stdout).toContain("- hints: serial");
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
      requiredPathQueue: ["docs"],
      inputQueue: [""],
      confirmQueue: [true, false, true, true, true, true, true, true],
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
          autoClean: true,
        },
      },
    ]);
    expect(result.stdout).toContain("Wrote cleanup analysis report: reports/cleanup-analysis.csv");
    expect(result.stdout).toContain("Cleanup analysis report auto-cleaned: reports/cleanup-analysis.csv");
    expect(result.stdout).not.toContain(REPO_ROOT);
    expect(result.promptCalls).toContainEqual({
      kind: "confirm",
      message: "Auto-clean plan/report CSV after apply?",
    });
  });

  test("retains analysis report cleanup when suggested settings are rejected", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:cleanup", "date", "done", "preserve", "number", "detailed"],
      requiredPathQueue: ["docs"],
      inputQueue: [""],
      confirmQueue: [true, false, true, true, false, true, true, true, true],
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
          autoClean: true,
        },
      },
    ]);
    expect(result.stdout).toContain("Wrote cleanup analysis report: reports/cleanup-analysis.csv");
    expect(result.stdout).toContain("Cleanup analysis report auto-cleaned: reports/cleanup-analysis.csv");
    expect(result.promptCalls).toContainEqual({
      kind: "confirm",
      message: "Use these suggested cleanup settings?",
    });
    expect(result.promptCalls).toContainEqual({
      kind: "confirm",
      message: "Auto-clean plan/report CSV after apply?",
    });
  });

  test("falls back to manual cleanup settings when analyzer suggestion fails", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:cleanup", "date", "done", "preserve", "skip"],
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
});
