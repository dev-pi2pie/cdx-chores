import { confirm, select } from "@inquirer/prompts";

import { printLine } from "../../actions/shared";
import {
  DATA_QUERY_INPUT_FORMAT_VALUES,
  detectDataQueryInputFormat,
  type DataQueryInputFormat,
} from "../../duckdb/query";
import { CliError } from "../../errors";
import type { CliRuntime } from "../../types";

export async function promptInteractiveInputFormat(
  runtime: CliRuntime,
  inputPath: string,
): Promise<DataQueryInputFormat> {
  let detected: DataQueryInputFormat | undefined;
  try {
    detected = detectDataQueryInputFormat(inputPath);
  } catch (error) {
    if (!(error instanceof CliError)) {
      throw error;
    }
  }

  if (!detected) {
    printLine(runtime.stdout, "Automatic format detection could not determine the query input type.");
    return await select<DataQueryInputFormat>({
      message: "Input format",
      choices: DATA_QUERY_INPUT_FORMAT_VALUES.map((format) => ({
        name: format,
        value: format,
      })),
    });
  }

  const useDetected = await confirm({
    message: `Use detected input format: ${detected}?`,
    default: true,
  });
  if (useDetected) {
    return detected;
  }

  return await select<DataQueryInputFormat>({
    message: "Override input format",
    choices: DATA_QUERY_INPUT_FORMAT_VALUES.map((format) => ({
      name: format,
      value: format,
    })),
  });
}

export async function promptOptionalSourceSelection(
  format: DataQueryInputFormat,
  sources: readonly string[] | undefined,
): Promise<string | undefined> {
  if (!sources || sources.length === 0) {
    return undefined;
  }

  return await select<string>({
    message: format === "sqlite" ? "Choose a SQLite source" : "Choose an Excel sheet",
    choices: sources.map((source) => ({
      name: source,
      value: source,
    })),
  });
}
