import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "./cli-interactive-routing.helpers";

describe("interactive mode routing: data query source shape", () => {
  test("prints DuckDB install remediation command for interactive query extension failures", () => {
    const result = runInteractiveHarness(
      {
        mode: "run",
        selectQueue: ["data", "data:query", "Summary", "manual", "table"],
        requiredPathQueue: ["fixtures/query.xlsx"],
        inputQueue: ["", "select id from file", "10"],
        confirmQueue: [true, true],
        dataQueryActionErrorCode: "DUCKDB_EXTENSION_UNAVAILABLE",
        dataQueryActionErrorMessage:
          "Excel query requires the DuckDB excel extension, and it is not installed in the current environment. Install it explicitly in DuckDB, then retry.",
        dataQueryDetectedFormat: "excel",
        dataQuerySources: ["Summary"],
        dataQueryIntrospection: {
          columns: [{ name: "id", type: "BIGINT" }],
          sampleRows: [{ id: "1" }],
          selectedSource: "Summary",
          truncated: false,
        },
      },
      { allowFailure: true },
    );

    expect(result.error).toContain("requires the DuckDB excel extension");
    expect(result.stderr).toContain(
      "Install the missing DuckDB extension with: cdx-chores data duckdb extension install excel",
    );
  });

  test("warns about suspicious raw Excel schemas before SQL authoring and supports manual range recovery", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "Summary", "range", "manual", "table"],
      requiredPathQueue: ["fixtures/query.xlsx"],
      inputQueue: ["", "A1:B3", "select * from file order by id", "10"],
      confirmQueue: [true, true],
      dataQueryDetectedFormat: "excel",
      dataQueryIntrospectionQueue: [
        {
          columns: [{ name: "Quarterly Operations Report", type: "VARCHAR" }],
          sampleRows: [],
          selectedSource: "Summary",
          truncated: false,
        },
        {
          columns: [
            { name: "id", type: "BIGINT" },
            { name: "name", type: "VARCHAR" },
          ],
          sampleRows: [{ id: "1", name: "Ada" }],
          selectedRange: "A1:B3",
          selectedSource: "Summary",
          truncated: false,
        },
      ],
      dataQuerySources: ["Summary"],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:query",
        options: {
          input: "fixtures/query.xlsx",
          inputFormat: "excel",
          json: undefined,
          output: undefined,
          overwrite: undefined,
          pretty: undefined,
          range: "A1:B3",
          rows: 10,
          source: "Summary",
          sql: "select * from file order by id",
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Choose how to continue",
    );
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "input:Excel range (required, e.g. A1:Z99)",
    );
    expect(result.stderr).toContain(
      "Sheet shape warning: current Excel sheet shape looks suspicious.",
    );
    expect(result.stderr).toContain("Accepted source shape: --range A1:B3");
    expect(result.stderr).toContain("Re-inspecting shaped source before SQL authoring.");
  });

  test("warns about suspicious raw Excel schemas before SQL authoring and supports reviewed Codex shape recovery", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "Summary", "suggest", "accept", "manual", "table"],
      requiredPathQueue: ["fixtures/query.xlsx"],
      inputQueue: ["", "select * from file order by id", "10"],
      confirmQueue: [true, true],
      dataQueryDetectedFormat: "excel",
      dataQueryIntrospectionQueue: [
        {
          columns: [{ name: "Quarterly Operations Report", type: "VARCHAR" }],
          sampleRows: [],
          selectedSource: "Summary",
          truncated: false,
        },
        {
          columns: [
            { name: "id", type: "BIGINT" },
            { name: "name", type: "VARCHAR" },
          ],
          sampleRows: [{ id: "1", name: "Ada" }],
          selectedHeaderRow: 7,
          selectedRange: "A1:B3",
          selectedSource: "Summary",
          truncated: false,
        },
      ],
      dataQuerySources: ["Summary"],
      dataSourceShapeSuggestion: {
        reasoningSummary: "The real table starts at row 7 across the first two columns.",
        shape: {
          range: "A1:B3",
          headerRow: 7,
        },
      },
    });

    expect(result.actionCalls).toContainEqual({
      name: "data:source-shape-suggest",
      options: {
        selectedSource: "Summary",
        sheetName: "Summary",
      },
    });
    expect(result.actionCalls).toContainEqual({
      name: "data:query",
      options: {
        headerRow: 7,
        input: "fixtures/query.xlsx",
        inputFormat: "excel",
        json: undefined,
        output: undefined,
        overwrite: undefined,
        pretty: undefined,
        range: "A1:B3",
        rows: 10,
        source: "Summary",
        sql: "select * from file order by id",
      },
    });
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Source shape review",
    );
    expect(result.stdout).toContain("Inspecting worksheet structure");
    expect(result.stdout).toContain("Waiting for Codex source-shape suggestions");
    expect(result.stderr).toContain("Suggested source shape");
    expect(result.stderr).toContain("--header-row 7");
    expect(result.stderr).toContain("Accepted source shape: --range A1:B3 --header-row 7");
  });

  test("warns for collapsed merged-sheet whole-sheet views even when one visible column still has sample rows", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:extract", "Sheet1", "continue", "csv", "cancel"],
      requiredPathQueue: ["fixtures/query.xlsx"],
      inputQueue: [""],
      optionalPathQueue: [undefined],
      confirmQueue: [true, true, false],
      dataQueryDetectedFormat: "excel",
      dataQueryIntrospection: {
        columns: [{ name: "Hello_This_Is_the_merged", type: "VARCHAR" }],
        sampleRows: [
          { Hello_This_Is_the_merged: "ID" },
          { Hello_This_Is_the_merged: "78.0" },
          { Hello_This_Is_the_merged: "21.0" },
        ],
        selectedSource: "Sheet1",
        truncated: false,
      },
      dataQuerySources: ["Sheet1"],
      xlsxSheetSnapshot: {
        mergedRanges: ["A1:C1"],
        usedRange: "A1:C5",
      },
    });

    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Choose how to continue",
    );
    expect(result.stderr).toContain(
      "Whole-sheet inspection collapsed a merged or multi-column worksheet into one visible column.",
    );
    expect(result.actionCalls).toEqual([]);
  });
});
