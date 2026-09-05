import { describe, test } from "bun:test";
import { actionDataQuery } from "../../../src/cli/actions/data-query";
import { createActionTestRuntime, expectCliError } from "../../helpers/cli-action-test-utils";

describe("cli action modules: data query source and workspace resolution", () => {
  test("actionDataQuery rejects --source together with --relation before query execution", async () => {
    const { runtime } = createActionTestRuntime();

    await expectCliError(
      () =>
        actionDataQuery(runtime, {
          input: "test/data-sources/fixtures/multi.sqlite",
          relations: [{ alias: "entries", source: "time_entries" }],
          source: "users",
          sql: "select * from file",
        }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "--relation cannot be used together with --source",
      },
    );
  });
});
