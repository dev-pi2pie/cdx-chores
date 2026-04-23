import type { Command } from "commander";

import { actionDataStack } from "../../actions";
import { DATA_STACK_INPUT_FORMAT_VALUES, type DataStackInputFormat } from "../../data-stack/types";
import { parseNonNegativeIntegerOption } from "../../options/parsers";
import type { CliRuntime } from "../../types";
import { InvalidArgumentError } from "commander";

function parseDataStackInputFormatOption(value: string): DataStackInputFormat {
  const normalized = value.trim().toLowerCase();
  if ((DATA_STACK_INPUT_FORMAT_VALUES as readonly string[]).includes(normalized)) {
    return normalized as DataStackInputFormat;
  }
  throw new InvalidArgumentError(
    `--input-format must be one of: ${DATA_STACK_INPUT_FORMAT_VALUES.join(", ")}.`,
  );
}

export function registerDataStackCommand(dataCommand: Command, runtime: CliRuntime): void {
  dataCommand
    .command("stack")
    .description("Assemble one logical table from multiple input files and directories")
    .argument("<source...>", "Input source file or directory")
    .option(
      "--input-format <format>",
      `Override detected input format (${DATA_STACK_INPUT_FORMAT_VALUES.join(", ")})`,
      parseDataStackInputFormatOption,
    )
    .option(
      "--pattern <glob>",
      "Filter directory-expanded candidates with a glob pattern such as *.csv",
    )
    .option("--recursive", "Traverse source directories recursively", false)
    .option("--max-depth <value>", "Maximum recursive depth (root=0)", (value: string) =>
      parseNonNegativeIntegerOption(value, "--max-depth"),
    )
    .option("-o, --output <path>", "Write the stacked table to a .csv, .tsv, or .json file")
    .option("--overwrite", "Overwrite output file if it already exists", false)
    .action(
      async (
        sources: string[],
        options: {
          inputFormat?: DataStackInputFormat;
          maxDepth?: number;
          output?: string;
          overwrite?: boolean;
          pattern?: string;
          recursive?: boolean;
        },
      ) => {
        await actionDataStack(runtime, {
          inputFormat: options.inputFormat,
          maxDepth: options.maxDepth,
          output: options.output,
          overwrite: options.overwrite,
          pattern: options.pattern,
          recursive: options.recursive,
          sources,
        });
      },
    );
}
