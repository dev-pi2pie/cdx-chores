import { describe, test } from "bun:test";
import { actionDataExtract } from "../../../src/cli/actions/data-extract";
import { createActionTestRuntime, expectCliError } from "../../helpers/cli-action-test-utils";

describe("cli action modules: data extract validation", () => {
  test("actionDataExtract rejects --codex-suggest-shape with --header-row", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();

    await expectCliError(
      () =>
        actionDataExtract(runtime, {
          codexSuggestShape: true,
          headerRow: 7,
          input: "test/data-sources/fixtures/multi.xlsx",
          source: "Summary",
        }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "--codex-suggest-shape cannot be used together with --header-row",
      },
    );

    expectNoOutput();
  });
});
