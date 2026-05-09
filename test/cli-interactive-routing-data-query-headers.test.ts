import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "./cli-interactive-routing.helpers";

describe("interactive mode routing: data query headers", () => {
  test("accepts all interactive header suggestions and re-inspects before SQL authoring", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "accept", "manual", "table"],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["select id, status from file order by id", "10"],
      confirmQueue: [true, false, true, true],
      dataQueryDetectedFormat: "csv",
      dataQueryHeaderSuggestions: [
        { from: "column_1", to: "id", sample: "1001", inferredType: "BIGINT" },
        { from: "column_2", to: "status", sample: "active", inferredType: "VARCHAR" },
      ],
      dataQueryIntrospectionQueue: [
        {
          columns: [
            { name: "column_1", type: "BIGINT" },
            { name: "column_2", type: "VARCHAR" },
          ],
          sampleRows: [{ column_1: "1001", column_2: "active" }],
          truncated: false,
        },
        {
          columns: [
            { name: "id", type: "BIGINT" },
            { name: "status", type: "VARCHAR" },
          ],
          sampleRows: [{ id: "1001", status: "active" }],
          truncated: false,
        },
      ],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:query:header-suggest",
        options: {
          format: "csv",
          selectedSource: undefined,
        },
      },
      {
        name: "data:query",
        options: {
          headerMappings: [
            { from: "column_1", inferredType: "BIGINT", sample: "1001", to: "id" },
            { from: "column_2", inferredType: "VARCHAR", sample: "active", to: "status" },
          ],
          input: "fixtures/query.csv",
          inputFormat: "csv",
          json: undefined,
          output: undefined,
          overwrite: undefined,
          pretty: undefined,
          rows: 10,
          sql: "select id, status from file order by id",
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "confirm:Review semantic header suggestions before SQL?",
    );
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Header suggestion review",
    );
    expect(result.stdout).toContain("Waiting for Codex header suggestions");
    expect(result.stderr).toContain(
      "Accepted header mappings. Re-inspecting shaped source before SQL authoring.",
    );
  });

  test("supports editing one interactive header suggestion before acceptance", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "edit", "column_2", "accept", "manual", "table"],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["state", "select id, state from file order by id", "10"],
      confirmQueue: [true, false, true, true],
      dataQueryDetectedFormat: "csv",
      dataQueryHeaderSuggestions: [
        { from: "column_1", to: "id", sample: "1001", inferredType: "BIGINT" },
        { from: "column_2", to: "status", sample: "active", inferredType: "VARCHAR" },
      ],
      dataQueryIntrospectionQueue: [
        {
          columns: [
            { name: "column_1", type: "BIGINT" },
            { name: "column_2", type: "VARCHAR" },
          ],
          sampleRows: [{ column_1: "1001", column_2: "active" }],
          truncated: false,
        },
        {
          columns: [
            { name: "id", type: "BIGINT" },
            { name: "state", type: "VARCHAR" },
          ],
          sampleRows: [{ id: "1001", state: "active" }],
          truncated: false,
        },
      ],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:query:header-suggest",
        options: {
          format: "csv",
          selectedSource: undefined,
        },
      },
      {
        name: "data:query",
        options: {
          headerMappings: [
            { from: "column_1", inferredType: "BIGINT", sample: "1001", to: "id" },
            { from: "column_2", inferredType: "VARCHAR", sample: "active", to: "state" },
          ],
          input: "fixtures/query.csv",
          inputFormat: "csv",
          json: undefined,
          output: undefined,
          overwrite: undefined,
          pretty: undefined,
          rows: 10,
          sql: "select id, state from file order by id",
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Choose one mapping to edit",
    );
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "input:Header for column_2",
    );
  });

  test("supports keeping generated names after interactive header suggestions are shown", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "keep", "manual", "table"],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["select column_1, column_2 from file order by column_1", "10"],
      confirmQueue: [true, false, true, true],
      dataQueryDetectedFormat: "csv",
      dataQueryHeaderSuggestions: [
        { from: "column_1", to: "id", sample: "1001", inferredType: "BIGINT" },
        { from: "column_2", to: "status", sample: "active", inferredType: "VARCHAR" },
      ],
      dataQueryIntrospection: {
        columns: [
          { name: "column_1", type: "BIGINT" },
          { name: "column_2", type: "VARCHAR" },
        ],
        sampleRows: [{ column_1: "1001", column_2: "active" }],
        truncated: false,
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:query:header-suggest",
        options: {
          format: "csv",
          selectedSource: undefined,
        },
      },
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
          sql: "select column_1, column_2 from file order by column_1",
        },
      },
    ]);
  });
});
