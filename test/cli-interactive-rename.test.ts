import { describe, expect, test } from "bun:test";

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
        "Main placeholders: {prefix}, {timestamp}, {date}, {stem}, {serial}",
        "Advanced: explicit timestamp variants and {serial...} params are also supported.",
      ].join("\n"),
    });
  });

  test("routes a cleanup file flow", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:cleanup", "date", "done", "preserve", "skip"],
      requiredPathQueue: ["README.md"],
      confirmQueue: [true],
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
      confirmQueue: [true, false, true, true, true],
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
});
