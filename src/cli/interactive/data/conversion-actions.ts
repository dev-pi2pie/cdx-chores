import { confirm } from "@inquirer/prompts";

import {
  actionCsvToJson,
  actionCsvToTsv,
  actionJsonToCsv,
  actionJsonToTsv,
  actionTsvToCsv,
  actionTsvToJson,
} from "../../actions";
import {
  formatDefaultOutputPathHint,
  promptOptionalOutputPathChoice,
  promptRequiredPathWithConfig,
} from "../../prompts/path";
import type { CliRuntime } from "../../types";
import type { DataInteractiveActionKey } from "../menu";
import { assertNeverInteractiveAction, type InteractivePathPromptContext } from "../shared";

type DirectDataConversionAction =
  (typeof DIRECT_DATA_CONVERSION_ACTIONS)[number];

export const DIRECT_DATA_CONVERSION_ACTIONS = [
  "data:json-to-csv",
  "data:json-to-tsv",
  "data:csv-to-json",
  "data:csv-to-tsv",
  "data:tsv-to-csv",
  "data:tsv-to-json",
] as const;

export function isDirectDataConversionAction(
  action: DataInteractiveActionKey,
): action is DirectDataConversionAction {
  return DIRECT_DATA_CONVERSION_ACTIONS.includes(action as DirectDataConversionAction);
}

export async function handleDirectDataConversionAction(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  action: DirectDataConversionAction,
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

  if (action === "data:json-to-tsv") {
    const inputPath = await promptRequiredPathWithConfig("Input JSON file", {
      kind: "file",
      ...pathPromptContext,
    });
    const outputHint = formatDefaultOutputPathHint(runtime, inputPath, ".tsv");
    const outputPath = await promptOptionalOutputPathChoice({
      message: "Output TSV file",
      defaultHint: outputHint,
      kind: "file",
      ...pathPromptContext,
      customMessage: "Custom TSV output path",
    });
    const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
    await actionJsonToTsv(runtime, { input: inputPath, output: outputPath, overwrite });
    return;
  }

  if (action === "data:csv-to-json") {
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
    return;
  }

  if (action === "data:csv-to-tsv") {
    const inputPath = await promptRequiredPathWithConfig("Input CSV file", {
      kind: "file",
      ...pathPromptContext,
    });
    const outputHint = formatDefaultOutputPathHint(runtime, inputPath, ".tsv");
    const outputPath = await promptOptionalOutputPathChoice({
      message: "Output TSV file",
      defaultHint: outputHint,
      kind: "file",
      ...pathPromptContext,
      customMessage: "Custom TSV output path",
    });
    const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
    await actionCsvToTsv(runtime, {
      input: inputPath,
      output: outputPath,
      overwrite,
    });
    return;
  }

  if (action === "data:tsv-to-csv") {
    const inputPath = await promptRequiredPathWithConfig("Input TSV file", {
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
    await actionTsvToCsv(runtime, {
      input: inputPath,
      output: outputPath,
      overwrite,
    });
    return;
  }

  if (action === "data:tsv-to-json") {
    const inputPath = await promptRequiredPathWithConfig("Input TSV file", {
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
    await actionTsvToJson(runtime, {
      input: inputPath,
      output: outputPath,
      pretty,
      overwrite,
    });
    return;
  }

  assertNeverInteractiveAction(action);
}
