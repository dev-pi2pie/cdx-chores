import { select } from "@inquirer/prompts";

import type { CliRuntime } from "../../types";
import type { InteractiveNavigationOutcome, InteractivePathPromptContext } from "../shared";
import { runMarkdownPdfAuthoring } from "./authoring";
import { MARKDOWN_PDF_CODEX_ARTIFACT_LABELS } from "./codex-review";
import { runMarkdownPdfToPdfInteractiveFlow } from "./to-pdf";

export async function handleMarkdownPdfRecipesInteractiveAction(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<InteractiveNavigationOutcome> {
  while (true) {
    const outcome = await runMarkdownPdfAuthoring(runtime, pathPromptContext, {
      entry: "pdf-recipes",
    });
    if (outcome.kind === "change-source") {
      return { kind: "open-submenu", group: "md" };
    }
    if (outcome.kind === "saved-recipe") {
      const artifact = MARKDOWN_PDF_CODEX_ARTIFACT_LABELS[outcome.artifact].toLowerCase();
      const next = await select<"render" | "create" | "exit">({
        message: "What next?",
        choices: [
          { name: `Render a PDF with this ${artifact}`, value: "render" },
          { name: "Create another recipe", value: "create" },
          { name: "Exit", value: "exit" },
        ],
      });
      if (next === "render") {
        return await runMarkdownPdfToPdfInteractiveFlow(runtime, pathPromptContext, {
          savedRecipe: outcome,
        });
      }
      if (next === "create") {
        continue;
      }
      return { kind: "complete" };
    }
    if (outcome.kind === "generated-lifecycle") {
      return { kind: "complete" };
    }
    return outcome;
  }
}
