import type { CliRuntime } from "../../types";
import type { InteractiveNavigationOutcome, InteractivePathPromptContext } from "../shared";
import { runMarkdownPdfAuthoring } from "./authoring";

export async function handleMarkdownPdfRecipesInteractiveAction(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<InteractiveNavigationOutcome> {
  const outcome = await runMarkdownPdfAuthoring(runtime, pathPromptContext, {
    entry: "pdf-recipes",
  });
  if (outcome.kind === "change-source") {
    return { kind: "open-submenu", group: "md" };
  }
  if (outcome.kind === "saved-recipe" || outcome.kind === "generated-lifecycle") {
    return { kind: "complete" };
  }
  return outcome;
}
