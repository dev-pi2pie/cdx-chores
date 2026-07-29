import { describe, expect, test } from "bun:test";

import {
  createMarkdownPdfInteractiveCodexProgressPresenter,
  markdownPdfInteractiveCodexProgressLabel,
} from "../../src/cli/interactive/markdown/codex-progress";
import { createCapturedRuntime } from "../helpers/cli-test-utils";

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

  test("updates and clears one TTY project status without exposing lower-level labels", () => {
    const { runtime, stderr } = createCapturedRuntime();
    (runtime.stderr as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = true;
    const presenter = createMarkdownPdfInteractiveCodexProgressPresenter(runtime, "project-bundle");

    presenter.start("Requesting Codex Markdown PDF project profile recommendation");
    presenter.update("Requesting Codex Markdown PDF project template recommendation");
    presenter.stop("done");

    expect(stderr.text).toContain("Preparing project profile with Codex... -");
    expect(stderr.text).toContain("Preparing project template with Codex... \\");
    expect(stderr.text).toContain("Preparing project template with Codex... done\n");
    expect(stderr.text).not.toContain("Requesting Codex");
  });

  test("prints stable non-TTY stage lines without animation control codes", () => {
    const { runtime, stderr } = createCapturedRuntime();
    const presenter = createMarkdownPdfInteractiveCodexProgressPresenter(runtime, "project-bundle");

    presenter.start("Requesting Codex Markdown PDF project profile recommendation");
    presenter.update("Requesting Codex Markdown PDF project template recommendation");
    presenter.stop("done");

    expect(stderr.text).toBe(
      "Preparing project profile with Codex...\nPreparing project template with Codex...\n",
    );
    expect(stderr.text).not.toContain("\u001b[");
  });
});
