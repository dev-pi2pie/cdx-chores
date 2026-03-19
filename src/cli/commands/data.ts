import { Command } from "commander";

import {
  actionCsvToJson,
  actionCsvToTsv,
  actionDataDuckDbDoctor,
  actionDataDuckDbExtensionInstall,
  actionDataExtract,
  actionDataParquetPreview,
  actionDataPreview,
  actionDataQuery,
  actionDataQueryCodex,
  actionJsonToCsv,
  actionJsonToTsv,
  actionTsvToCsv,
  actionTsvToJson,
} from "../actions";
import {
  DATA_QUERY_INPUT_FORMAT_VALUES,
  type DataQueryInputFormat,
} from "../duckdb/query";
import {
  DUCKDB_MANAGED_EXTENSION_NAMES,
  type DuckDbManagedExtensionName,
} from "../duckdb/extensions";
import { applyCommonFileOptions } from "../options/common";
import {
  collectCsvListOption,
  collectRepeatedOption,
  parseDataQueryInputFormatOption,
  parseDuckDbManagedExtensionOption,
  parseNonNegativeIntegerOption,
  parsePositiveIntegerOption,
} from "../options/parsers";
import type { CliRuntime } from "../types";

export function registerDataCommands(program: Command, runtime: CliRuntime): void {
  const dataCommand = program.command("data").description("Data preview, extract, query, and conversion utilities");

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

  dataCommand
    .command("preview")
    .description("Preview CSV, TSV, or JSON data as a bounded terminal table")
    .argument("<input>", "Input CSV, TSV, or JSON file")
    .option("--no-header", "Treat CSV or TSV input as headerless and generate column_n names", false)
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
          noHeader?: boolean;
          offset?: number;
          rows?: number;
        },
      ) => {
        await actionDataPreview(runtime, {
          columns: options.columns,
          contains: options.contains,
          input,
          noHeader: options.noHeader,
          offset: options.offset,
          rows: options.rows,
        });
      },
    );

  const parquetCommand = dataCommand.command("parquet").description("DuckDB-backed Parquet preview utilities");

  const duckdbCommand = dataCommand.command("duckdb").description("DuckDB extension inspection and setup utilities");

  duckdbCommand
    .command("doctor")
    .description("Inspect DuckDB-managed extension state for data query")
    .option("--json", "Output machine-readable JSON", false)
    .action(async (options: { json?: boolean }) => {
      await actionDataDuckDbDoctor(runtime, { json: options.json });
    });

  const duckdbExtensionCommand = duckdbCommand
    .command("extension")
    .description("Manage DuckDB extensions used by data query");

  duckdbExtensionCommand
    .command("install")
    .description("Install a managed DuckDB extension for the current runtime")
    .argument("[name]", `Extension name (${DUCKDB_MANAGED_EXTENSION_NAMES.join(", ")})`, parseDuckDbManagedExtensionOption)
    .option("--all-supported", "Install all managed DuckDB extensions", false)
    .action(
      async (
        extensionName: DuckDbManagedExtensionName | undefined,
        options: { allSupported?: boolean },
      ) => {
        await actionDataDuckDbExtensionInstall(runtime, {
          allSupported: options.allSupported,
          extensionName,
        });
      },
    );

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

  dataCommand
    .command("extract")
    .description("Materialize one shaped table from one input file")
    .argument("<input>", "Input data file")
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
    .option("--source-shape <path>", "Reuse an accepted JSON source-shape artifact")
    .option("--codex-suggest-shape", "Ask Codex to suggest an explicit Excel source shape and stop after writing the review artifact", false)
    .option("--write-source-shape <path>", "Write the suggested source-shape artifact to an explicit path")
    .option("--header-mapping <path>", "Reuse an accepted JSON header-mapping artifact")
    .option("--codex-suggest-headers", "Ask Codex to suggest semantic header mappings and stop after writing the review artifact", false)
    .option("--write-header-mapping <path>", "Write the suggested header-mapping artifact to an explicit path")
    .option("-o, --output <path>", "Write the shaped table to a .csv, .tsv, or .json file")
    .option("--overwrite", "Overwrite output file if it already exists", false)
    .action(
      async (
        input: string,
        options: {
          bodyStartRow?: number;
          codexSuggestShape?: boolean;
          codexSuggestHeaders?: boolean;
          headerMapping?: string;
          headerRow?: number;
          inputFormat?: DataQueryInputFormat;
          output?: string;
          overwrite?: boolean;
          range?: string;
          sourceShape?: string;
          source?: string;
          writeHeaderMapping?: string;
          writeSourceShape?: string;
        },
      ) => {
        await actionDataExtract(runtime, {
          bodyStartRow: options.bodyStartRow,
          codexSuggestShape: options.codexSuggestShape,
          codexSuggestHeaders: options.codexSuggestHeaders,
          headerMapping: options.headerMapping,
          headerRow: options.headerRow,
          input,
          inputFormat: options.inputFormat,
          output: options.output,
          overwrite: options.overwrite,
          range: options.range,
          sourceShape: options.sourceShape,
          source: options.source,
          writeHeaderMapping: options.writeHeaderMapping,
          writeSourceShape: options.writeSourceShape,
        });
      },
    );

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
          headerMapping?: string;
          headerRow?: number;
          inputFormat?: DataQueryInputFormat;
          installMissingExtension?: boolean;
          json?: boolean;
          output?: string;
          overwrite?: boolean;
          pretty?: boolean;
          range?: string;
          rows?: number;
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
          output: options.output,
          overwrite: options.overwrite,
          pretty: options.pretty,
          range: options.range,
          rows: options.rows,
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
