import { describe, expect, test } from "bun:test";

import { runInteractiveHarness, stripAnsi } from "./cli-interactive-routing.helpers";

describe("interactive mode routing: data preview", () => {
  test("routes data preview through optional interactive prompts", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:preview"],
      requiredPathQueue: ["fixtures/table.csv"],
      confirmQueue: [false],
      inputQueue: ["15", "", "id,status", ""],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:preview",
        options: {
          input: "fixtures/table.csv",
          rows: 15,
          offset: undefined,
          columns: ["id", "status"],
          contains: undefined,
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose a data command",
      "confirm:Treat CSV/TSV input as headerless?",
      "input:Rows to show (optional)",
      "input:Row offset (optional)",
      "input:Columns to show (comma-separated, optional)",
      "input:Contains filter (column:keyword, optional)",
    ]);
    expect(result.validationCalls).toEqual([]);
  });

  test("does not show the abort tip for the lightweight preview flow", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:preview"],
      nowIsoString: "2026-03-30T00:00:00.000Z",
      requiredPathQueue: ["fixtures/table.csv"],
      confirmQueue: [false],
      inputQueue: ["", "", "", ""],
      stdoutColumns: 30,
      stdoutIsTTY: true,
    });

    const plainStderr = stripAnsi(result.stderr);
    expect(result.actionCalls).toEqual([
      {
        name: "data:preview",
        options: {
          input: "fixtures/table.csv",
          rows: undefined,
          offset: undefined,
          columns: undefined,
          contains: undefined,
        },
      },
    ]);
    expect(plainStderr).not.toContain("Tip:");
  });

  test("does not show the abort tip for lightweight preview input errors", () => {
    const result = runInteractiveHarness(
      {
        mode: "run",
        selectQueue: ["data", "data:preview"],
        nowIsoString: "2026-03-30T00:00:00.000Z",
        requiredPathQueue: ["fixtures/table.txt"],
        stdoutColumns: 80,
        stdoutIsTTY: true,
      },
      { allowFailure: true },
    );

    const plainStderr = stripAnsi(result.stderr);
    expect(result.error).toContain("Unsupported lightweight data file type: .txt");
    expect(plainStderr).not.toContain("Tip:");
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).not.toContain(
      "confirm:Treat CSV/TSV input as headerless?",
    );
  });

  test("routes data preview in headerless mode for CSV input", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:preview"],
      requiredPathQueue: ["fixtures/table.csv"],
      confirmQueue: [true],
      inputQueue: ["", "", "", ""],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:preview",
        options: {
          input: "fixtures/table.csv",
          rows: undefined,
          offset: undefined,
          columns: undefined,
          contains: undefined,
          noHeader: true,
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose a data command",
      "confirm:Treat CSV/TSV input as headerless?",
      "input:Rows to show (optional)",
      "input:Row offset (optional)",
      "input:Columns to show (comma-separated, optional)",
      "input:Contains filter (column:keyword, optional)",
    ]);
  });

  test("routes parquet preview through its separate interactive prompts", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:parquet-preview"],
      requiredPathQueue: ["fixtures/table.parquet"],
      inputQueue: ["25", "5", "id,status"],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:parquet-preview",
        options: {
          input: "fixtures/table.parquet",
          rows: 25,
          offset: 5,
          columns: ["id", "status"],
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose a data command",
      "input:Rows to show (optional)",
      "input:Row offset (optional)",
      "input:Columns to show (comma-separated, optional)",
    ]);
    expect(result.validationCalls).toEqual([]);
  });
});
