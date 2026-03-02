import { confirm, select } from "@inquirer/prompts";

import { actionMdFrontmatterToJson, actionMdToDocx } from "../actions";
import {
  formatDefaultOutputPathHint,
  promptOptionalOutputPathChoice,
  promptRequiredPathWithConfig,
} from "../prompts/path";
import type { CliRuntime } from "../types";
import type { MarkdownInteractiveActionKey } from "./menu";
import { assertNeverInteractiveAction, type InteractivePathPromptContext } from "./shared";

export async function handleMarkdownInteractiveAction(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  action: MarkdownInteractiveActionKey,
): Promise<void> {
  if (action === "md:to-docx") {
    const inputPath = await promptRequiredPathWithConfig("Input Markdown file", {
      kind: "file",
      ...pathPromptContext,
    });
    const outputHint = formatDefaultOutputPathHint(runtime, inputPath, ".docx");
    const outputPath = await promptOptionalOutputPathChoice({
      message: "Output DOCX file",
      defaultHint: outputHint,
      kind: "file",
      ...pathPromptContext,
      customMessage: "Custom DOCX output path",
    });
    const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
    await actionMdToDocx(runtime, {
      input: inputPath,
      output: outputPath,
      overwrite,
    });
    return;
  }

  if (action !== "md:frontmatter-to-json") {
    assertNeverInteractiveAction(action);
  }

  const inputPath = await promptRequiredPathWithConfig("Input Markdown file", {
    kind: "file",
    ...pathPromptContext,
  });
  const outputMode = await select<"stdout" | "file">({
    message: "JSON output destination",
    choices: [
      { name: "Print to stdout (default)", value: "stdout" },
      { name: "Write to file", value: "file" },
    ],
  });
  const outputShape = await select<"wrapper" | "data-only">({
    message: "JSON output shape",
    choices: [
      {
        name: "Wrapper (default)",
        value: "wrapper",
        description: "{ frontmatterType, data }",
      },
      {
        name: "Data only",
        value: "data-only",
        description: "Only the parsed frontmatter object",
      },
    ],
  });
  const pretty = await confirm({ message: "Pretty-print JSON?", default: true });

  let outputPath: string | undefined;
  let overwrite = false;
  if (outputMode === "file") {
    const outputHint = formatDefaultOutputPathHint(runtime, inputPath, ".frontmatter.json");
    outputPath = await promptOptionalOutputPathChoice({
      message: "Output JSON file",
      defaultHint: outputHint,
      kind: "file",
      ...pathPromptContext,
      customMessage: "Custom JSON output path",
    });
    overwrite = await confirm({ message: "Overwrite if exists?", default: false });
  }

  await actionMdFrontmatterToJson(runtime, {
    input: inputPath,
    toStdout: outputMode === "stdout",
    output: outputPath,
    overwrite,
    pretty,
    dataOnly: outputShape === "data-only",
  });
}
