import { describe, test } from "bun:test";
import { actionDataQuery } from "../../../src/cli/actions/data-query";
import { createActionTestRuntime, expectCliError } from "../../helpers/cli-action-test-utils";

describe("cli action modules: data query artifact validation", () => {
  test("actionDataQuery rejects explicit shape flags when --source-shape is provided", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();

    await expectCliError(
      () =>
        actionDataQuery(runtime, {
          input: "test/data-sources/fixtures/multi.xlsx",
          range: "A1:B3",
          sourceShape: "shape.json",
          sql: "select * from file",
        }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "--source-shape cannot be used together with --range",
      },
    );

    expectNoOutput();
  });
});
