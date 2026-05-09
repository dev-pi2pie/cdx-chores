import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "./cli-interactive-routing.helpers";

describe("interactive mode routing: data query formal guide", () => {
  test("prompts for Excel range before SQL authoring and carries it into execution", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "Summary", "manual", "table"],
      requiredPathQueue: ["fixtures/query.xlsx"],
      inputQueue: ["A1:B3", "select * from file order by id", "10"],
      confirmQueue: [true, true],
      dataQueryDetectedFormat: "excel",
      dataQuerySources: ["Summary"],
      dataQueryIntrospection: {
        columns: [
          { name: "id", type: "BIGINT" },
          { name: "name", type: "VARCHAR" },
        ],
        sampleRows: [{ id: "1", name: "Ada" }],
        selectedRange: "A1:B3",
        selectedSource: "Summary",
        truncated: false,
      },
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
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose a data command",
      "confirm:Use detected input format: excel?",
      "select:Choose an Excel sheet",
      "input:Excel range (optional, e.g. A1:Z99)",
      "select:Choose mode",
      "input:SQL query",
      "confirm:Execute this SQL?",
      "select:Output mode",
      "input:Rows to show (optional)",
    ]);
    expect(result.stderr).toContain("This step changes how the source is interpreted as a table.");
    expect(result.stderr).toContain("Range:");
  });

  test("routes interactive data query formal-guide mode and builds deterministic SQL", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "formal-guide", "count", "table"],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["all", "status", "status:asc", "", "5"],
      confirmQueue: [true, false, false, true],
      dataQueryDetectedFormat: "csv",
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:query",
        options: {
          input: "fixtures/query.csv",
          inputFormat: "csv",
          json: undefined,
          output: undefined,
          overwrite: undefined,
          pretty: undefined,
          rows: 5,
          source: undefined,
          sql: 'select "status", count(*) as row_count\nfrom file\ngroup by "status"\norder by "status" asc',
        },
      },
    ]);
  });

  test("routes interactive data query manual mode in explicit headerless CSV mode", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "manual", "table"],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["select column_1, column_2 from file order by column_1", "10"],
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
        name: "data:query",
        options: {
          input: "fixtures/query.csv",
          inputFormat: "csv",
          json: undefined,
          noHeader: true,
          output: undefined,
          overwrite: undefined,
          pretty: undefined,
          rows: 10,
          sql: "select column_1, column_2 from file order by column_1",
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "confirm:Treat CSV/TSV input as headerless?",
    );
  });

  test("rejects aggregate formal-guide order-by columns outside the result set", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "formal-guide", "count", "table"],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["all", "", "status:asc", "row_count:desc", "", "5"],
      confirmQueue: [true, false, false, true],
      dataQueryDetectedFormat: "csv",
    });

    expect(result.validationCalls).toContainEqual({
      kind: "input",
      message: "Order by (column[:asc|desc], comma-separated, optional)",
      value: "status:asc",
      error: "Unknown order-by column: status.",
    });
    expect(result.actionCalls).toEqual([
      {
        name: "data:query",
        options: {
          input: "fixtures/query.csv",
          inputFormat: "csv",
          json: undefined,
          output: undefined,
          overwrite: undefined,
          pretty: undefined,
          rows: 5,
          source: undefined,
          sql: 'select count(*) as row_count\nfrom file\norder by "row_count" desc',
        },
      },
    ]);
  });

  test("routes formal-guide filter operators and optional SQL limit without prompting for value-less filters", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:query",
        "formal-guide",
        "name",
        "starts-with",
        "deleted_at",
        "is-null",
        "none",
        "table",
      ],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["all", "Ad", "", "25", "10"],
      confirmQueue: [true, false, true, true, false, true],
      dataQueryDetectedFormat: "csv",
      dataQueryIntrospection: {
        columns: [
          { name: "id", type: "BIGINT" },
          { name: "name", type: "VARCHAR" },
          { name: "deleted_at", type: "TIMESTAMP" },
        ],
        sampleRows: [{ id: "1", name: "Ada", deleted_at: "" }],
        truncated: false,
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:query",
        options: {
          input: "fixtures/query.csv",
          inputFormat: "csv",
          json: undefined,
          output: undefined,
          overwrite: undefined,
          pretty: undefined,
          rows: 10,
          source: undefined,
          sql: `select *
from file
where lower(cast("name" as varchar)) like lower('Ad') || '%' and "deleted_at" is null
limit 25`,
        },
      },
    ]);
    expect(
      result.promptCalls.filter((call) => call.kind === "input" && call.message === "Filter value"),
    ).toHaveLength(1);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "input:Maximum result rows (optional)",
    );
  });

  test("supports checkpoint backtracking from output selection to sql review in formal-guide", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "formal-guide", "none", "back", "table"],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["all", "", "25", ""],
      confirmQueue: [true, false, false, true, true],
      dataQueryDetectedFormat: "csv",
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:query",
        options: {
          input: "fixtures/query.csv",
          inputFormat: "csv",
          json: undefined,
          output: undefined,
          overwrite: undefined,
          pretty: undefined,
          rows: undefined,
          source: undefined,
          sql: "select *\nfrom file\nlimit 25",
        },
      },
    ]);
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "confirm" && call.message === "Execute this SQL?",
      ),
    ).toHaveLength(2);
    expect(
      result.promptCalls.filter((call) => call.kind === "select" && call.message === "Output mode"),
    ).toHaveLength(2);
    expect(result.stderr).toContain("SQL limit:");
    expect(result.stderr).toContain("Table preview rows:");
    expect(result.stderr).toContain("default bounded");
  });

  test("supports cancel from output selection without executing the query", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "formal-guide", "none", "cancel"],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["all", "", "", ""],
      confirmQueue: [true, false, false, true],
      dataQueryDetectedFormat: "csv",
    });

    expect(result.actionCalls).toEqual([]);
    expect(
      result.promptCalls.filter((call) => call.kind === "select" && call.message === "Output mode"),
    ).toHaveLength(1);
  });
});
