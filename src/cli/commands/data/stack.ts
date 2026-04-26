import type { Command } from "commander";
import { InvalidArgumentError } from "commander";

import { actionDataStack, actionDataStackReplay } from "../../actions";
import {
  DATA_STACK_DUPLICATE_POLICY_VALUES,
  type DataStackDuplicatePolicy,
} from "../../data-stack/plan";
import {
  DATA_STACK_INPUT_FORMAT_VALUES,
  DATA_STACK_SCHEMA_MODE_OPTION_VALUES,
  type DataStackInputFormat,
  type DataStackSchemaModeOption,
} from "../../data-stack/types";
import { collectCsvListOption, parseNonNegativeIntegerOption } from "../../options/parsers";
import type { CliRuntime } from "../../types";

function parseDataStackInputFormatOption(value: string): DataStackInputFormat {
  const normalized = value.trim().toLowerCase();
  if ((DATA_STACK_INPUT_FORMAT_VALUES as readonly string[]).includes(normalized)) {
    return normalized as DataStackInputFormat;
  }
  throw new InvalidArgumentError(
    `--input-format must be one of: ${DATA_STACK_INPUT_FORMAT_VALUES.join(", ")}.`,
  );
}

function parseDataStackSchemaModeOption(value: string): DataStackSchemaModeOption {
  const normalized = value.trim().toLowerCase();
  if ((DATA_STACK_SCHEMA_MODE_OPTION_VALUES as readonly string[]).includes(normalized)) {
    return normalized as DataStackSchemaModeOption;
  }
  throw new InvalidArgumentError(
    `--schema-mode must be one of: ${DATA_STACK_SCHEMA_MODE_OPTION_VALUES.join(", ")}.`,
  );
}

function parseDataStackDuplicatePolicyOption(value: string): DataStackDuplicatePolicy {
  const normalized = value.trim().toLowerCase();
  if ((DATA_STACK_DUPLICATE_POLICY_VALUES as readonly string[]).includes(normalized)) {
    return normalized as DataStackDuplicatePolicy;
  }
  throw new InvalidArgumentError(
    `--on-duplicate must be one of: ${DATA_STACK_DUPLICATE_POLICY_VALUES.join(", ")}.`,
  );
}

export function registerDataStackCommand(dataCommand: Command, runtime: CliRuntime): void {
  const stackCommand = dataCommand
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
    .option("--no-header", "Treat CSV or TSV inputs as headerless and generate column_n names")
    .option(
      "--columns <names>",
      "Column names for headerless CSV or TSV stacking (comma-separated)",
      collectCsvListOption,
      [],
    )
    .option("--recursive", "Traverse source directories recursively", false)
    .option("--max-depth <value>", "Maximum recursive depth (root=0)", (value: string) =>
      parseNonNegativeIntegerOption(value, "--max-depth"),
    )
    .option("--union-by-name", "Deprecated canary alias for --schema-mode union-by-name", false)
    .option(
      "--schema-mode <mode>",
      `Schema matching mode (${DATA_STACK_SCHEMA_MODE_OPTION_VALUES.join(", ")})`,
      parseDataStackSchemaModeOption,
    )
    .option(
      "--exclude-columns <names>",
      "Exclude named columns or keys from union-by-name output (comma-separated)",
      collectCsvListOption,
      [],
    )
    .option("--dry-run", "Prepare and write a replayable stack plan without writing stack output")
    .option("--plan-output <path>", "Write the dry-run stack plan to a custom JSON path")
    .option(
      "--codex-assist",
      "Ask Codex for advisory stack recommendations and write a report (requires --dry-run)",
    )
    .option("--codex-report-output <path>", "Write the Codex advisory report to a custom JSON path")
    .option("-o, --output <path>", "Write the stacked table to a .csv, .tsv, or .json file")
    .option("--overwrite", "Overwrite output file if it already exists", false)
    .option(
      "--unique-by <names>",
      "Column or key names that must be unique (comma-separated)",
      collectCsvListOption,
      [],
    )
    .option(
      "--on-duplicate <policy>",
      "Duplicate handling policy (preserve, report, reject)",
      parseDataStackDuplicatePolicyOption,
    )
    .action(
      async (
        sources: string[],
        options: {
          codexAssist?: boolean;
          codexReportOutput?: string;
          columns?: string[];
          dryRun?: boolean;
          excludeColumns?: string[];
          header?: boolean;
          inputFormat?: DataStackInputFormat;
          maxDepth?: number;
          noHeader?: boolean;
          onDuplicate?: DataStackDuplicatePolicy;
          output?: string;
          overwrite?: boolean;
          pattern?: string;
          planOutput?: string;
          recursive?: boolean;
          schemaMode?: DataStackSchemaModeOption;
          unionByName?: boolean;
          uniqueBy?: string[];
        },
      ) => {
        await actionDataStack(runtime, {
          codexAssist: options.codexAssist,
          codexReportOutput: options.codexReportOutput,
          columns: (options.columns?.length ?? 0) > 0 ? options.columns : undefined,
          dryRun: options.dryRun,
          excludeColumns:
            (options.excludeColumns?.length ?? 0) > 0 ? options.excludeColumns : undefined,
          inputFormat: options.inputFormat,
          maxDepth: options.maxDepth,
          noHeader: options.noHeader ?? options.header === false,
          onDuplicate: options.onDuplicate,
          output: options.output,
          overwrite: options.overwrite,
          pattern: options.pattern,
          planOutput: options.planOutput,
          recursive: options.recursive,
          schemaMode: options.schemaMode,
          unionByName: options.unionByName,
          uniqueBy: (options.uniqueBy?.length ?? 0) > 0 ? options.uniqueBy : undefined,
          sources,
        });
      },
    );

  stackCommand
    .command("replay")
    .description("Replay a data stack plan artifact")
    .argument("<record>", "Stack plan JSON artifact")
    .option("-o, --output <path>", "Override the plan output path")
    .option("--auto-clean", "Remove the stack plan JSON after successful replay", false)
    .action(
      async (
        record: string,
        options: {
          autoClean?: boolean;
          output?: string;
        },
      ) => {
        await actionDataStackReplay(runtime, {
          autoClean: options.autoClean,
          output: options.output ?? (stackCommand.opts<{ output?: string }>().output || undefined),
          record,
        });
      },
    );
}
