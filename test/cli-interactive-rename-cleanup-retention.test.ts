import { describe, expect, test } from "bun:test";

import { REPO_ROOT } from "./helpers/cli-test-utils";
import { runInteractiveHarness } from "./helpers/interactive-harness";

describe("interactive rename routing", () => {
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

  test("removes applied plan csv when no analysis report exists", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:cleanup", "date", "done", "preserve", "skip", "summary"],
      requiredPathQueue: ["docs"],
      inputQueue: [""],
      confirmQueue: [true, false, false, true, true, false],
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
      message: "Keep applied plan CSV?",
    });
    expect(result.promptCalls).not.toContainEqual({
      kind: "confirm",
      message: "Keep cleanup analysis report CSV?",
    });
    expect(result.removedPaths).toEqual(["plans/cleanup.csv"]);
    expect(result.stdout).toContain("Cleanup plan CSV removed: plans/cleanup.csv");
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
    expect(result.stdout).toContain(
      "Cleanup analysis report removed: reports/cleanup-analysis.csv",
    );
    expect(result.stdout).not.toContain("Cleanup plan CSV removed:");
  });
});
