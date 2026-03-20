import { Command } from "commander";

import { actionDataQuery, actionDataQueryCodex } from "../../actions";
import { DATA_QUERY_INPUT_FORMAT_VALUES, type DataQueryInputFormat } from "../../duckdb/query";
import { parseDataQueryInputFormatOption, parsePositiveIntegerOption } from "../../options/parsers";
import type { CliRuntime } from "../../types";

export function registerDataQueryCommands(dataCommand: Command, runtime: CliRuntime): void {
  const queryCommand = dataCommand
    .command("query")
    .description("Run a DuckDB-backed SQL query against one input file")
    .argument("<input>", "Input data file")
    .option("--sql <query>", "SQL query to execute against logical table `file`")
    .option(
      "--input-format <format>",
      `Override detected input format (${DATA_QUERY_INPUT_FORMAT_VALUES.join(", ")})`,
      parseDataQueryInputFormatOption,
    )
    .option("--source <name>", "Source object name for SQLite tables/views or Excel sheets")
    .option("--range <A1:Z99>", "Excel cell range within the selected sheet")
    .option("--source-shape <path>", "Reuse an accepted JSON source-shape artifact for Excel query replay")
    .option("--no-header", "Treat CSV or TSV input as headerless and generate column_n names")
    .option("--body-start-row <value>", "Excel worksheet row number where logical body rows begin", (value: string) =>
      parsePositiveIntegerOption(value, "--body-start-row"),
    )
    .option("--header-row <value>", "Excel worksheet row number to treat as the header row", (value: string) =>
      parsePositiveIntegerOption(value, "--header-row"),
    )
    .option("--header-mapping <path>", "Reuse an accepted JSON header-mapping artifact")
    .option("--codex-suggest-headers", "Ask Codex to suggest semantic header mappings and stop after writing the review artifact", false)
    .option("--write-header-mapping <path>", "Write the suggested header-mapping artifact to an explicit path")
    .option(
      "--install-missing-extension",
      "Attempt one DuckDB extension install-and-retry for sqlite/excel inputs",
      false,
    )
    .option("--rows <value>", "Number of rows to show in bounded table output", (value: string) =>
      parsePositiveIntegerOption(value, "--rows"),
    )
    .option("--json", "Write full query results as JSON to stdout", false)
    .option("--pretty", "Pretty-print JSON stdout or .json file output", false)
    .option("-o, --output <path>", "Write full query results to a .json or .csv file")
    .option("--overwrite", "Overwrite output file if it already exists", false)
    .action(
      async (
        input: string,
        options: {
          bodyStartRow?: number;
          codexSuggestHeaders?: boolean;
          header?: boolean;
          headerMapping?: string;
          headerRow?: number;
          inputFormat?: DataQueryInputFormat;
          installMissingExtension?: boolean;
          json?: boolean;
          noHeader?: boolean;
          output?: string;
          overwrite?: boolean;
          pretty?: boolean;
          range?: string;
          rows?: number;
          sourceShape?: string;
          source?: string;
          sql?: string;
          writeHeaderMapping?: string;
        },
      ) => {
        await actionDataQuery(runtime, {
          bodyStartRow: options.bodyStartRow,
          codexSuggestHeaders: options.codexSuggestHeaders,
          headerMapping: options.headerMapping,
          headerRow: options.headerRow,
          input,
          inputFormat: options.inputFormat,
          installMissingExtension: options.installMissingExtension,
          json: options.json,
          noHeader: options.noHeader ?? options.header === false,
          output: options.output,
          overwrite: options.overwrite,
          pretty: options.pretty,
          range: options.range,
          rows: options.rows,
          sourceShape: options.sourceShape,
          source: options.source,
          sql: options.sql,
          writeHeaderMapping: options.writeHeaderMapping,
        });
      },
    );

  queryCommand
    .command("codex")
    .description("Draft SQL from natural-language intent using bounded introspection")
    .argument("<input>", "Input data file")
    .requiredOption("--intent <text>", "Natural-language query intent for Codex drafting")
    .option(
      "--input-format <format>",
      `Override detected input format (${DATA_QUERY_INPUT_FORMAT_VALUES.join(", ")})`,
      parseDataQueryInputFormatOption,
    )
    .option("--source <name>", "Source object name for SQLite tables/views or Excel sheets")
    .option("--range <A1:Z99>", "Excel cell range within the selected sheet")
    .option("--body-start-row <value>", "Excel worksheet row number where logical body rows begin", (value: string) =>
      parsePositiveIntegerOption(value, "--body-start-row"),
    )
    .option("--header-row <value>", "Excel worksheet row number to treat as the header row", (value: string) =>
      parsePositiveIntegerOption(value, "--header-row"),
    )
    .option("--print-sql", "Write drafted SQL only to stdout", false)
    .action(
      async (
        input: string,
        options: {
          bodyStartRow?: number;
          inputFormat?: DataQueryInputFormat;
          intent: string;
          headerRow?: number;
          printSql?: boolean;
          range?: string;
          source?: string;
        },
        command: Command,
      ) => {
        const parentOptions = command.parent?.opts<{
          bodyStartRow?: number;
          headerRow?: number;
          inputFormat?: DataQueryInputFormat;
          range?: string;
          source?: string;
        }>();
        await actionDataQueryCodex(runtime, {
          bodyStartRow: options.bodyStartRow ?? parentOptions?.bodyStartRow,
          headerRow: options.headerRow ?? parentOptions?.headerRow,
          input,
          inputFormat: options.inputFormat ?? parentOptions?.inputFormat,
          intent: options.intent,
          printSql: options.printSql,
          range: options.range ?? parentOptions?.range,
          source: options.source ?? parentOptions?.source,
        });
      },
    );
}
