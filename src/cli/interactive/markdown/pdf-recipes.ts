import type { CliRuntime } from "../../types";
import type { InteractiveNavigationOutcome, InteractivePathPromptContext } from "../shared";
import { runMarkdownPdfDeterministicAuthoring } from "./authoring";

export async function handleMarkdownPdfRecipesInteractiveAction(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<InteractiveNavigationOutcome> {
  const outcome = await runMarkdownPdfDeterministicAuthoring(runtime, pathPromptContext, {
    entry: "pdf-recipes",
  });
  if (outcome.kind === "change-source") {
    return { kind: "open-submenu", group: "md" };
  }
  return outcome;
}
