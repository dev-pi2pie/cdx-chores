import type { Command } from "commander";

import {
  actionCsvToJson,
  actionCsvToTsv,
  actionJsonToCsv,
  actionJsonToTsv,
  actionTsvToCsv,
  actionTsvToJson,
} from "../../actions";
import { applyCommonFileOptions } from "../../options/common";
import type { CliRuntime } from "../../types";

export function registerDataConversionCommands(dataCommand: Command, runtime: CliRuntime): void {
  applyCommonFileOptions(
    dataCommand
      .command("json-to-csv")
      .description("Convert JSON file to CSV")
      .requiredOption("-i, --input <path>", "Input JSON file")
      .action(async (options: { input: string; output?: string; overwrite?: boolean }) => {
        await actionJsonToCsv(runtime, options);
      }),
  );

  applyCommonFileOptions(
    dataCommand
      .command("json-to-tsv")
      .description("Convert JSON file to TSV")
      .requiredOption("-i, --input <path>", "Input JSON file")
      .action(async (options: { input: string; output?: string; overwrite?: boolean }) => {
        await actionJsonToTsv(runtime, options);
      }),
  );

  dataCommand
    .command("csv-to-json")
    .description("Convert CSV file to JSON")
    .requiredOption("-i, --input <path>", "Input CSV file")
    .option("-o, --output <path>", "Output JSON file path")
    .option("--overwrite", "Overwrite output file if it already exists", false)
    .option("--pretty", "Pretty-print JSON output", false)
    .action(
      async (options: {
        input: string;
        output?: string;
        overwrite?: boolean;
        pretty?: boolean;
      }) => {
        await actionCsvToJson(runtime, options);
      },
    );

  applyCommonFileOptions(
    dataCommand
      .command("csv-to-tsv")
      .description("Convert CSV file to TSV")
      .requiredOption("-i, --input <path>", "Input CSV file")
      .action(async (options: { input: string; output?: string; overwrite?: boolean }) => {
        await actionCsvToTsv(runtime, options);
      }),
  );

  applyCommonFileOptions(
    dataCommand
      .command("tsv-to-csv")
      .description("Convert TSV file to CSV")
      .requiredOption("-i, --input <path>", "Input TSV file")
      .action(async (options: { input: string; output?: string; overwrite?: boolean }) => {
        await actionTsvToCsv(runtime, options);
      }),
  );

  dataCommand
    .command("tsv-to-json")
    .description("Convert TSV file to JSON")
    .requiredOption("-i, --input <path>", "Input TSV file")
    .option("-o, --output <path>", "Output JSON file path")
    .option("--overwrite", "Overwrite output file if it already exists", false)
    .option("--pretty", "Pretty-print JSON output", false)
    .action(
      async (options: {
        input: string;
        output?: string;
        overwrite?: boolean;
        pretty?: boolean;
      }) => {
        await actionTsvToJson(runtime, options);
      },
    );
}
