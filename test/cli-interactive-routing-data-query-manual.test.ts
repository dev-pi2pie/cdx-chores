import { describe, expect, test } from "bun:test";

import { runInteractiveHarness, stripAnsi } from "./cli-interactive-routing.helpers";

describe("interactive mode routing: data query manual", () => {
  test("routes interactive data query manual mode through shared query execution", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "single-source", "users", "manual", "table"],
      nowIsoString: "2026-03-30T00:00:00.300Z",
      stdoutColumns: 80,
      stdoutIsTTY: true,
      requiredPathQueue: ["fixtures/query.sqlite"],
      inputQueue: ["select id, name from file order by id", "10"],
      confirmQueue: [true, true],
      dataQueryDetectedFormat: "sqlite",
      dataQuerySources: ["users", "active_users"],
      dataQueryIntrospection: {
        columns: [
          { name: "id", type: "BIGINT" },
          { name: "name", type: "VARCHAR" },
        ],
        sampleRows: [{ id: "1", name: "Ada" }],
        selectedSource: "users",
        truncated: false,
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:query",
        options: {
          input: "fixtures/query.sqlite",
          inputFormat: "sqlite",
          json: undefined,
          output: undefined,
          overwrite: undefined,
          pretty: undefined,
          rows: 10,
          source: "users",
          sql: "select id, name from file order by id",
        },
      },
    ]);
    const plainStderr = stripAnsi(result.stderr);
    expect(plainStderr).toContain("Tip: Manual is best for joins or custom SQL.");
    expect(plainStderr.match(/Tip:/g) ?? []).toHaveLength(1);
    expect(plainStderr.trimStart().startsWith("Tip: Manual is best for joins or custom SQL.")).toBe(
      true,
    );
    expect(plainStderr.indexOf("Tip: Manual is best for joins or custom SQL.")).toBeLessThan(
      plainStderr.indexOf("Input:"),
    );
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose a data command",
      "confirm:Use detected input format: sqlite?",
      "select:Choose query scope",
      "select:Choose a SQLite source",
      "select:Choose mode",
      "input:SQL query",
      "confirm:Execute this SQL?",
      "select:Output mode",
      "input:Rows to show (optional)",
    ]);
  });

  test("routes interactive data query workspace manual mode through shared query execution", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "workspace", "manual", "table"],
      checkboxQueue: [["users", "active_users"]],
      requiredPathQueue: ["fixtures/query.sqlite"],
      inputQueue: [
        "users",
        "active",
        "select users.id, active.name from users join active on users.id = active.id order by users.id",
        "10",
      ],
      confirmQueue: [true, true],
      dataQueryDetectedFormat: "sqlite",
      dataQuerySources: ["users", "active_users"],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:query",
        options: {
          input: "fixtures/query.sqlite",
          inputFormat: "sqlite",
          json: undefined,
          output: undefined,
          overwrite: undefined,
          pretty: undefined,
          relations: [
            { alias: "users", source: "users" },
            { alias: "active", source: "active_users" },
          ],
          rows: 10,
          sql: "select users.id, active.name from users join active on users.id = active.id order by users.id",
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Choose query scope",
    );
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "checkbox:Choose SQLite relations for the workspace",
    );
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "input:Relation name for users",
    );
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "input:Relation name for active_users",
    );
    expect(result.stderr).toContain("Workspace relations: users, active");
  });

  test("routes interactive DuckDB workspace manual mode through shared query execution", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "workspace", "manual", "table"],
      checkboxQueue: [["users", "analytics.events"]],
      requiredPathQueue: ["fixtures/query.duckdb"],
      inputQueue: [
        "users",
        "events",
        "select users.id, events.event_type from users join events on users.id = events.user_id order by events.id",
        "10",
      ],
      confirmQueue: [true, true],
      dataQueryDetectedFormat: "duckdb",
      dataQuerySources: ["users", "time_entries", "file", "analytics.events"],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:query",
        options: {
          input: "fixtures/query.duckdb",
          inputFormat: "duckdb",
          json: undefined,
          output: undefined,
          overwrite: undefined,
          pretty: undefined,
          relations: [
            { alias: "users", source: "users" },
            { alias: "events", source: "analytics.events" },
          ],
          rows: 10,
          sql: "select users.id, events.event_type from users join events on users.id = events.user_id order by events.id",
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "checkbox:Choose DuckDB relations for the workspace",
    );
    expect(result.stderr).toContain("Workspace relations: users, events");
  });

  test("routes interactive DuckDB single-source manual mode through shared query execution", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "single-source", "analytics.events", "manual", "table"],
      nowIsoString: "2026-03-30T00:00:00.300Z",
      stdoutColumns: 80,
      stdoutIsTTY: true,
      requiredPathQueue: ["fixtures/query.duckdb"],
      inputQueue: ["select id, event_type from file order by id", "10"],
      confirmQueue: [true, true],
      dataQueryDetectedFormat: "duckdb",
      dataQuerySources: ["users", "time_entries", "file", "analytics.events"],
      dataQueryIntrospection: {
        columns: [
          { name: "id", type: "INTEGER" },
          { name: "user_id", type: "INTEGER" },
          { name: "event_type", type: "VARCHAR" },
        ],
        sampleRows: [{ event_type: "login", id: "10", user_id: "1" }],
        selectedSource: "analytics.events",
        truncated: false,
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:query",
        options: {
          input: "fixtures/query.duckdb",
          inputFormat: "duckdb",
          json: undefined,
          output: undefined,
          overwrite: undefined,
          pretty: undefined,
          rows: 10,
          source: "analytics.events",
          sql: "select id, event_type from file order by id",
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Choose a DuckDB source",
    );
  });
});
