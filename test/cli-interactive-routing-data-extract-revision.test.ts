import { describe, expect, test } from "bun:test";

import { runInteractiveHarness, stripAnsi } from "./cli-interactive-routing.helpers";

describe("interactive mode routing: data extract revision", () => {
  test("re-selects the DuckDB source after revising extraction setup in a multi-source flow", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:extract", "users", "json", "review", "revise", "users", "json"],
      nowIsoString: "2026-03-30T00:00:00.400Z",
      stdoutColumns: 80,
      stdoutIsTTY: true,
      requiredPathQueue: ["fixtures/query.duckdb"],
      optionalPathQueue: [undefined, undefined],
      confirmQueue: [true, true, false, false, true, true],
      dataQueryDetectedFormat: "duckdb",
      dataQuerySources: ["users", "time_entries", "file", "analytics.events"],
      dataQueryIntrospection: {
        columns: [
          { name: "id", type: "INTEGER" },
          { name: "name", type: "VARCHAR" },
          { name: "status", type: "VARCHAR" },
        ],
        sampleRows: [{ id: "1", name: "Ada", status: "active" }],
        selectedSource: "users",
        truncated: false,
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:extract",
        options: {
          input: "fixtures/query.duckdb",
          inputFormat: "duckdb",
          output: "fixtures/query.json",
          overwrite: false,
          source: "users",
        },
      },
    ]);
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "select" && call.message === "Choose a DuckDB source",
      ),
    ).toHaveLength(2);
  });

  test("reopens destination selection without re-running extraction setup", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:extract", "csv", "destination", "json"],
      nowIsoString: "2026-03-30T00:00:00.900Z",
      stdoutColumns: 80,
      stdoutIsTTY: true,
      requiredPathQueue: ["fixtures/query.csv"],
      optionalPathQueue: [undefined, undefined],
      confirmQueue: [true, false, true, false, true],
      dataQueryDetectedFormat: "csv",
      dataQueryIntrospection: {
        columns: [
          { name: "id", type: "BIGINT" },
          { name: "name", type: "VARCHAR" },
        ],
        sampleRows: [{ id: "1", name: "Ada" }],
        truncated: false,
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:extract",
        options: {
          input: "fixtures/query.csv",
          inputFormat: "csv",
          output: "fixtures/query.json",
          overwrite: false,
        },
      },
    ]);
    const plainStderr = stripAnsi(result.stderr);
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "confirm" && call.message === "Treat CSV/TSV input as headerless?",
      ),
    ).toHaveLength(1);
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "select" && call.message === "Output format",
      ),
    ).toHaveLength(2);
    expect(plainStderr).toContain("Tip: Change destination keeps the current extraction setup.");
    expect(plainStderr.match(/Tip:/g) ?? []).toHaveLength(1);
    expect(
      plainStderr
        .trimStart()
        .startsWith("Tip: Change destination keeps the current extraction setup."),
    ).toBe(true);
    expect(
      plainStderr.indexOf("Tip: Change destination keeps the current extraction setup."),
    ).toBeLessThan(plainStderr.indexOf("Input:"));
  });

  test("writes the tty abort notice for interactive data extract startup", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:extract", "cancel"],
      nowIsoString: "2026-03-30T00:00:00.000Z",
      requiredPathQueue: ["fixtures/query.csv"],
      confirmQueue: [true, false, false],
      dataQueryDetectedFormat: "csv",
      stdoutColumns: 20,
      stdoutIsTTY: true,
      dataQueryIntrospection: {
        columns: [
          { name: "id", type: "BIGINT" },
          { name: "name", type: "VARCHAR" },
        ],
        sampleRows: [{ id: "1", name: "Ada" }],
        truncated: false,
      },
    });

    expect(result.actionCalls).toEqual([]);
    expect(stripAnsi(result.stderr)).toContain("Tip: Ctrl+C to abort.");
    expect(stripAnsi(result.stderr).match(/Tip:/g) ?? []).toHaveLength(1);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Extraction review next step",
    );
  });

  test("routes interactive data extract in explicit headerless mode for CSV input", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:extract", "json"],
      requiredPathQueue: ["fixtures/query.csv"],
      optionalPathQueue: [undefined],
      confirmQueue: [true, true, false, true, true],
      dataQueryDetectedFormat: "csv",
      dataQueryIntrospection: {
        columns: [
          { name: "column_1", type: "VARCHAR" },
          { name: "column_2", type: "VARCHAR" },
        ],
        sampleRows: [{ column_1: "id", column_2: "name" }],
        truncated: false,
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:extract",
        options: {
          input: "fixtures/query.csv",
          inputFormat: "csv",
          noHeader: true,
          output: "fixtures/query.json",
          overwrite: false,
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "confirm:Treat CSV/TSV input as headerless?",
    );
    expect(result.stderr).toContain("header mode: treat CSV/TSV input as headerless");
  });

  test("re-prompts the shape warning after a Codex source-shape failure instead of falling straight into extraction", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:extract", "Sheet1", "suggest", "continue", "csv", "cancel"],
      requiredPathQueue: ["fixtures/query.xlsx"],
      inputQueue: [""],
      optionalPathQueue: [undefined],
      confirmQueue: [true, true, false],
      dataQueryDetectedFormat: "excel",
      dataQueryIntrospection: {
        columns: [{ name: "RAW_TITLE", type: "DOUBLE" }],
        sampleRows: [],
        selectedSource: "Sheet1",
        truncated: false,
      },
      dataQuerySources: ["Sheet1"],
      dataSourceShapeSuggestionErrorMessage: "schema rejected",
    });

    expect(
      result.promptCalls.filter(
        (call) => call.kind === "select" && call.message === "Choose how to continue",
      ),
    ).toHaveLength(2);
    expect(result.stderr).toContain("Codex source-shape suggestion failed: schema rejected");
    expect(result.actionCalls).toEqual([
      {
        name: "data:source-shape-suggest",
        options: {
          selectedSource: "Sheet1",
          sheetName: "Sheet1",
        },
      },
    ]);
  });
});
