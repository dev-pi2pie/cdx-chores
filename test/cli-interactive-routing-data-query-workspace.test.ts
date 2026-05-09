import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "./cli-interactive-routing.helpers";

describe("interactive mode routing: data query workspace", () => {
  test("accepts explicit file workspace aliases without re-prompting", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "workspace", "manual", "table"],
      checkboxQueue: [["file"]],
      requiredPathQueue: ["fixtures/query.duckdb"],
      inputQueue: ["file", "select user_id from file order by user_id", "10"],
      confirmQueue: [true, true],
      dataQueryDetectedFormat: "duckdb",
      dataQuerySources: ["users", "time_entries", "file", "analytics.events"],
    });

    expect(
      result.validationCalls.some(
        (call) =>
          call.kind === "input" &&
          call.message === "Relation name for file" &&
          call.value === "file",
      ),
    ).toBe(false);
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
          relations: [{ alias: "file", source: "file" }],
          rows: 10,
          sql: "select user_id from file order by user_id",
        },
      },
    ]);
  });

  test("re-prompts invalid and duplicate workspace aliases before continuing", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "workspace", "manual", "cancel"],
      checkboxQueue: [["users", "active_users"]],
      requiredPathQueue: ["fixtures/query.sqlite"],
      inputQueue: [
        "1users",
        "users",
        "users",
        "active",
        "select users.id from users order by users.id",
      ],
      confirmQueue: [true, false],
      dataQueryDetectedFormat: "sqlite",
      dataQuerySources: ["users", "active_users"],
    });

    expect(result.validationCalls).toContainEqual({
      kind: "input",
      message: "Relation name for users",
      value: "1users",
      error:
        "Use a simple SQL identifier (letters, numbers, underscore; cannot start with a number).",
    });
    expect(result.validationCalls).toContainEqual({
      kind: "input",
      message: "Relation name for active_users",
      value: "users",
      error: "Relation name already used: users.",
    });
    expect(result.actionCalls).toEqual([]);
  });

  test("supports workspace change-mode from manual review into Codex Assistant", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:query",
        "workspace",
        "manual",
        "change-mode",
        "Codex Assistant",
        "json",
      ],
      checkboxQueue: [["users", "active_users"]],
      requiredPathQueue: ["fixtures/query.sqlite"],
      confirmQueue: [true, false, false, true, false],
      inputQueue: [
        "users",
        "active",
        "select users.id from users order by users.id",
        "join users with active users",
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
      result.promptCalls.filter(
        (call) =>
          call.kind === "checkbox" && call.message === "Choose SQLite relations for the workspace",
      ),
    ).toHaveLength(1);
    expect(result.actionCalls).toContainEqual({
      name: "data:query:codex-draft",
      options: {
        format: "sqlite",
        intent: "join users with active users",
        relations: [
          expect.objectContaining({ alias: "users", source: "users" }),
          expect.objectContaining({ alias: "active", source: "active_users" }),
        ],
      },
    });
    expect(result.actionCalls).toContainEqual({
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
    });
  });
});
