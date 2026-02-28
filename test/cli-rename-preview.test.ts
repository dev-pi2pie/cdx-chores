import { describe, expect, test } from "bun:test";

import {
  buildHeadTailSlice,
  composeRenameBatchPreviewData,
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
});
