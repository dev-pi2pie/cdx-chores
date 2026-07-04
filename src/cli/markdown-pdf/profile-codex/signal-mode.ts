import type { MarkdownPdfCodexSignalMode } from "../../../adapters/codex/markdown-pdf-profile/types";

export function classifyMarkdownPdfProfileCodexSignalMode(input: {
  hasBaseProfile: boolean;
  hasFontHints: boolean;
  hasInput: boolean;
  hasIntent: boolean;
}): MarkdownPdfCodexSignalMode {
  const hasTargetSignal = input.hasInput || input.hasIntent || input.hasFontHints;
  if (hasTargetSignal && input.hasBaseProfile) {
    return "mixed-with-base";
  }
  if (input.hasInput) {
    return "document-informed";
  }
  if (input.hasIntent || input.hasFontHints) {
    return "hint-only";
  }
  if (input.hasBaseProfile) {
    return "base-only-deterministic";
  }
  return "basic-default";
}
