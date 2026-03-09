import { confirm, input } from "@inquirer/prompts";

import { actionCsvToJson, actionDataPreview, actionJsonToCsv } from "../actions";
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
  if (action === "data:preview") {
    const inputPath = await promptRequiredPathWithConfig("Input CSV or JSON file", {
      kind: "file",
      ...pathPromptContext,
    });
    const rowsInput = await input({
      message: "Rows to show (optional)",
      default: "",
      validate: (value) => {
        const trimmed = value.trim();
        if (!trimmed) {
          return true;
        }
        const parsed = Number(trimmed);
        return Number.isInteger(parsed) && parsed > 0 ? true : "Enter a positive integer.";
      },
    });
    const offsetInput = await input({
      message: "Row offset (optional)",
      default: "",
      validate: (value) => {
        const trimmed = value.trim();
        if (!trimmed) {
          return true;
        }
        const parsed = Number(trimmed);
        return Number.isInteger(parsed) && parsed >= 0 ? true : "Enter a non-negative integer.";
      },
    });
    const columnsInput = await input({
      message: "Columns to show (comma-separated, optional)",
      default: "",
    });
    const columns = columnsInput
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    await actionDataPreview(runtime, {
      columns: columns.length > 0 ? columns : undefined,
      input: inputPath,
      offset: offsetInput.trim() ? Number(offsetInput) : undefined,
      rows: rowsInput.trim() ? Number(rowsInput) : undefined,
    });
    return;
  }

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
