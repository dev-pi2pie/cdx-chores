import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "./cli-interactive-routing.helpers";

describe("interactive mode routing: data query Codex workspace", () => {
  test("routes Codex Assistant through workspace drafting in interactive query", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "workspace", "Codex Assistant", "json"],
      checkboxQueue: [["users", "active_users"]],
      requiredPathQueue: ["fixtures/query.sqlite"],
      confirmQueue: [true, false, true, false],
      inputQueue: ["users", "active", "join users with active users"],
      dataQueryDetectedFormat: "sqlite",
      dataQuerySources: ["users", "active_users"],
      dataQueryCodexDraft: {
        sql: "select users.id, active.name from users join active on users.id = active.id order by users.id",
        reasoningSummary: "Joins the two workspace relations on id.",
      },
      dataQueryWorkspaceIntrospection: {
        relations: [
          {
            alias: "users",
            columns: [
              { name: "id", type: "BIGINT" },
              { name: "name", type: "VARCHAR" },
            ],
            sampleRows: [{ id: "1", name: "Ada" }],
            source: "users",
            truncated: false,
          },
          {
            alias: "active",
            columns: [
              { name: "id", type: "BIGINT" },
              { name: "is_active", type: "BOOLEAN" },
            ],
            sampleRows: [{ id: "1", is_active: "true" }],
            source: "active_users",
            truncated: false,
          },
        ],
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:query:codex-draft",
        options: {
          format: "sqlite",
          intent: "join users with active users",
          relations: [
            {
              alias: "users",
              columns: [
                { name: "id", type: "BIGINT" },
                { name: "name", type: "VARCHAR" },
              ],
              sampleRows: [{ id: "1", name: "Ada" }],
              source: "users",
              truncated: false,
            },
            {
              alias: "active",
              columns: [
                { name: "id", type: "BIGINT" },
                { name: "is_active", type: "BOOLEAN" },
              ],
              sampleRows: [{ id: "1", is_active: "true" }],
              source: "active_users",
              truncated: false,
            },
          ],
        },
      },
      {
        name: "data:query",
        options: {
          input: "fixtures/query.sqlite",
          inputFormat: "sqlite",
          json: true,
          output: undefined,
          overwrite: undefined,
          pretty: false,
          relations: [
            { alias: "users", source: "users" },
            { alias: "active", source: "active_users" },
          ],
          rows: undefined,
          sql: "select users.id, active.name from users join active on users.id = active.id order by users.id",
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).not.toContain(
      "select:Choose a SQLite source",
    );
  });

  test("supports workspace regenerate from codex sql review", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "workspace", "Codex Assistant", "regenerate", "table"],
      checkboxQueue: [["users", "active_users"]],
      requiredPathQueue: ["fixtures/query.sqlite"],
      confirmQueue: [true, false, false, true],
      inputQueue: ["users", "active", "join users with active users", "10"],
      dataQueryDetectedFormat: "sqlite",
      dataQuerySources: ["users", "active_users"],
      dataQueryCodexDraft: {
        sql: "select users.id, active.name from users join active on users.id = active.id order by users.id",
        reasoningSummary: "Joins the two workspace relations on id.",
      },
    });

    expect(
      result.actionCalls.filter((call) => call.name === "data:query:codex-draft"),
    ).toHaveLength(2);
    expect(result.actionCalls).toContainEqual({
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
    });
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:SQL review next step",
    );
  });

  test("supports workspace change-mode from codex review back to manual mode", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:query",
        "workspace",
        "Codex Assistant",
        "change-mode",
        "manual",
        "table",
      ],
      checkboxQueue: [["users", "active_users"]],
      requiredPathQueue: ["fixtures/query.sqlite"],
      confirmQueue: [true, false, false, true],
      inputQueue: [
        "users",
        "active",
        "join users with active users",
        "select users.id, active.name from users join active on users.id = active.id order by users.id",
        "10",
      ],
      dataQueryDetectedFormat: "sqlite",
      dataQuerySources: ["users", "active_users"],
      dataQueryCodexDraft: {
        sql: "select users.id, active.name from users join active on users.id = active.id order by users.id",
        reasoningSummary: "Joins the two workspace relations on id.",
      },
    });

    expect(
      result.promptCalls.filter((call) => call.kind === "select" && call.message === "Choose mode"),
    ).toHaveLength(2);
    expect(
      result.actionCalls.filter((call) => call.name === "data:query:codex-draft"),
    ).toHaveLength(1);
    expect(result.actionCalls).toContainEqual({
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
    });
  });

  test("supports workspace cancel from codex sql review without executing the query", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "workspace", "Codex Assistant", "cancel"],
      checkboxQueue: [["users", "active_users"]],
      requiredPathQueue: ["fixtures/query.sqlite"],
      confirmQueue: [true, false, false],
      inputQueue: ["users", "active", "join users with active users"],
      dataQueryDetectedFormat: "sqlite",
      dataQuerySources: ["users", "active_users"],
      dataQueryCodexDraft: {
        sql: "select users.id, active.name from users join active on users.id = active.id order by users.id",
        reasoningSummary: "Joins the two workspace relations on id.",
      },
    });

    expect(
      result.actionCalls.filter((call) => call.name === "data:query:codex-draft"),
    ).toHaveLength(1);
    expect(result.actionCalls.filter((call) => call.name === "data:query")).toHaveLength(0);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:SQL review next step",
    );
  });

  test("reopens workspace codex intent entry when sql review chooses revise", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "workspace", "Codex Assistant", "revise", "table"],
      checkboxQueue: [["users", "active_users"]],
      requiredPathQueue: ["fixtures/query.sqlite"],
      confirmQueue: [true, false, false, false, true],
      inputQueue: [
        "users",
        "active",
        "join users with active users",
        "join active users by id",
        "10",
      ],
      dataQueryDetectedFormat: "sqlite",
      dataQuerySources: ["users", "active_users"],
      dataQueryCodexDraft: {
        sql: "select users.id, active.name from users join active on users.id = active.id order by users.id",
        reasoningSummary: "Joins the two workspace relations on id.",
      },
    });

    expect(
      result.actionCalls.filter((call) => call.name === "data:query:codex-draft"),
    ).toHaveLength(2);
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "input" && call.message === "Describe the query intent:",
      ),
    ).toHaveLength(2);
    expect(result.actionCalls).toContainEqual({
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
    });
  });
});
