import { input, select } from "@inquirer/prompts";

import { normalizeMarkdownPdfInteractiveFontHintText } from "./text";
import type {
  MarkdownPdfInteractiveFontHintArtifact,
  MarkdownPdfInteractiveFontHintEditorChoice,
  MarkdownPdfInteractiveFontHintIntendedUse,
} from "./types";

export function intendedUseChoices(
  artifact: MarkdownPdfInteractiveFontHintArtifact,
): Array<MarkdownPdfInteractiveFontHintEditorChoice<MarkdownPdfInteractiveFontHintIntendedUse>> {
  const choices: Array<
    MarkdownPdfInteractiveFontHintEditorChoice<MarkdownPdfInteractiveFontHintIntendedUse>
  > = [
    { name: "Keep this preference general", value: { kind: "general-body" } },
    { name: "Body text", value: { kind: "body" } },
    { name: "Language-specific body text", value: { kind: "language-body", language: "" } },
    { name: "Headings and titles", value: { kind: "heading" } },
    { name: "Code text", value: { kind: "code" } },
    { name: "Code symbols", value: { kind: "code-symbols" } },
  ];

  if (artifact !== "template-bundle") {
    choices.push({ name: "Page headers and footers", value: { kind: "page-chrome" } });
  }

  return choices;
}

async function promptHumanLanguage(): Promise<string> {
  return normalizeMarkdownPdfInteractiveFontHintText(
    await input({
      message: "Human language",
      validate: (value) =>
        normalizeMarkdownPdfInteractiveFontHintText(String(value)).length > 0 ||
        "Enter one human language for this font hint.",
    }),
  );
}

export async function promptMarkdownPdfInteractiveFontHintIntendedUse(
  artifact: MarkdownPdfInteractiveFontHintArtifact,
): Promise<MarkdownPdfInteractiveFontHintIntendedUse | "back"> {
  const choice = await select<MarkdownPdfInteractiveFontHintIntendedUse | "back">({
    message: "Intended use",
    choices: [
      ...intendedUseChoices(artifact),
      {
        name: "Back",
        value: "back",
      },
    ],
  });

  if (choice === "back" || choice.kind !== "language-body") {
    return choice;
  }

  return {
    kind: "language-body",
    language: await promptHumanLanguage(),
  };
}
