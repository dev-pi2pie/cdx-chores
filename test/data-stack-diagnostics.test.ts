import { describe, expect, test } from "bun:test";

import { computeDataStackDiagnostics } from "../src/cli/data-stack/diagnostics";
import { CliError } from "../src/cli/errors";

describe("data stack diagnostics", () => {
  test("counts exact duplicate rows from normalized output rows", () => {
    const diagnostics = computeDataStackDiagnostics({
      header: ["id", "status"],
      matchedFileCount: 1,
      rows: [
        ["1", "active"],
        ["1", "active"],
        ["2", "paused"],
      ],
    });

    expect(diagnostics.duplicateSummary.exactDuplicateRows).toBe(1);
    expect(diagnostics.duplicateSummary.duplicateKeyConflicts).toBe(0);
  });

  test("counts duplicate key conflicts and ignores null key rows", () => {
    const diagnostics = computeDataStackDiagnostics({
      header: ["id", "status"],
      matchedFileCount: 1,
      rows: [
        ["1", "active"],
        ["1", "paused"],
        ["", "draft"],
        [null, "draft"],
      ],
      uniqueBy: ["id"],
    });

    expect(diagnostics.duplicateSummary.duplicateKeyConflicts).toBe(1);
    expect(diagnostics.duplicateKeyNullRows).toBe(2);
  });

  test("counts composite duplicate key conflicts and null key rows", () => {
    const diagnostics = computeDataStackDiagnostics({
      header: ["region", "day", "status"],
      matchedFileCount: 1,
      rows: [
        ["apac", "mon", "active"],
        ["apac", "mon", "paused"],
        ["apac", "", "draft"],
        ["emea", "mon", "active"],
      ],
      uniqueBy: ["region", "day"],
    });

    expect(diagnostics.duplicateSummary.duplicateKeyConflicts).toBe(1);
    expect(diagnostics.duplicateKeyNullRows).toBe(1);
  });

  test("reports candidate unique keys only when values are complete and unique", () => {
    const diagnostics = computeDataStackDiagnostics({
      header: ["id", "region", "day"],
      matchedFileCount: 1,
      rows: [
        ["1", "apac", "mon"],
        ["2", "apac", "tue"],
        ["3", "emea", "mon"],
      ],
    });

    expect(diagnostics.planDiagnostics.candidateUniqueKeys).toEqual([
      {
        columns: ["id"],
        duplicateRows: 0,
        nullRows: 0,
      },
      {
        columns: ["id", "region"],
        duplicateRows: 0,
        nullRows: 0,
      },
      {
        columns: ["id", "day"],
        duplicateRows: 0,
        nullRows: 0,
      },
      {
        columns: ["region", "day"],
        duplicateRows: 0,
        nullRows: 0,
      },
    ]);
  });

  test("bounds column summaries and enum-like values for Codex assist payloads", () => {
    const diagnostics = computeDataStackDiagnostics({
      header: Array.from({ length: 60 }, (_value, index) => `column_${index + 1}`),
      matchedFileCount: 1,
      rows: Array.from({ length: 14 }, (_value, rowIndex) =>
        Array.from({ length: 60 }, (_cell, columnIndex) =>
          columnIndex === 0 ? `value_${rowIndex + 1}` : "same",
        ),
      ),
    });

    expect(diagnostics.columnSummaries).toHaveLength(48);
    expect(diagnostics.columnSummaries[0]?.sampleValues).toHaveLength(5);
    expect(diagnostics.columnSummaries[0]?.enumLikeValues).toEqual([]);
    expect(diagnostics.columnSummaries[1]?.enumLikeValues).toEqual(["same"]);
  });

  test("bounds candidate unique keys", () => {
    const diagnostics = computeDataStackDiagnostics({
      header: Array.from({ length: 20 }, (_value, index) => `column_${index + 1}`),
      matchedFileCount: 1,
      rows: [
        Array.from({ length: 20 }, (_value, index) => `a${index + 1}`),
        Array.from({ length: 20 }, (_value, index) => `b${index + 1}`),
      ],
    });

    expect(
      diagnostics.planDiagnostics.candidateUniqueKeys.map((candidate) => candidate.columns),
    ).toEqual(Array.from({ length: 12 }, (_value, index) => [`column_${index + 1}`]));
  });

  test("rejects unknown unique key columns", () => {
    expect(() =>
      computeDataStackDiagnostics({
        header: ["id"],
        matchedFileCount: 1,
        rows: [["1"]],
        uniqueBy: ["missing"],
      }),
    ).toThrow(CliError);
  });
});
