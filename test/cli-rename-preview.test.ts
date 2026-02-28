import { describe, expect, test } from "bun:test";

import {
  buildHeadTailSlice,
  composeCompactRenameBatchPreviewData,
  composeRenameBatchPreviewData,
  resolveRenamePreviewBudget,
  summarizeSkippedRenameItems,
} from "../src/cli/rename-preview";
import { createCapturedRuntime } from "./helpers/cli-test-utils";

describe("rename preview composition", () => {
  test("summarizeSkippedRenameItems groups reasons by count and sorts by count desc", () => {
    const rows = summarizeSkippedRenameItems([
      { path: "/tmp/a", reason: "hidden_file" },
      { path: "/tmp/b", reason: "hidden_file" },
      { path: "/tmp/c", reason: "file_too_large" },
      { path: "/tmp/d", reason: "default_excluded_entry" },
      { path: "/tmp/e", reason: "file_too_large" },
    ]);

    expect(rows.map((row) => row.line)).toEqual([
      "- 2 file_too_large",
      "- 2 hidden_file",
      "- 1 default_excluded_entry",
    ]);
  });

  test("buildHeadTailSlice returns head and tail segments when truncation is needed", () => {
    const slice = buildHeadTailSlice([1, 2, 3, 4, 5, 6, 7], {
      headCount: 2,
      tailCount: 2,
    });

    expect(slice.truncated).toBe(true);
    expect(slice.head).toEqual([1, 2]);
    expect(slice.tail).toEqual([6, 7]);
    expect(slice.omittedCount).toBe(3);
    expect(slice.totalCount).toBe(7);
  });

  test("composeRenameBatchPreviewData keeps current full-line ordering while exposing structured rows", () => {
    const { runtime } = createCapturedRuntime();
    const preview = composeRenameBatchPreviewData(runtime, {
      plans: [
        {
          fromPath: `${runtime.cwd}/examples/playground/huge-logs/app-00001.log`,
          toPath: `${runtime.cwd}/examples/playground/huge-logs/log-00001.log`,
          changed: true,
        },
      ],
      skipped: [
        {
          path: `${runtime.cwd}/examples/playground/huge-logs/.DS_Store`,
          reason: "default_excluded_entry",
        },
      ],
    });

    expect(preview.renameRows).toHaveLength(1);
    expect(preview.skippedSummaryRows.map((row) => row.line)).toEqual(["- 1 default_excluded_entry"]);
    expect(preview.skippedDetailRows).toHaveLength(1);
    expect(preview.fullLines).toEqual([
      "- app-00001.log -> log-00001.log",
      "- examples/playground/huge-logs/.DS_Store (skipped: default_excluded_entry)",
    ]);
  });

  test("resolveRenamePreviewBudget combines tty rows with a fixed cap", () => {
    const { runtime } = createCapturedRuntime();
    Object.assign(runtime.stdout as object, { isTTY: true, rows: 30 });

    const budget = resolveRenamePreviewBudget(runtime);

    expect(budget.rowCount).toBe(12);
    expect(budget.headCount).toBe(6);
    expect(budget.tailCount).toBe(6);
  });

  test("composeCompactRenameBatchPreviewData builds head-tail rename preview and skipped summary", () => {
    const { runtime } = createCapturedRuntime();
    Object.assign(runtime.stdout as object, { isTTY: true, rows: 28 });

    const preview = composeCompactRenameBatchPreviewData(runtime, {
      plans: Array.from({ length: 20 }, (_, index) => ({
        fromPath: `${runtime.cwd}/examples/playground/huge-logs/app-${String(index + 1).padStart(5, "0")}.log`,
        toPath: `${runtime.cwd}/examples/playground/huge-logs/log-${String(index + 1).padStart(5, "0")}.log`,
        changed: true,
      })),
      skipped: [
        { path: `${runtime.cwd}/examples/playground/huge-logs/a.log`, reason: "hidden_file" },
        { path: `${runtime.cwd}/examples/playground/huge-logs/b.log`, reason: "hidden_file" },
        { path: `${runtime.cwd}/examples/playground/huge-logs/c.log`, reason: "file_too_large" },
      ],
    });

    expect(preview.truncation).toEqual({
      totalCount: 20,
      headCount: 5,
      tailCount: 5,
      omittedCount: 10,
    });
    expect(preview.renameLines).toContain("...");
    expect(preview.renameLines[0]).toBe("- app-00001.log -> log-00001.log");
    expect(preview.renameLines.at(-1)).toBe("- app-00020.log -> log-00020.log");
    expect(preview.skippedSummaryLines).toEqual(["- 2 hidden_file", "- 1 file_too_large"]);
  });
});
