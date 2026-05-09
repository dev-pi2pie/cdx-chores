import { describe, expect, test } from "bun:test";

import { runInteractiveHarness, stripAnsi } from "./cli-interactive-routing.helpers";

describe("interactive mode routing: data extract checkpoints", () => {
  test("lets interactive data extract stop before materialization at the final write boundary", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:extract", "csv", "cancel"],
      requiredPathQueue: ["fixtures/query.csv"],
      optionalPathQueue: [undefined],
      confirmQueue: [true, false, true, false],
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

    expect(result.actionCalls).toEqual([]);
    expect(result.stderr).toContain("Extraction write summary");
    expect(result.stderr).toContain("Skipped extraction write.");
  });

  test("lets interactive DuckDB data extract stop before materialization at the final write boundary", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:extract", "users", "json", "cancel"],
      requiredPathQueue: ["fixtures/query.duckdb"],
      optionalPathQueue: [undefined],
      confirmQueue: [true, true, false],
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

    expect(result.actionCalls).toEqual([]);
    expect(result.stderr).toContain("Extraction write summary");
    expect(result.stderr).toContain("Skipped extraction write.");
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Extraction write next step",
    );
  });

  test("supports checkpoint backtracking from the extraction write boundary", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:extract", "json", "review", "revise", "json"],
      requiredPathQueue: ["fixtures/query.csv"],
      optionalPathQueue: [undefined, undefined],
      confirmQueue: [true, false, true, false, false, true, false, true, true],
      dataQueryDetectedFormat: "csv",
      dataQueryIntrospectionQueue: [
        {
          columns: [
            { name: "id", type: "BIGINT" },
            { name: "name", type: "VARCHAR" },
          ],
          sampleRows: [{ id: "1", name: "Ada" }],
          truncated: false,
        },
        {
          columns: [
            { name: "column_1", type: "VARCHAR" },
            { name: "column_2", type: "VARCHAR" },
          ],
          sampleRows: [{ column_1: "id", column_2: "name" }],
          truncated: false,
        },
      ],
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
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "confirm" && call.message === "Treat CSV/TSV input as headerless?",
      ),
    ).toHaveLength(2);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Extraction write next step",
    );
    expect(
      result.selectChoicesByMessage["Extraction write next step"]?.map((choice) => choice.value),
    ).toEqual(["review", "destination", "cancel"]);
  });

  test("re-selects the source after revising extraction setup in a multi-source flow", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:extract",
        "Summary",
        "json",
        "review",
        "revise",
        "Summary",
        "json",
      ],
      nowIsoString: "2026-03-30T00:00:00.400Z",
      stdoutColumns: 80,
      stdoutIsTTY: true,
      requiredPathQueue: ["fixtures/query.xlsx"],
      inputQueue: ["", ""],
      optionalPathQueue: [undefined, undefined],
      confirmQueue: [true, true, false, false, true, true],
      dataQueryDetectedFormat: "excel",
      dataQuerySources: ["Summary", "Archive"],
      dataQueryIntrospection: {
        columns: [
          { name: "id", type: "BIGINT" },
          { name: "name", type: "VARCHAR" },
        ],
        sampleRows: [{ id: "1", name: "Ada" }],
        selectedSource: "Summary",
        truncated: false,
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:extract",
        options: {
          input: "fixtures/query.xlsx",
          inputFormat: "excel",
          output: "fixtures/query.json",
          overwrite: false,
          source: "Summary",
        },
      },
    ]);
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "select" && call.message === "Choose an Excel sheet",
      ),
    ).toHaveLength(2);
    expect(stripAnsi(result.stderr).match(/Tip:/g) ?? []).toHaveLength(1);
    expect(stripAnsi(result.stderr).indexOf("Tip:")).toBeLessThan(
      stripAnsi(result.stderr).indexOf("Input:"),
    );
  });
});
