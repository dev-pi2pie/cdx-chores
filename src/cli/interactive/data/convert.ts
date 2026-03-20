import { confirm, select } from "@inquirer/prompts";
import { extname } from "node:path";

import {
  actionCsvToJson,
  actionCsvToTsv,
  actionJsonToCsv,
  actionJsonToTsv,
  actionTsvToCsv,
  actionTsvToJson,
} from "../../actions";
import { printLine } from "../../actions/shared";
import { CliError } from "../../errors";
import {
  formatDefaultOutputPathHint,
  promptOptionalOutputPathChoice,
  promptRequiredPathWithConfig,
} from "../../prompts/path";
import type { CliRuntime } from "../../types";
import type { InteractivePathPromptContext } from "../shared";

type LightweightInteractiveDataFormat = "csv" | "tsv" | "json";

function detectInteractiveDataFormat(inputPath: string): LightweightInteractiveDataFormat {
  const extension = extname(inputPath).toLowerCase();
  if (extension === ".csv" || extension === ".tsv" || extension === ".json") {
    return extension.slice(1) as LightweightInteractiveDataFormat;
  }

  throw new CliError(
    `Unsupported lightweight data file type: ${extension || "(none)"}. Expected .csv, .tsv, or .json.`,
    {
      code: "INVALID_INPUT",
      exitCode: 2,
    },
  );
}

function getInteractiveTargetChoices(
  sourceFormat: LightweightInteractiveDataFormat,
): Array<{ name: string; value: LightweightInteractiveDataFormat }> {
  return (["csv", "tsv", "json"] as const)
    .filter((format) => format !== sourceFormat)
    .map((format) => ({
      name: format.toUpperCase(),
      value: format,
    }));
}

export async function runInteractiveDataConvert(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<void> {
  const inputPath = await promptRequiredPathWithConfig("Input CSV, TSV, or JSON file", {
    kind: "file",
    ...pathPromptContext,
  });
  const sourceFormat = detectInteractiveDataFormat(inputPath);
  printLine(runtime.stderr, `Detected source format: ${sourceFormat}`);

  const targetFormat = await select<LightweightInteractiveDataFormat>({
    message: "Convert to",
    choices: getInteractiveTargetChoices(sourceFormat),
  });

  const outputHint = formatDefaultOutputPathHint(runtime, inputPath, `.${targetFormat}`);
  const outputPath = await promptOptionalOutputPathChoice({
    message: `Output ${targetFormat.toUpperCase()} file`,
    defaultHint: outputHint,
    kind: "file",
    ...pathPromptContext,
    customMessage: `Custom ${targetFormat.toUpperCase()} output path`,
  });
  const pretty = targetFormat === "json"
    ? await confirm({ message: "Pretty-print JSON?", default: true })
    : undefined;
  const overwrite = await confirm({ message: "Overwrite if exists?", default: false });

  if (sourceFormat === "json" && targetFormat === "csv") {
    await actionJsonToCsv(runtime, { input: inputPath, output: outputPath, overwrite });
    return;
  }
  if (sourceFormat === "json" && targetFormat === "tsv") {
    await actionJsonToTsv(runtime, { input: inputPath, output: outputPath, overwrite });
    return;
  }
  if (sourceFormat === "csv" && targetFormat === "json") {
    await actionCsvToJson(runtime, { input: inputPath, output: outputPath, overwrite, pretty });
    return;
  }
  if (sourceFormat === "csv" && targetFormat === "tsv") {
    await actionCsvToTsv(runtime, { input: inputPath, output: outputPath, overwrite });
    return;
  }
  if (sourceFormat === "tsv" && targetFormat === "csv") {
    await actionTsvToCsv(runtime, { input: inputPath, output: outputPath, overwrite });
    return;
  }
  if (sourceFormat === "tsv" && targetFormat === "json") {
    await actionTsvToJson(runtime, { input: inputPath, output: outputPath, overwrite, pretty });
    return;
  }

  throw new CliError(`Unsupported conversion target: ${sourceFormat} -> ${targetFormat}.`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}
