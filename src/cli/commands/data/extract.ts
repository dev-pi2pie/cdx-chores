import type { Command } from "commander";

import { actionDataExtract } from "../../actions";
import { DATA_QUERY_INPUT_FORMAT_VALUES, type DataQueryInputFormat } from "../../duckdb/query";
import { parseDataQueryInputFormatOption, parsePositiveIntegerOption } from "../../options/parsers";
import type { CliRuntime } from "../../types";

export function registerDataExtractCommand(dataCommand: Command, runtime: CliRuntime): void {
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
}
