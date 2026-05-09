import { describe, expect, test } from "bun:test";

import { runInteractiveHarness, stripAnsi } from "./cli-interactive-routing.helpers";

describe("interactive mode routing: data query review", () => {
  test("supports checkpoint change-mode from manual sql review", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:query",
        "manual",
        "change-mode",
        "formal-guide",
        "count",
        "table",
      ],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["select id from file", "all", "", "", "", "5"],
      confirmQueue: [true, false, false, false, true],
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
          sql: "select count(*) as row_count\nfrom file",
        },
      },
    ]);
    expect(
      result.promptCalls.filter((call) => call.kind === "select" && call.message === "Choose mode"),
    ).toHaveLength(2);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:SQL review next step",
    );
    expect(result.stderr).toContain("Table preview rows:");
    expect(result.stderr).toContain("5");
  });

  test("writes the tty abort notice for interactive data query startup", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "manual", "cancel"],
      nowIsoString: "2026-03-30T00:00:00.000Z",
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["select id from file"],
      confirmQueue: [true, false, false],
      dataQueryDetectedFormat: "csv",
      stdoutColumns: 20,
      stdoutIsTTY: true,
    });

    expect(result.actionCalls).toEqual([]);
    expect(stripAnsi(result.stderr)).toContain("Tip: Ctrl+C to abort.");
    expect(stripAnsi(result.stderr).match(/Tip:/g) ?? []).toHaveLength(1);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:SQL review next step",
    );
  });

  test("supports cancel from sql review without executing the query", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "manual", "cancel"],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["select id from file"],
      confirmQueue: [true, false, false],
      dataQueryDetectedFormat: "csv",
    });

    expect(result.actionCalls).toEqual([]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:SQL review next step",
    );
  });

  test("returns to the current sql review from output selection without reopening sql entry", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "manual", "back", "table"],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["select id from file", "10"],
      confirmQueue: [true, false, true, true],
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
          rows: 10,
          source: undefined,
          sql: "select id from file",
        },
      },
    ]);
    expect(
      result.promptCalls.filter((call) => call.kind === "input" && call.message === "SQL query"),
    ).toHaveLength(1);
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "confirm" && call.message === "Execute this SQL?",
      ),
    ).toHaveLength(2);
    expect(
      result.promptCalls.filter((call) => call.kind === "select" && call.message === "Output mode"),
    ).toHaveLength(2);
  });

  test("re-prompts file output when overwrite is declined", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "manual", "file", "file"],
      requiredPathQueue: ["fixtures/query.csv", "reports/existing.json", "reports/fresh.json"],
      inputQueue: ["select id from file"],
      confirmQueue: [true, false, true, false, false],
      existingPaths: ["reports/existing.json"],
      dataQueryDetectedFormat: "csv",
    });

    expect(
      result.pathCalls.filter(
        (call) => call.kind === "required" && call.message === "Output file path",
      ),
    ).toHaveLength(2);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "confirm:Overwrite if exists?",
    );
    expect(result.stdout).toContain("Choose a different output destination.");
    expect(result.actionCalls).toHaveLength(1);
    expect(result.actionCalls[0]).toMatchObject({
      name: "data:query",
      options: {
        input: "fixtures/query.csv",
        inputFormat: "csv",
        output: "reports/fresh.json",
        overwrite: false,
        pretty: false,
        sql: "select id from file",
      },
    });
  });
});
