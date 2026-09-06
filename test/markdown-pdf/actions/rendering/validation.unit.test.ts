import { describe, expect, test } from "bun:test";

import { actionMdToPdf } from "../../../../src/cli/actions/markdown/to-pdf";
import { createPdfRunner } from "./render-support";
import { createActionTestRuntime, expectCliError } from "../../../helpers/cli-action-test-utils";

describe("cli action modules: md to-pdf validation", () => {
  test("rejects empty bundle values before dependency execution", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();
    const { calls, runner } = createPdfRunner({ html: "<html><body></body></html>" });

    await expectCliError(
      () => actionMdToPdf(runtime, { input: "report.md", bundle: "   ", runner }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "Bundle directory is required.",
      },
    );

    expect(calls).toHaveLength(0);
    expectNoOutput();
  });
});
