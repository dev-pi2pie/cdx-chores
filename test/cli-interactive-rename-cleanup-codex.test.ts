import { describe, expect, test } from "bun:test";

import { REPO_ROOT } from "./helpers/cli-test-utils";
import { runInteractiveHarness } from "./helpers/interactive-harness";

describe("interactive rename routing", () => {
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
    expect(result.stdout).toContain(
      "Codex cleanup suggestion unavailable: mocked analyzer failure",
    );
    expect(result.stdout).toContain("Falling back to manual cleanup settings.");
    expect(result.promptCalls).toContainEqual({
      kind: "select",
      message: "Cleanup output style",
    });
  });

  test("falls back to manual cleanup settings when analyzer suggestion throws", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:cleanup", "date", "done", "preserve", "skip"],
      checkboxQueue: [["timestamp", "date", "serial", "uid"]],
      requiredPathQueue: ["README.md"],
      confirmQueue: [true, true],
      cleanupAnalyzerThrowMessage: "mocked thrown analyzer failure",
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
    expect(result.stdout).toContain(
      "Codex cleanup suggestion unavailable: mocked thrown analyzer failure",
    );
    expect(result.stdout).toContain("Falling back to manual cleanup settings.");
    expect(result.promptCalls).toContainEqual({
      kind: "select",
      message: "Cleanup output style",
    });
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
    expect(result.stdout).toContain("Grouped analyzer review:");
    expect(result.stdout).toContain("- no grouped pattern evidence");
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
