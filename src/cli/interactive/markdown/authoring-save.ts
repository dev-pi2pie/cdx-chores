import { confirm, select } from "@inquirer/prompts";

import { printLine } from "../../actions/shared";
import { CliError } from "../../errors";
import { promptRequiredPathWithConfig } from "../../prompts/path";
import type { CliRuntime } from "../../types";
import type { InteractivePathPromptContext } from "../shared";
import { MARKDOWN_PDF_ARTIFACT_LABELS, renderFinalRecipeSaveReview } from "./authoring-review";
import {
  bindMarkdownPdfDeterministicRecipeDestination,
  markdownPdfDeterministicOutputFiles,
  markdownPdfDeterministicOutputPath,
  writeBoundMarkdownPdfDeterministicRecipe,
  type PreparedMarkdownPdfDeterministicRecipe,
} from "./deterministic-authoring";

type RecipeSaveNextStep = "change-output" | "review" | "cancel";

const RECOVERABLE_RECIPE_SAVE_CODES = new Set([
  "FILE_READ_ERROR",
  "FILE_WRITE_ERROR",
  "INVALID_INPUT",
  "OUTPUT_EXISTS",
  "OUTPUT_SYMLINK",
]);

async function promptRecipeSaveNextStep(message: string): Promise<RecipeSaveNextStep> {
  return await select<RecipeSaveNextStep>({
    message,
    choices: [
      { name: "Change output", value: "change-output" },
      { name: "Back to recipe review", value: "review" },
      { name: "Cancel", value: "cancel" },
    ],
  });
}

export async function saveMarkdownPdfDeterministicCandidate(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  candidate: PreparedMarkdownPdfDeterministicRecipe,
): Promise<"complete" | "review"> {
  while (true) {
    let next: RecipeSaveNextStep;
    try {
      const output = await promptRequiredPathWithConfig(
        candidate.artifact === "profile" ? "Profile output file" : "Template output directory",
        {
          kind: candidate.artifact === "profile" ? "file" : "directory",
          ...pathPromptContext,
        },
      );
      const overwrite = await confirm({
        message: "Overwrite recipe output if it exists?",
        default: false,
      });
      const bound = await bindMarkdownPdfDeterministicRecipeDestination(runtime, candidate, {
        output,
        overwrite,
      });
      renderFinalRecipeSaveReview(
        runtime,
        candidate,
        markdownPdfDeterministicOutputPath(bound),
        markdownPdfDeterministicOutputFiles(bound),
        overwrite,
      );
      if (
        await confirm({
          message: `Save this ${MARKDOWN_PDF_ARTIFACT_LABELS[candidate.artifact].toLowerCase()}?`,
          default: true,
        })
      ) {
        await writeBoundMarkdownPdfDeterministicRecipe(bound);
        printLine(
          runtime.stdout,
          `Wrote Markdown PDF ${candidate.artifact === "profile" ? "profile" : "template"}: ${markdownPdfDeterministicOutputPath(bound)}`,
        );
        return "complete";
      }
      next = await promptRecipeSaveNextStep("Recipe save next step");
    } catch (error) {
      if (!(error instanceof CliError) || !RECOVERABLE_RECIPE_SAVE_CODES.has(error.code)) {
        throw error;
      }
      printLine(runtime.stderr, `Unable to save recipe: ${error.message}`);
      next = await promptRecipeSaveNextStep("Recipe save recovery");
    }
    if (next === "review") {
      return "review";
    }
    if (next === "cancel") {
      return "complete";
    }
  }
}
