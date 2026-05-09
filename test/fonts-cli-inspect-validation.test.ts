import { describe, expect, test } from "bun:test";

import { actionFontInspect } from "../src/cli/actions";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";

describe("font CLI inspect validation", () => {
  test("rejects font inspect without a family before discovery", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();
    let called = false;

    await expectCliError(
      () =>
        actionFontInspect(runtime, {
          runner: async () => {
            called = true;
            return { ok: true, stdout: "", stderr: "" };
          },
        }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "--family is required for font inspect",
      },
    );

    expect(called).toBe(false);
    expectNoOutput();
  });

  test("rejects font inspect with a blank family before discovery", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();
    let called = false;

    await expectCliError(
      () =>
        actionFontInspect(runtime, {
          family: "   ",
          runner: async () => {
            called = true;
            return { ok: true, stdout: "", stderr: "" };
          },
        }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "--family is required for font inspect",
      },
    );

    expect(called).toBe(false);
    expectNoOutput();
  });
});
