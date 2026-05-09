import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "./cli-interactive-routing.helpers";

describe("interactive mode routing: data preview filters", () => {
  test("routes data preview with a single contains filter from interactive mode", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:preview"],
      requiredPathQueue: ["fixtures/table.csv"],
      confirmQueue: [false, false],
      inputQueue: ["", "", "", "status:active"],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:preview",
        options: {
          input: "fixtures/table.csv",
          rows: undefined,
          offset: undefined,
          columns: undefined,
          contains: ["status:active"],
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
      "confirm:Add another contains filter?",
    ]);
    expect(result.validationCalls).toEqual([]);
  });

  test("routes data preview with repeated contains filters from interactive mode", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:preview"],
      requiredPathQueue: ["fixtures/table.json"],
      inputQueue: ["", "", "", "status:active", "region:tw"],
      confirmQueue: [true, false],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:preview",
        options: {
          input: "fixtures/table.json",
          rows: undefined,
          offset: undefined,
          columns: undefined,
          contains: ["status:active", "region:tw"],
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose a data command",
      "input:Rows to show (optional)",
      "input:Row offset (optional)",
      "input:Columns to show (comma-separated, optional)",
      "input:Contains filter (column:keyword, optional)",
      "confirm:Add another contains filter?",
      "input:Another contains filter (column:keyword)",
      "confirm:Add another contains filter?",
    ]);
    expect(result.validationCalls).toEqual([]);
  });

  test("re-prompts malformed contains syntax locally before running data preview", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:preview"],
      requiredPathQueue: ["fixtures/table.csv"],
      confirmQueue: [false, false],
      inputQueue: ["", "", "", "status", "status:active"],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:preview",
        options: {
          input: "fixtures/table.csv",
          rows: undefined,
          offset: undefined,
          columns: undefined,
          contains: ["status:active"],
        },
      },
    ]);
    expect(result.validationCalls).toContainEqual({
      kind: "input",
      message: "Contains filter (column:keyword, optional)",
      value: "status",
      error: "Invalid --contains value \"status\": missing ':' separator.",
    });
  });

  test("re-prompts unknown contains columns locally before running data preview", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:preview"],
      requiredPathQueue: ["fixtures/table.csv"],
      inputQueue: ["", "", "", "owner:ada", "status:active"],
      confirmQueue: [false, false],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:preview",
        options: {
          input: "fixtures/table.csv",
          rows: undefined,
          offset: undefined,
          columns: undefined,
          contains: ["status:active"],
        },
      },
    ]);
    expect(result.validationCalls).toContainEqual({
      kind: "input",
      message: "Contains filter (column:keyword, optional)",
      value: "owner:ada",
      error: "Unknown columns: owner",
    });
  });
});
