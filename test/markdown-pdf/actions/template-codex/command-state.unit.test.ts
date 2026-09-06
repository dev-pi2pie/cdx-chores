import { describe, test } from "bun:test";
import { normalizeMdPdfTemplateCodexCommandState } from "../../../../src/cli/markdown-pdf/template-codex";
import { createActionTestRuntime, expectCliError } from "../../../helpers/cli-action-test-utils";

describe("cli action modules: md pdf-template codex command state", () => {
  test("rejects non-local cover image resources before signal collection", async () => {
    const { runtime } = createActionTestRuntime();
    await expectCliError(
      () =>
        normalizeMdPdfTemplateCodexCommandState(runtime, {
          coverImage: "https://example.com/cover.png",
        }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "Cover image must be a local PNG, JPEG, or WebP file.",
      },
    );
  });
});
