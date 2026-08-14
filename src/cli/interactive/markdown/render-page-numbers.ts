import { select } from "@inquirer/prompts";

export type MarkdownPdfRenderPageNumberChoice = "inherit" | "enable" | "disable";

export type MarkdownPdfRenderPageNumberPromptOutcome =
  | MarkdownPdfRenderPageNumberChoice
  | "back"
  | "cancel";

type MarkdownPdfRenderPageNumberSelect = (
  options: Parameters<typeof select<MarkdownPdfRenderPageNumberPromptOutcome>>[0],
) => Promise<MarkdownPdfRenderPageNumberPromptOutcome>;

export function compileMarkdownPdfRenderPageNumberChoice(
  choice: MarkdownPdfRenderPageNumberChoice,
): boolean | undefined {
  if (choice === "enable") {
    return true;
  }
  if (choice === "disable") {
    return false;
  }
  return undefined;
}

export async function promptMarkdownPdfRenderPageNumberChoice(
  current: MarkdownPdfRenderPageNumberChoice = "inherit",
  implementations: { select?: MarkdownPdfRenderPageNumberSelect } = {},
): Promise<MarkdownPdfRenderPageNumberPromptOutcome> {
  const options: Parameters<typeof select<MarkdownPdfRenderPageNumberPromptOutcome>>[0] = {
    message: "Page numbers for this PDF",
    choices: [
      { name: "Keep recipe setting", value: "inherit" },
      { name: "Turn on for this PDF only", value: "enable" },
      { name: "Turn off for this PDF only", value: "disable" },
      { name: "Back", value: "back" },
      { name: "Cancel", value: "cancel" },
    ],
    default: current,
  };
  return implementations.select
    ? await implementations.select(options)
    : await select<MarkdownPdfRenderPageNumberPromptOutcome>(options);
}
