import {
  createDirectCodexProgressPresenter,
  type CodexProgressPresenter,
} from "../../actions/codex-progress";
import type { CliRuntime } from "../../types";
import type { MarkdownPdfCodexArtifact } from "./codex-types";

export function markdownPdfInteractiveCodexProgressLabel(
  artifact: MarkdownPdfCodexArtifact,
  lowerLevelLabel: string,
): string {
  if (artifact === "profile") {
    return "Preparing profile with Codex";
  }
  if (artifact === "template-bundle") {
    return "Preparing template bundle with Codex";
  }
  return lowerLevelLabel.toLowerCase().includes("template")
    ? "Preparing project template with Codex"
    : "Preparing project profile with Codex";
}

export function createMarkdownPdfInteractiveCodexProgressPresenter(
  runtime: CliRuntime,
  artifact: MarkdownPdfCodexArtifact,
): CodexProgressPresenter {
  const presenter = createDirectCodexProgressPresenter(runtime.stderr);
  const label = (lowerLevelLabel: string) =>
    markdownPdfInteractiveCodexProgressLabel(artifact, lowerLevelLabel);
  return {
    start: (lowerLevelLabel) => presenter.start(label(lowerLevelLabel)),
    update: (lowerLevelLabel) => presenter.update(label(lowerLevelLabel)),
    stop: (status) => presenter.stop(status),
  };
}
