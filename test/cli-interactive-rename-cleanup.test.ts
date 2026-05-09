import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "./helpers/interactive-harness";

describe("interactive rename routing", () => {
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

  test("skips apply and retention prompts for non-dry-run cleanup", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:cleanup", "date", "done", "preserve", "skip"],
      requiredPathQueue: ["docs"],
      inputQueue: [""],
      confirmQueue: [true, false, false, false],
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
          dryRun: false,
        },
      },
    ]);
    expect(result.promptCalls).not.toContainEqual({
      kind: "confirm",
      message: "Apply these renames now?",
    });
    expect(result.promptCalls).not.toContainEqual({
      kind: "confirm",
      message: "Keep applied plan CSV?",
    });
    expect(result.promptCalls).not.toContainEqual({
      kind: "confirm",
      message: "Keep dry-run plan CSV for later `rename apply`?",
    });
  });
});
