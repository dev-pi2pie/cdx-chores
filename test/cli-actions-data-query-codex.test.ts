import { describe, expect, test } from "bun:test";

import { actionDataQueryCodex } from "../src/cli/actions";
import { inspectDataQueryExtensions } from "../src/cli/duckdb/query";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";

const queryExtensions = await inspectDataQueryExtensions();
const sqliteReady = queryExtensions.available && queryExtensions.sqlite?.loadable === true;

function stripAnsi(text: string): string {
  return text.replace(/\x1B\[[0-9;]*m/g, "");
}

describe("cli action modules: data query codex", () => {
  test("actionDataQueryCodex renders default assistant output", async () => {
    const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();

    await actionDataQueryCodex(runtime, {
      input: "test/fixtures/data-query/basic.csv",
      intent: "show id and name ordered by id",
      runner: async ({ prompt }) => {
        expect(prompt).toContain("User intent: show id and name ordered by id");
        expect(prompt).toContain("Detected format: csv");
        expect(prompt).toContain("1. id: BIGINT");
        expect(prompt).toContain('"name":"Ada"');

        return JSON.stringify({
          sql: "select id, name from file order by id",
          reasoning_summary: "Projects the requested columns and keeps a stable ordering.",
        });
      },
    });

    expectNoStderr();
    expect(stderr.text).toBe("");
    expect(stdout.text).toContain("Intent: show id and name ordered by id");
    expect(stdout.text).toContain("Format: csv");
    expect(stdout.text).toContain("Schema:");
    expect(stdout.text).toContain("- id: BIGINT");
    expect(stdout.text).toContain("Sample Rows:");
    expect(stdout.text).toContain('{"id":"1","name":"Ada","status":"active","created_at":"2026-03-01"}');
    expect(stdout.text).toContain("Codex Summary: Projects the requested columns and keeps a stable ordering.");
    expect(stdout.text).toContain("SQL:\nselect id, name from file order by id");
  });

  test("actionDataQueryCodex prints SQL only with --print-sql", async () => {
    const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();

    await actionDataQueryCodex(runtime, {
      input: "test/fixtures/data-query/basic.csv",
      intent: "show all rows",
      printSql: true,
      runner: async () =>
        JSON.stringify({
          sql: "select\n  *\nfrom file\norder by id",
          reasoning_summary: "Returns the full file table in id order.",
        }),
    });

    expectNoStderr();
    expect(stderr.text).toBe("");
    expect(stdout.text.trim()).toBe("select * from file order by id");
  });

  test("actionDataQueryCodex shows transient tty progress and clears it before final output", async () => {
    const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();
    Object.assign(runtime.stdout as object, { isTTY: true });

    await actionDataQueryCodex(runtime, {
      input: "test/fixtures/data-query/basic.csv",
      intent: "show id and name ordered by id",
      runner: async () =>
        JSON.stringify({
          sql: "select id, name from file order by id",
          reasoning_summary: "Projects the requested columns and keeps a stable ordering.",
        }),
    });

    expectNoStderr();
    expect(stderr.text).toBe("");
    expect(stdout.text).toContain("Introspecting data source...");
    expect(stdout.text).toContain("Thinking");
    expect(stdout.text).toContain("Drafting SQL with Codex");
    expect(stdout.text).toContain("\r\x1b[2K");
    const normalized = stripAnsi(stdout.text);
    expect(normalized).toContain("Intent: show id and name ordered by id");
    expect(normalized).toContain("SQL:\nselect id, name from file order by id");
  });

  test("actionDataQueryCodex requires intent", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();

    await expectCliError(
      () =>
        actionDataQueryCodex(runtime, {
          input: "test/fixtures/data-query/basic.csv",
          intent: "   ",
        }),
      { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "Intent is required." },
    );

    expectNoOutput();
  });

  test("actionDataQueryCodex reports codex unavailability failures clearly", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();

    await expectCliError(
      () =>
        actionDataQueryCodex(runtime, {
          input: "test/fixtures/data-query/basic.csv",
          intent: "show active rows",
          runner: async () => {
            throw new Error("Codex Exec exited with code 1: authentication required");
          },
        }),
      { code: "CODEX_UNAVAILABLE", exitCode: 2, messageIncludes: "Codex drafting unavailable" },
    );

    expectNoOutput();
  });

  test("actionDataQueryCodex reports source ambiguity for SQLite inputs", async () => {
    if (!sqliteReady) {
      return;
    }

    const { runtime, expectNoOutput } = createActionTestRuntime();

    await expectCliError(
      () =>
        actionDataQueryCodex(runtime, {
          input: "test/fixtures/data-query/multi.sqlite",
          intent: "list users",
          runner: async () =>
            JSON.stringify({
              sql: "select id, name from file order by id",
              reasoning_summary: "Uses the selected source.",
            }),
        }),
      { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "--source is required for SQLite" },
    );

    expectNoOutput();
  });
});
