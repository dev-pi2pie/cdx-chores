import { confirm } from "@inquirer/prompts";

import { actionCsvToJson, actionJsonToCsv } from "../actions";
import {
  formatDefaultOutputPathHint,
  promptOptionalOutputPathChoice,
  promptRequiredPathWithConfig,
} from "../prompts/path";
import type { CliRuntime } from "../types";
import type { DataInteractiveActionKey } from "./menu";
import { assertNeverInteractiveAction, type InteractivePathPromptContext } from "./shared";

export async function handleDataInteractiveAction(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  action: DataInteractiveActionKey,
): Promise<void> {
  if (action === "data:json-to-csv") {
    const inputPath = await promptRequiredPathWithConfig("Input JSON file", {
      kind: "file",
      ...pathPromptContext,
    });
    const outputHint = formatDefaultOutputPathHint(runtime, inputPath, ".csv");
    const outputPath = await promptOptionalOutputPathChoice({
      message: "Output CSV file",
      defaultHint: outputHint,
      kind: "file",
      ...pathPromptContext,
      customMessage: "Custom CSV output path",
    });
    const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
    await actionJsonToCsv(runtime, { input: inputPath, output: outputPath, overwrite });
    return;
  }

  if (action !== "data:csv-to-json") {
    assertNeverInteractiveAction(action);
  }

  const inputPath = await promptRequiredPathWithConfig("Input CSV file", {
    kind: "file",
    ...pathPromptContext,
  });
  const outputHint = formatDefaultOutputPathHint(runtime, inputPath, ".json");
  const outputPath = await promptOptionalOutputPathChoice({
    message: "Output JSON file",
    defaultHint: outputHint,
    kind: "file",
    ...pathPromptContext,
    customMessage: "Custom JSON output path",
  });
  const pretty = await confirm({ message: "Pretty-print JSON?", default: true });
  const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
  await actionCsvToJson(runtime, {
    input: inputPath,
    output: outputPath,
    pretty,
    overwrite,
  });
}
