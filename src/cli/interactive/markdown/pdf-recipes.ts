import { select } from "@inquirer/prompts";

import type { CliRuntime } from "../../types";
import { createInteractiveSession, type InteractiveSession } from "../session";
import type { InteractiveNavigationOutcome, InteractivePathPromptContext } from "../shared";
import { runMarkdownPdfAuthoring } from "./authoring";
import { MARKDOWN_PDF_CODEX_ARTIFACT_LABELS } from "./codex-review";
import { createMarkdownPdfInteractiveCodexSession } from "./codex-session";
import { runMarkdownPdfToPdfInteractiveFlow } from "./to-pdf";

export async function handleMarkdownPdfRecipesInteractiveAction(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  session: InteractiveSession = createInteractiveSession(),
): Promise<InteractiveNavigationOutcome> {
  const codexSession = createMarkdownPdfInteractiveCodexSession(runtime);
  try {
    while (true) {
      const outcome = await runMarkdownPdfAuthoring(runtime, pathPromptContext, {
        codexTimeoutMs: session.codexTimeoutMs,
        codexExecution: session.codexExecution,
        entry: "pdf-recipes",
        fontHintEditor: codexSession.fontHintEditor,
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
            interactiveSession: session,
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
  } finally {
    codexSession.cancel();
  }
}
