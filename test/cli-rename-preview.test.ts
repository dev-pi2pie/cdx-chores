import { describe, expect, test } from "bun:test";

import {
  buildHeadTailSlice,
  composeCompactRenameBatchPreviewData,
  composeCompactRenameBatchPreviewDataFromPlanCsvRows,
  composeDetailedSkippedPreviewData,
  composeRenameBatchPreviewData,
  composeRenameBatchPreviewDataFromPlanCsvRows,
  createRenamePreviewSourceDataFromPlanCsvRows,
  resolveDetailedSkippedPreviewBudget,
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
    expect(preview.skippedSummaryRows.map((row) => row.line)).toEqual([
      "- 1 default_excluded_entry",
    ]);
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

  test("composeCompactRenameBatchPreviewData prefers changed rows when a mixed batch would truncate", () => {
    const { runtime } = createCapturedRuntime();
    Object.assign(runtime.stdout as object, { isTTY: true, rows: 28 });

    const plans = [
      ...Array.from({ length: 8 }, (_, index) => ({
        fromPath: `${runtime.cwd}/examples/playground/huge-logs/a-${String(index + 1).padStart(2, "0")}.log`,
        toPath: `${runtime.cwd}/examples/playground/huge-logs/a-${String(index + 1).padStart(2, "0")}.log`,
        changed: false,
      })),
      ...Array.from({ length: 4 }, (_, index) => ({
        fromPath: `${runtime.cwd}/examples/playground/huge-logs/m ${String(index + 1).padStart(2, "0")}.log`,
        toPath: `${runtime.cwd}/examples/playground/huge-logs/m-${String(index + 1).padStart(2, "0")}.log`,
        changed: true,
      })),
      ...Array.from({ length: 8 }, (_, index) => ({
        fromPath: `${runtime.cwd}/examples/playground/huge-logs/z-${String(index + 1).padStart(2, "0")}.log`,
        toPath: `${runtime.cwd}/examples/playground/huge-logs/z-${String(index + 1).padStart(2, "0")}.log`,
        changed: false,
      })),
    ];

    const preview = composeCompactRenameBatchPreviewData(runtime, {
      plans,
      skipped: [],
    });

    expect(preview.truncation).toBeUndefined();
    expect(preview.renameLines).toEqual([
      "- m 01.log -> m-01.log",
      "- m 02.log -> m-02.log",
      "- m 03.log -> m-03.log",
      "- m 04.log -> m-04.log",
    ]);
  });

  test("resolveDetailedSkippedPreviewBudget uses a smaller bounded budget than the rename preview", () => {
    const { runtime } = createCapturedRuntime();
    Object.assign(runtime.stdout as object, { isTTY: true, rows: 32 });

    const budget = resolveDetailedSkippedPreviewBudget(runtime);

    expect(budget.rowCount).toBe(7);
    expect(budget.headCount).toBe(4);
    expect(budget.tailCount).toBe(3);
  });

  test("composeDetailedSkippedPreviewData builds a bounded skipped-item preview", () => {
    const { runtime } = createCapturedRuntime();
    Object.assign(runtime.stdout as object, { isTTY: true, rows: 32 });

    const preview = composeDetailedSkippedPreviewData(runtime, {
      skipped: Array.from({ length: 10 }, (_, index) => ({
        path: `${runtime.cwd}/examples/playground/huge-logs/skip-${String(index + 1).padStart(2, "0")}.log`,
        reason: "hidden_file",
      })),
    });

    expect(preview.truncation).toEqual({
      totalCount: 10,
      headCount: 4,
      tailCount: 3,
      omittedCount: 3,
    });
    expect(preview.skippedLines).toContain("...");
    expect(preview.skippedLines[0]).toContain("skip-01.log");
    expect(preview.skippedLines.at(-1)).toContain("skip-10.log");
  });

  test("createRenamePreviewSourceDataFromPlanCsvRows rehydrates plans and skipped items from replay rows", () => {
    const { runtime } = createCapturedRuntime();

    const source = createRenamePreviewSourceDataFromPlanCsvRows(runtime, [
      {
        old_name: "a.txt",
        new_name: "b.txt",
        cleaned_stem: "",
        ai_new_name: "",
        ai_provider: "",
        ai_model: "",
        changed_at: "",
        old_path: "examples/playground/huge-logs/a.txt",
        new_path: "examples/playground/huge-logs/b.txt",
        plan_id: "plan-1",
        planned_at: "2026-02-28T00:00:00.000Z",
        applied_at: "",
        status: "planned",
        reason: "",
        timestamp_tz: "",
      },
      {
        old_name: "skip.txt",
        new_name: "skip.txt",
        cleaned_stem: "",
        ai_new_name: "",
        ai_provider: "",
        ai_model: "",
        changed_at: "",
        old_path: "examples/playground/huge-logs/skip.txt",
        new_path: "examples/playground/huge-logs/skip.txt",
        plan_id: "plan-1",
        planned_at: "2026-02-28T00:00:00.000Z",
        applied_at: "",
        status: "skipped",
        reason: "symlink",
        timestamp_tz: "",
      },
    ]);

    expect(source.plans).toEqual([
      {
        fromPath: `${runtime.cwd}/examples/playground/huge-logs/a.txt`,
        toPath: `${runtime.cwd}/examples/playground/huge-logs/b.txt`,
        changed: true,
      },
    ]);
    expect(source.skipped).toEqual([
      {
        path: `${runtime.cwd}/examples/playground/huge-logs/skip.txt`,
        reason: "symlink",
      },
    ]);
  });

  test("plan csv row helpers compose the same preview surfaces used by live dry-run output", () => {
    const { runtime } = createCapturedRuntime();
    Object.assign(runtime.stdout as object, { isTTY: true, rows: 28 });

    const rows = [
      {
        old_name: "app-00001.log",
        new_name: "log-00001.log",
        cleaned_stem: "",
        ai_new_name: "",
        ai_provider: "",
        ai_model: "",
        changed_at: "",
        old_path: "examples/playground/huge-logs/app-00001.log",
        new_path: "examples/playground/huge-logs/log-00001.log",
        plan_id: "plan-1",
        planned_at: "2026-02-28T00:00:00.000Z",
        applied_at: "",
        status: "planned" as const,
        reason: "",
        timestamp_tz: "",
      },
      {
        old_name: "skip-a.log",
        new_name: "skip-a.log",
        cleaned_stem: "",
        ai_new_name: "",
        ai_provider: "",
        ai_model: "",
        changed_at: "",
        old_path: "examples/playground/huge-logs/skip-a.log",
        new_path: "examples/playground/huge-logs/skip-a.log",
        plan_id: "plan-1",
        planned_at: "2026-02-28T00:00:00.000Z",
        applied_at: "",
        status: "skipped" as const,
        reason: "hidden_file",
        timestamp_tz: "",
      },
    ];

    const fullPreview = composeRenameBatchPreviewDataFromPlanCsvRows(runtime, rows);
    const compactPreview = composeCompactRenameBatchPreviewDataFromPlanCsvRows(runtime, rows);

    expect(fullPreview.fullLines).toEqual([
      "- app-00001.log -> log-00001.log",
      "- examples/playground/huge-logs/skip-a.log (skipped: hidden_file)",
    ]);
    expect(compactPreview.renameLines).toEqual(["- app-00001.log -> log-00001.log"]);
    expect(compactPreview.skippedSummaryLines).toEqual(["- 1 hidden_file"]);
  });
});
