import type { Command } from "commander";

import { actionDataParquetPreview, actionDataPreview } from "../../actions";
import {
  collectCsvListOption,
  collectRepeatedOption,
  parseNonNegativeIntegerOption,
  parsePositiveIntegerOption,
} from "../../options/parsers";
import type { CliRuntime } from "../../types";

export function registerDataPreviewCommands(dataCommand: Command, runtime: CliRuntime): void {
  dataCommand
    .command("preview")
    .description("Preview CSV, TSV, or JSON data as a bounded terminal table")
    .argument("<input>", "Input CSV, TSV, or JSON file")
    .option("--no-header", "Treat CSV or TSV input as headerless and generate column_n names")
    .option("--rows <value>", "Number of rows to show", (value: string) => parsePositiveIntegerOption(value, "--rows"))
    .option("--offset <value>", "Row offset to start from", (value: string) =>
      parseNonNegativeIntegerOption(value, "--offset"),
    )
    .option("--columns <names>", "Columns to show (comma-separated)", collectCsvListOption, [])
    .option(
      "--contains <column:keyword>",
      "Filter rows by case-insensitive substring match on a named column (repeatable; escape ':' as \\: and '\\' as \\\\)",
      collectRepeatedOption,
      [],
    )
    .action(
      async (
        input: string,
        options: {
          columns?: string[];
          contains?: string[];
          header?: boolean;
          noHeader?: boolean;
          offset?: number;
          rows?: number;
        },
      ) => {
        await actionDataPreview(runtime, {
          columns: options.columns,
          contains: options.contains,
          input,
          noHeader: options.noHeader ?? options.header === false,
          offset: options.offset,
          rows: options.rows,
        });
      },
    );

  const parquetCommand = dataCommand.command("parquet").description("DuckDB-backed Parquet preview utilities");

  parquetCommand
    .command("preview")
    .description("Preview Parquet data as a bounded terminal table")
    .argument("<input>", "Input Parquet file")
    .option("--rows <value>", "Number of rows to show", (value: string) => parsePositiveIntegerOption(value, "--rows"))
    .option("--offset <value>", "Row offset to start from", (value: string) =>
      parseNonNegativeIntegerOption(value, "--offset"),
    )
    .option("--columns <names>", "Columns to show (comma-separated)", collectCsvListOption, [])
    .action(
      async (
        input: string,
        options: {
          columns?: string[];
          offset?: number;
          rows?: number;
        },
      ) => {
        await actionDataParquetPreview(runtime, {
          columns: options.columns,
          input,
          offset: options.offset,
          rows: options.rows,
        });
      },
    );
}
