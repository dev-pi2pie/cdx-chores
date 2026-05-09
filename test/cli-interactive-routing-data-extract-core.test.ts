import { describe, expect, test } from "bun:test";

import { runInteractiveHarness, stripAnsi } from "./cli-interactive-routing.helpers";

describe("interactive mode routing: data extract core", () => {
  test("routes interactive data extract through shared extraction execution", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:extract", "json"],
      nowIsoString: "2026-03-30T00:00:00.900Z",
      stdoutColumns: 80,
      stdoutIsTTY: true,
      requiredPathQueue: ["fixtures/query.csv"],
      optionalPathQueue: [undefined],
      confirmQueue: [true, false, true, true],
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
    const plainStderr = stripAnsi(result.stderr);

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
    expect(result.pathCalls).toContainEqual({
      kind: "optional",
      message: "Output JSON file",
      options: expect.objectContaining({
        customMessage: "Custom JSON output path",
        defaultHint: "fixtures/query.csv.json",
        kind: "file",
      }),
    });
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
    expect(plainStderr).toContain("Extraction write summary");
    expect(plainStderr).toContain("Extraction review");
    expect(plainStderr).toContain("- output format: JSON");
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "confirm:Continue to output setup?",
    );
  });

  test("routes interactive DuckDB data extract through shared extraction execution", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:extract", "users", "json"],
      nowIsoString: "2026-03-30T00:00:00.900Z",
      stdoutColumns: 80,
      stdoutIsTTY: true,
      requiredPathQueue: ["fixtures/query.duckdb"],
      optionalPathQueue: [undefined],
      confirmQueue: [true, true, true],
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
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Choose a DuckDB source",
    );
    expect(stripAnsi(result.stderr)).toContain("Extraction review");
    expect(stripAnsi(result.stderr)).toContain("- source: users");
  });
});
