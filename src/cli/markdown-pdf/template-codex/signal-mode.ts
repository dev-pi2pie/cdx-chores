import { CliError } from "../../errors";
import type { MarkdownPdfTemplateCodexSignalMode } from "./types";

export interface ClassifyMdPdfTemplateCodexSignalModeInput {
  hasBaseProfile: boolean;
  hasCoverImage: boolean;
  hasInput: boolean;
  hasIntent: boolean;
  hasRecipeFlags: boolean;
  hasUsableTemplateCandidate?: boolean;
}

export function classifyMdPdfTemplateCodexSignalMode(
  input: ClassifyMdPdfTemplateCodexSignalModeInput,
): MarkdownPdfTemplateCodexSignalMode {
  if (input.hasUsableTemplateCandidate === false) {
    return "no-usable-template";
  }
  if (input.hasInput || input.hasIntent) {
    return "codex-assisted";
  }

  const deterministicSignals = [
    input.hasBaseProfile,
    input.hasCoverImage,
    input.hasRecipeFlags,
  ].filter(Boolean).length;

  if (deterministicSignals === 0) {
    return "low-signal";
  }
  if (deterministicSignals > 1) {
    return "deterministic";
  }
  if (input.hasBaseProfile) {
    return "base-profile-only";
  }
  if (input.hasCoverImage) {
    return "cover-image-only";
  }
  return "recipe-only";
}

export function assertUsableMdPdfTemplateCodexSignalMode(
  signalMode: MarkdownPdfTemplateCodexSignalMode,
): void {
  if (signalMode !== "low-signal" && signalMode !== "no-usable-template") {
    return;
  }
  if (signalMode === "no-usable-template") {
    throw new CliError(
      "No usable Markdown PDF template path is available for the provided signals.",
      {
        code: "NO_USABLE_TEMPLATE",
        exitCode: 1,
      },
    );
  }
  throw new CliError(
    "Not enough signal to create a Codex-assisted Markdown PDF template. Provide Markdown input, --intent, --base-profile, --cover-image, or recipe flags; for defaults use md pdf-template init.",
    {
      code: "LOW_SIGNAL",
      exitCode: 2,
    },
  );
}
