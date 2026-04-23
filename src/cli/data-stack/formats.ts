import { extname } from "node:path";

import { CliError } from "../errors";
import type { DataStackInputFormat, DataStackOutputFormat } from "./types";

const INPUT_FORMAT_EXTENSION_MAP: Record<string, DataStackInputFormat> = {
  ".csv": "csv",
  ".tsv": "tsv",
  ".jsonl": "jsonl",
};

const STACK_DISCOVERY_EXTENSIONS_BY_FORMAT: Record<DataStackInputFormat, readonly string[]> = {
  csv: [".csv"],
  tsv: [".tsv"],
  jsonl: [".jsonl"],
};

export function detectDataStackInputFormat(
  inputPath: string,
  override?: DataStackInputFormat,
): DataStackInputFormat {
  if (override) {
    return override;
  }

  const detected = INPUT_FORMAT_EXTENSION_MAP[extname(inputPath).toLowerCase()];
  if (detected) {
    return detected;
  }

  throw new CliError(
    `Unsupported stack file type: ${inputPath}. Supported inputs: .csv, .tsv, .jsonl.`,
    {
      code: "INVALID_INPUT",
      exitCode: 2,
    },
  );
}

export function isSupportedDataStackDiscoveryPath(
  path: string,
  format?: DataStackInputFormat,
): boolean {
  const extension = extname(path).toLowerCase();
  if (!format) {
    return extension in INPUT_FORMAT_EXTENSION_MAP;
  }
  return STACK_DISCOVERY_EXTENSIONS_BY_FORMAT[format].includes(extension);
}

export function normalizeDataStackOutputFormat(outputPath: string): DataStackOutputFormat {
  const extension = extname(outputPath).toLowerCase();
  if (extension === ".csv" || extension === ".tsv" || extension === ".json") {
    return extension.slice(1) as DataStackOutputFormat;
  }
  throw new CliError("Unsupported --output extension. Use .csv, .tsv, or .json.", {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}
