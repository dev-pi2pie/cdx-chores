import {
  delimitedRowsToObjects,
  parseDelimited,
  stringifyDelimitedRecords,
  stringifyDelimitedRows,
  type DelimitedFormat,
} from "../../utils/delimited";
import { normalizeRowsFromJson } from "../data-preview/normalize";
import { CliError } from "../errors";
import {
  defaultOutputPath,
  readTextFileRequired,
  resolveFromCwd,
  writeTextFileSafe,
} from "../fs-utils";
import type { CliRuntime } from "../types";
import { assertNonEmpty, displayPath, ensureFileExists, printLine } from "./shared";

export interface JsonToDelimitedOptions {
  input: string;
  output?: string;
  overwrite?: boolean;
}

export interface DelimitedToJsonOptions {
  input: string;
  output?: string;
  overwrite?: boolean;
  pretty?: boolean;
}

export interface DelimitedToDelimitedOptions {
  input: string;
  output?: string;
  overwrite?: boolean;
}

export type JsonToCsvOptions = JsonToDelimitedOptions;
export type JsonToTsvOptions = JsonToDelimitedOptions;
export type CsvToJsonOptions = DelimitedToJsonOptions;
export type TsvToJsonOptions = DelimitedToJsonOptions;
export type CsvToTsvOptions = DelimitedToDelimitedOptions;
export type TsvToCsvOptions = DelimitedToDelimitedOptions;

function getDelimitedDisplayLabel(format: DelimitedFormat): string {
  return format.toUpperCase();
}

function stringifyJsonOutput(value: unknown, pretty = false): string {
  return `${JSON.stringify(value, null, pretty ? 2 : 0)}\n`;
}

function countDelimitedDataRows(rows: readonly string[][]): number {
  return rows.slice(1).filter((row) => row.some((value) => value.length > 0)).length;
}

async function actionJsonToDelimited(
  runtime: CliRuntime,
  options: JsonToDelimitedOptions,
  targetFormat: DelimitedFormat,
): Promise<void> {
  const inputPath = resolveFromCwd(runtime, assertNonEmpty(options.input, "Input path"));
  const outputPath = resolveFromCwd(runtime, options.output?.trim() || defaultOutputPath(inputPath, `.${targetFormat}`));
  await ensureFileExists(inputPath, "Input");

  const raw = await readTextFileRequired(inputPath);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Invalid JSON: ${message}`, { code: "INVALID_JSON", exitCode: 2 });
  }

  const rows = normalizeRowsFromJson(parsed);
  const text = stringifyDelimitedRecords(rows, targetFormat);
  await writeTextFileSafe(outputPath, text, { overwrite: options.overwrite });

  printLine(runtime.stdout, `Wrote ${getDelimitedDisplayLabel(targetFormat)}: ${displayPath(runtime, outputPath)}`);
  printLine(runtime.stdout, `Rows: ${rows.length}`);
}

async function actionDelimitedToJson(
  runtime: CliRuntime,
  options: DelimitedToJsonOptions,
  sourceFormat: DelimitedFormat,
): Promise<void> {
  const inputPath = resolveFromCwd(runtime, assertNonEmpty(options.input, "Input path"));
  const outputPath = resolveFromCwd(runtime, options.output?.trim() || defaultOutputPath(inputPath, ".json"));
  await ensureFileExists(inputPath, "Input");

  const raw = await readTextFileRequired(inputPath);
  const rows = parseDelimited(raw, sourceFormat);
  const records = delimitedRowsToObjects(rows);
  const json = stringifyJsonOutput(records, options.pretty);
  await writeTextFileSafe(outputPath, json, { overwrite: options.overwrite });

  printLine(runtime.stdout, `Wrote JSON: ${displayPath(runtime, outputPath)}`);
  printLine(runtime.stdout, `Rows: ${records.length}`);
}

async function actionDelimitedToDelimited(
  runtime: CliRuntime,
  options: DelimitedToDelimitedOptions,
  sourceFormat: DelimitedFormat,
  targetFormat: DelimitedFormat,
): Promise<void> {
  const inputPath = resolveFromCwd(runtime, assertNonEmpty(options.input, "Input path"));
  const outputPath = resolveFromCwd(runtime, options.output?.trim() || defaultOutputPath(inputPath, `.${targetFormat}`));
  await ensureFileExists(inputPath, "Input");

  const raw = await readTextFileRequired(inputPath);
  const rows = parseDelimited(raw, sourceFormat);
  const text = stringifyDelimitedRows(rows, targetFormat);
  await writeTextFileSafe(outputPath, text, { overwrite: options.overwrite });

  printLine(runtime.stdout, `Wrote ${getDelimitedDisplayLabel(targetFormat)}: ${displayPath(runtime, outputPath)}`);
  printLine(runtime.stdout, `Rows: ${countDelimitedDataRows(rows)}`);
}

export async function actionJsonToCsv(runtime: CliRuntime, options: JsonToCsvOptions): Promise<void> {
  await actionJsonToDelimited(runtime, options, "csv");
}

export async function actionJsonToTsv(runtime: CliRuntime, options: JsonToTsvOptions): Promise<void> {
  await actionJsonToDelimited(runtime, options, "tsv");
}

export async function actionCsvToJson(runtime: CliRuntime, options: CsvToJsonOptions): Promise<void> {
  await actionDelimitedToJson(runtime, options, "csv");
}

export async function actionTsvToJson(runtime: CliRuntime, options: TsvToJsonOptions): Promise<void> {
  await actionDelimitedToJson(runtime, options, "tsv");
}

export async function actionCsvToTsv(runtime: CliRuntime, options: CsvToTsvOptions): Promise<void> {
  await actionDelimitedToDelimited(runtime, options, "csv", "tsv");
}

export async function actionTsvToCsv(runtime: CliRuntime, options: TsvToCsvOptions): Promise<void> {
  await actionDelimitedToDelimited(runtime, options, "tsv", "csv");
}
