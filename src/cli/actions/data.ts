import { csvRowsToObjects, parseCsv, stringifyCsv } from "../../utils/csv";
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

export interface JsonToCsvOptions {
  input: string;
  output?: string;
  overwrite?: boolean;
}

export async function actionJsonToCsv(runtime: CliRuntime, options: JsonToCsvOptions): Promise<void> {
  const inputPath = resolveFromCwd(runtime, assertNonEmpty(options.input, "Input path"));
  const outputPath = resolveFromCwd(runtime, options.output?.trim() || defaultOutputPath(inputPath, ".csv"));
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
  const csv = stringifyCsv(rows);
  await writeTextFileSafe(outputPath, csv, { overwrite: options.overwrite });

  printLine(runtime.stdout, `Wrote CSV: ${displayPath(runtime, outputPath)}`);
  printLine(runtime.stdout, `Rows: ${rows.length}`);
}

export interface CsvToJsonOptions {
  input: string;
  output?: string;
  overwrite?: boolean;
  pretty?: boolean;
}

export async function actionCsvToJson(runtime: CliRuntime, options: CsvToJsonOptions): Promise<void> {
  const inputPath = resolveFromCwd(runtime, assertNonEmpty(options.input, "Input path"));
  const outputPath = resolveFromCwd(runtime, options.output?.trim() || defaultOutputPath(inputPath, ".json"));
  await ensureFileExists(inputPath, "Input");

  const raw = await readTextFileRequired(inputPath);
  const rows = parseCsv(raw);
  const records = csvRowsToObjects(rows);
  const json = `${JSON.stringify(records, null, options.pretty ? 2 : 0)}\n`;
  await writeTextFileSafe(outputPath, json, { overwrite: options.overwrite });

  printLine(runtime.stdout, `Wrote JSON: ${displayPath(runtime, outputPath)}`);
  printLine(runtime.stdout, `Rows: ${records.length}`);
}
