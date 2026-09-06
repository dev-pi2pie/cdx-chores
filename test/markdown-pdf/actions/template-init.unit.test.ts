import { describe, test } from "bun:test";

import {
  bindPreparedMarkdownPdfTemplateInitDestination,
  prepareMarkdownPdfTemplateInit,
} from "../../../src/cli/markdown-pdf/template/init-service";
import { normalizeMarkdownPdfOptions } from "../../../src/cli/markdown-pdf/validation";
import { createActionTestRuntime, expectCliError } from "../../helpers/cli-action-test-utils";

describe("cli action modules: md to-pdf template init", () => {
  test("does not invent an output directory fallback", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();
    const prepared = prepareMarkdownPdfTemplateInit(normalizeMarkdownPdfOptions());

    await expectCliError(
      () => bindPreparedMarkdownPdfTemplateInitDestination(runtime, prepared, { output: " " }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "Output path is required",
      },
    );

    expectNoOutput();
  });
});
