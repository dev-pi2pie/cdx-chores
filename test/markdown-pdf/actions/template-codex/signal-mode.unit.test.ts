import { describe, expect, test } from "bun:test";

import {
  assertUsableMdPdfTemplateCodexSignalMode,
  classifyMdPdfTemplateCodexSignalMode,
} from "../../../../src/cli/markdown-pdf/template-codex";
import { expectCliError } from "../../../helpers/cli-action-test-utils";

describe("cli action modules: md pdf-template codex signal mode", () => {
  test("classifies the Phase 2 signal ladder", () => {
    expect(
      classifyMdPdfTemplateCodexSignalMode({
        hasBaseProfile: false,
        hasCoverImage: false,
        hasInput: false,
        hasIntent: false,
        hasFontHints: false,
        hasRecipeFlags: false,
        hasUsableTemplateCandidate: true,
      }),
    ).toBe("low-signal");
    expect(
      classifyMdPdfTemplateCodexSignalMode({
        hasBaseProfile: true,
        hasCoverImage: false,
        hasInput: false,
        hasIntent: false,
        hasFontHints: false,
        hasRecipeFlags: false,
        hasUsableTemplateCandidate: true,
      }),
    ).toBe("base-profile-only");
    expect(
      classifyMdPdfTemplateCodexSignalMode({
        hasBaseProfile: false,
        hasCoverImage: false,
        hasInput: false,
        hasIntent: false,
        hasFontHints: false,
        hasRecipeFlags: true,
        hasUsableTemplateCandidate: true,
      }),
    ).toBe("recipe-only");
    expect(
      classifyMdPdfTemplateCodexSignalMode({
        hasBaseProfile: false,
        hasCoverImage: true,
        hasInput: false,
        hasIntent: false,
        hasFontHints: false,
        hasRecipeFlags: false,
        hasUsableTemplateCandidate: true,
      }),
    ).toBe("cover-image-only");
    expect(
      classifyMdPdfTemplateCodexSignalMode({
        hasBaseProfile: true,
        hasCoverImage: true,
        hasInput: false,
        hasIntent: false,
        hasFontHints: false,
        hasRecipeFlags: false,
        hasUsableTemplateCandidate: true,
      }),
    ).toBe("deterministic");
    expect(
      classifyMdPdfTemplateCodexSignalMode({
        hasBaseProfile: false,
        hasCoverImage: false,
        hasInput: true,
        hasIntent: false,
        hasFontHints: false,
        hasRecipeFlags: false,
        hasUsableTemplateCandidate: true,
      }),
    ).toBe("codex-assisted");
    expect(
      classifyMdPdfTemplateCodexSignalMode({
        hasBaseProfile: false,
        hasCoverImage: false,
        hasInput: false,
        hasIntent: false,
        hasFontHints: true,
        hasRecipeFlags: false,
        hasUsableTemplateCandidate: true,
      }),
    ).toBe("codex-assisted");
    expect(
      classifyMdPdfTemplateCodexSignalMode({
        hasBaseProfile: false,
        hasCoverImage: true,
        hasInput: false,
        hasIntent: false,
        hasFontHints: true,
        hasRecipeFlags: false,
        hasUsableTemplateCandidate: true,
      }),
    ).toBe("codex-assisted");
    expect(
      classifyMdPdfTemplateCodexSignalMode({
        hasBaseProfile: false,
        hasCoverImage: true,
        hasInput: false,
        hasIntent: true,
        hasFontHints: false,
        hasRecipeFlags: false,
        hasUsableTemplateCandidate: true,
      }),
    ).toBe("codex-assisted");
    expect(
      classifyMdPdfTemplateCodexSignalMode({
        hasBaseProfile: false,
        hasCoverImage: false,
        hasInput: true,
        hasIntent: false,
        hasFontHints: false,
        hasRecipeFlags: false,
        hasUsableTemplateCandidate: false,
      }),
    ).toBe("no-usable-template");
    expect(
      classifyMdPdfTemplateCodexSignalMode({
        hasBaseProfile: true,
        hasCoverImage: false,
        hasInput: true,
        hasIntent: false,
        hasFontHints: false,
        hasRecipeFlags: false,
        hasUsableTemplateCandidate: true,
      }),
    ).toBe("codex-assisted");
    expect(
      classifyMdPdfTemplateCodexSignalMode({
        hasBaseProfile: false,
        hasCoverImage: false,
        hasInput: false,
        hasIntent: true,
        hasFontHints: false,
        hasRecipeFlags: true,
        hasUsableTemplateCandidate: true,
      }),
    ).toBe("codex-assisted");
    expect(
      classifyMdPdfTemplateCodexSignalMode({
        hasBaseProfile: true,
        hasCoverImage: true,
        hasInput: true,
        hasIntent: true,
        hasFontHints: false,
        hasRecipeFlags: true,
        hasUsableTemplateCandidate: false,
      }),
    ).toBe("no-usable-template");
  });

  test("rejects no-usable-template as a distinct failure mode", async () => {
    await expectCliError(
      async () => assertUsableMdPdfTemplateCodexSignalMode("no-usable-template"),
      {
        code: "NO_USABLE_TEMPLATE",
        exitCode: 1,
        messageIncludes: "No usable Markdown PDF template path",
      },
    );
  });
});
