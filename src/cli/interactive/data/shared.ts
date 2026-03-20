import { extname } from "node:path";

import {
  formatDefaultOutputPathHint,
  promptOptionalOutputPathChoice,
  promptRequiredPathWithConfig,
} from "../../prompts/path";
import type { CliRuntime } from "../../types";
import { CliError } from "../../errors";
import type { InteractivePathPromptContext } from "../shared";

export type LightweightInteractiveDataFormat = "csv" | "tsv" | "json";
export type InteractiveExtractOutputFormat = "csv" | "tsv" | "json";

export interface InteractiveExtractWritePlan {
  output: string;
  overwrite: boolean;
  outputFormat: InteractiveExtractOutputFormat;
}

export function detectInteractiveDataFormat(inputPath: string): LightweightInteractiveDataFormat {
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

export function promptLightweightDataInput(
  message: string,
  pathPromptContext: InteractivePathPromptContext,
): Promise<string> {
  return promptRequiredPathWithConfig(message, {
    kind: "file",
    ...pathPromptContext,
  });
}

export async function promptLightweightDataOutput(options: {
  customMessage: string;
  extension: ".csv" | ".tsv" | ".json";
  inputPath: string;
  message: string;
  pathPromptContext: InteractivePathPromptContext;
  runtime: CliRuntime;
}): Promise<string> {
  const outputHint = formatDefaultOutputPathHint(options.runtime, options.inputPath, options.extension);
  return await promptOptionalOutputPathChoice({
    message: options.message,
    defaultHint: outputHint,
    kind: "file",
    ...options.pathPromptContext,
    customMessage: options.customMessage,
  });
}
