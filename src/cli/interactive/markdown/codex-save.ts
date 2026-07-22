import { confirm, select } from "@inquirer/prompts";

import { displayPath, printLine } from "../../actions/shared";
import { CliError } from "../../errors";
import { promptRequiredPathWithConfig } from "../../prompts/path";
import type { CliRuntime } from "../../types";
import type { InteractivePathPromptContext } from "../shared";
import { MARKDOWN_PDF_CODEX_ARTIFACT_LABELS } from "./codex-review";
import {
  bindMarkdownPdfCodexCandidate,
  boundMarkdownPdfCodexOutputFiles,
  boundMarkdownPdfCodexOutputPath,
  suggestedMarkdownPdfCodexOutputPath,
  writeBoundMarkdownPdfCodexCandidate,
} from "./codex-service";
import type {
  MarkdownPdfCodexReportRetention,
  MarkdownPdfSavedRecipe,
  PreparedMarkdownPdfCodexCandidate,
} from "./codex-types";

type SaveNextStep = "change-output" | "review" | "cancel";

const RECOVERABLE_SAVE_CODES = new Set([
  "FILE_READ_ERROR",
  "FILE_WRITE_ERROR",
  "INVALID_INPUT",
  "OUTPUT_EXISTS",
  "OUTPUT_SYMLINK",
]);

async function promptSaveNextStep(message: string): Promise<SaveNextStep> {
  return await select<SaveNextStep>({
    message,
    choices: [
      { name: "Change output", value: "change-output" },
      { name: "Back to recipe review", value: "review" },
      { name: "Cancel", value: "cancel" },
    ],
  });
}

async function promptOutput(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  candidate: PreparedMarkdownPdfCodexCandidate,
): Promise<string> {
  const suggested =
    candidate.setup.outputPreference ?? suggestedMarkdownPdfCodexOutputPath(candidate);
  const choice = await select<"suggested" | "custom">({
    message: `${MARKDOWN_PDF_CODEX_ARTIFACT_LABELS[candidate.artifact]} output destination`,
    choices: [
      {
        name: candidate.setup.outputPreference ? "Use setup output" : "Use generated output",
        value: "suggested",
        description: displayPath(runtime, suggested),
      },
      { name: "Custom output", value: "custom", description: "Choose another destination" },
    ],
  });
  if (choice === "suggested") {
    return suggested;
  }
  return await promptRequiredPathWithConfig(
    candidate.artifact === "profile" ? "Profile output file" : "Bundle output directory",
    {
      kind: candidate.artifact === "profile" ? "file" : "directory",
      ...pathPromptContext,
    },
  );
}

function renderFinalReview(
  runtime: CliRuntime,
  candidate: PreparedMarkdownPdfCodexCandidate,
  outputPath: string,
  outputFiles: readonly string[],
  overwrite: boolean,
  report: MarkdownPdfCodexReportRetention,
): void {
  printLine(runtime.stderr, "Final recipe save review");
  printLine(runtime.stderr, "");
  printLine(runtime.stderr, `Artifact: ${MARKDOWN_PDF_CODEX_ARTIFACT_LABELS[candidate.artifact]}`);
  printLine(runtime.stderr, `Output: ${displayPath(runtime, outputPath)}`);
  printLine(runtime.stderr, `Codex report: ${report.kind}`);
  printLine(runtime.stderr, `Overwrite: ${overwrite ? "enabled" : "disabled"}`);
  printLine(runtime.stderr, "Files:");
  for (const file of outputFiles) {
    printLine(runtime.stderr, `- ${displayPath(runtime, file)}`);
  }
}

export async function saveMarkdownPdfCodexCandidate(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  candidate: PreparedMarkdownPdfCodexCandidate,
  report: MarkdownPdfCodexReportRetention,
): Promise<
  { kind: "saved"; saved: MarkdownPdfSavedRecipe } | { kind: "review" } | { kind: "cancel" }
> {
  while (true) {
    let next: SaveNextStep;
    try {
      const output = await promptOutput(runtime, pathPromptContext, candidate);
      const overwrite = await confirm({
        message: "Overwrite recipe output if it exists?",
        default: false,
      });
      const bound = await bindMarkdownPdfCodexCandidate(runtime, candidate, {
        output,
        overwrite,
        report,
      });
      const outputPath = boundMarkdownPdfCodexOutputPath(bound);
      renderFinalReview(
        runtime,
        candidate,
        outputPath,
        boundMarkdownPdfCodexOutputFiles(bound),
        overwrite,
        report,
      );
      if (
        await confirm({
          message: `Save this ${MARKDOWN_PDF_CODEX_ARTIFACT_LABELS[candidate.artifact].toLowerCase()}?`,
          default: true,
        })
      ) {
        await writeBoundMarkdownPdfCodexCandidate(runtime, bound);
        printLine(
          runtime.stdout,
          `Wrote Markdown PDF ${candidate.artifact === "profile" ? "profile" : "bundle"}: ${displayPath(runtime, outputPath)}`,
        );
        return {
          kind: "saved",
          saved: {
            artifact: candidate.artifact,
            kind: "saved-recipe",
            outputPath,
            rendererSource:
              candidate.artifact === "profile" ? "existing-profile" : "existing-bundle",
            sample: candidate.setup.sample,
          },
        };
      }
      next = await promptSaveNextStep("Recipe save next step");
    } catch (error) {
      if (!(error instanceof CliError) || !RECOVERABLE_SAVE_CODES.has(error.code)) {
        throw error;
      }
      printLine(runtime.stderr, `Unable to save recipe: ${error.message}`);
      next = await promptSaveNextStep("Recipe save recovery");
    }
    if (next === "review") {
      return { kind: "review" };
    }
    if (next === "cancel") {
      return { kind: "cancel" };
    }
  }
}
