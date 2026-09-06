import { describe, expect, test } from "bun:test";

import { actionFontCheck } from "../../../src/cli/actions/font-check";
import { createActionTestRuntime, expectCliError } from "../../helpers/cli-action-test-utils";

describe("font CLI check validation", () => {
  test("rejects invalid font check inputs before discovery", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();
    let called = false;
    const runner = async () => {
      called = true;
      return { ok: true, stdout: "", stderr: "" };
    };

    await expectCliError(() => actionFontCheck(runtime, { text: "A", runner }), {
      code: "INVALID_INPUT",
      exitCode: 2,
      messageIncludes: "--family is required for font check",
    });
    await expectCliError(() => actionFontCheck(runtime, { family: "Latin", runner }), {
      code: "INVALID_INPUT",
      exitCode: 2,
      messageIncludes: "requires exactly one of --text or --text-file",
    });
    await expectCliError(
      () => actionFontCheck(runtime, { family: "Latin", text: "A", textFile: "a.txt", runner }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "requires exactly one of --text or --text-file",
      },
    );
    await expectCliError(
      () => actionFontCheck(runtime, { family: "Latin", text: "A", require: "emoji", runner }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "--require must be one of: nerd",
      },
    );
    expect(called).toBe(false);
    expectNoOutput();
  });
});
