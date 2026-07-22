import { describe, expect, test } from "bun:test";

import { markdownPdfInteractiveCodexProgressLabel } from "../../src/cli/interactive/markdown/codex-progress";

describe("Markdown PDF Interactive Codex progress labels", () => {
  test("uses artifact-specific labels", () => {
    expect(markdownPdfInteractiveCodexProgressLabel("profile", "lower-level profile label")).toBe(
      "Preparing profile with Codex",
    );
    expect(
      markdownPdfInteractiveCodexProgressLabel("template-bundle", "lower-level template label"),
    ).toBe("Preparing template bundle with Codex");
  });

  test("keeps one project status while updating the current stage", () => {
    expect(
      markdownPdfInteractiveCodexProgressLabel(
        "project-bundle",
        "Requesting Codex Markdown PDF project profile recommendation",
      ),
    ).toBe("Preparing project profile with Codex");
    expect(
      markdownPdfInteractiveCodexProgressLabel(
        "project-bundle",
        "Requesting Codex Markdown PDF project template recommendation",
      ),
    ).toBe("Preparing project template with Codex");
  });
});
