import { describe, test } from "bun:test";
import { actionDataQueryCodex } from "../../../src/cli/actions/data-query-codex";
import { createActionTestRuntime, expectCliError } from "../../helpers/cli-action-test-utils";

describe("cli action modules: data query codex validation", () => {
  test("actionDataQueryCodex requires intent", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();

    await expectCliError(
      () =>
        actionDataQueryCodex(runtime, {
          input: "test/data-sources/fixtures/basic.csv",
          intent: "   ",
        }),
      { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "Intent is required." },
    );

    expectNoOutput();
  });

  test("actionDataQueryCodex rejects --relation together with --source", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();

    await expectCliError(
      () =>
        actionDataQueryCodex(runtime, {
          input: "test/data-sources/fixtures/multi.sqlite",
          intent: "list users",
          relations: [{ alias: "users", source: "users" }],
          source: "users",
        }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "--relation cannot be used together with --source",
      },
    );

    expectNoOutput();
  });
});
