import { select } from "@inquirer/prompts";

export type MarkdownPdfRenderCodeHighlightChoice = "inherit" | "enable" | "disable";

export type MarkdownPdfRenderCodeHighlightPromptOutcome =
  | MarkdownPdfRenderCodeHighlightChoice
  | "back"
  | "cancel";

export function compileMarkdownPdfRenderCodeHighlightChoice(
  choice: MarkdownPdfRenderCodeHighlightChoice,
): boolean | undefined {
  if (choice === "enable") {
    return true;
  }
  if (choice === "disable") {
    return false;
  }
  return undefined;
}

export function markdownPdfRenderCodeHighlightChoiceLabel(
  choice: MarkdownPdfRenderCodeHighlightChoice,
): string {
  if (choice === "enable") {
    return "Enable for this render";
  }
  if (choice === "disable") {
    return "Disable for this render";
  }
  return "Use recipe setting";
}

export async function promptMarkdownPdfRenderCodeHighlightChoice(
  current: MarkdownPdfRenderCodeHighlightChoice = "inherit",
): Promise<MarkdownPdfRenderCodeHighlightPromptOutcome> {
  return await select<MarkdownPdfRenderCodeHighlightPromptOutcome>({
    message: "Code highlighting for this PDF",
    choices: [
      { name: "Use recipe setting", value: "inherit" },
      { name: "Enable for this render", value: "enable" },
      { name: "Disable for this render", value: "disable" },
      { name: "Back", value: "back" },
      { name: "Cancel", value: "cancel" },
    ],
    default: current,
  });
}
