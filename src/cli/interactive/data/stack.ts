import { stat } from "node:fs/promises";
import { extname } from "node:path";

import { confirm, input, select } from "@inquirer/prompts";

import { writePreparedDataStackOutput } from "../../actions";
import { displayPath, printLine } from "../../actions/shared";
import {
  prepareDataStackExecution,
  type PreparedDataStackExecution,
} from "../../data-stack/prepare";
import {
  formatBoundedDataStackNames,
  formatDataStackSchemaMode,
} from "../../data-stack/disclosure";
import { createDataStackDefaultOutputPath } from "../../data-stack/default-output";
import { readTextFileRequired } from "../../file-io";
import { resolveFromCwd } from "../../path-utils";
import { promptOptionalOutputPathChoice } from "../../prompts/path";
import type { CliRuntime } from "../../types";
import {
  DATA_STACK_INTERACTIVE_INPUT_FORMAT_VALUES,
  type DataStackInputFormat,
  type DataStackOutputFormat,
  type DataStackSchemaMode,
} from "../../data-stack/types";
import { writeInteractiveFlowTip } from "../contextual-tip";
import type { InteractivePathPromptContext } from "../shared";

interface InteractiveDataStackSource {
  raw: string;
  resolved: string;
}

interface InteractiveDataStackSetup {
  excludeColumns: string[];
  inputFormat: DataStackInputFormat;
  pattern: string;
  recursive: boolean;
  schemaMode: DataStackSchemaMode;
  sources: InteractiveDataStackSource[];
}

interface InteractiveDataStackWritePlan {
  output: string;
  outputFormat: DataStackOutputFormat;
  overwrite: boolean;
}

type InteractiveDataStackWriteOutcome =
  | {
      kind: "confirm";
      plan: InteractiveDataStackWritePlan;
      prepared: PreparedDataStackExecution;
      outputPath: string;
    }
  | { kind: "review" }
  | { kind: "cancel" };

function renderMatchedFileSummary(
  runtime: CliRuntime,
  options: {
    files: ReadonlyArray<{ path: string }>;
  },
): void {
  const samplePaths = options.files.slice(0, 5).map((file) => displayPath(runtime, file.path));

  printLine(runtime.stderr, `- matched files: ${options.files.length}`);
  if (samplePaths.length > 0) {
    printLine(runtime.stderr, `- sample files: ${samplePaths.join(", ")}`);
  }
}

function renderInteractiveStackReview(
  runtime: CliRuntime,
  options: {
    excludeColumns: readonly string[];
    inputFormat: DataStackInputFormat;
    output: string;
    outputFormat: DataStackOutputFormat;
    overwrite: boolean;
    pattern: string;
    prepared: PreparedDataStackExecution;
    recursive: boolean;
    schemaMode: DataStackSchemaMode;
    sources: readonly InteractiveDataStackSource[];
  },
): void {
  printLine(runtime.stderr, "Stack review");
  printLine(runtime.stderr, "");
  printLine(runtime.stderr, `- input sources: ${options.sources.length}`);
  for (const [index, source] of options.sources.entries()) {
    printLine(runtime.stderr, `  ${index + 1}. ${displayPath(runtime, source.resolved)}`);
  }
  printLine(runtime.stderr, `- input format: ${options.inputFormat.toUpperCase()}`);
  if (options.prepared.files.some((file) => file.sourceKind === "directory")) {
    printLine(runtime.stderr, `- pattern: ${options.pattern}`);
    printLine(runtime.stderr, `- traversal: ${options.recursive ? "recursive" : "shallow only"}`);
  }
  printLine(runtime.stderr, `- schema mode: ${formatDataStackSchemaMode(options.schemaMode)}`);
  printLine(runtime.stderr, `- output columns: ${options.prepared.header.length}`);
  if (options.excludeColumns.length > 0) {
    printLine(
      runtime.stderr,
      `- excluded columns: ${options.excludeColumns.length} (${formatBoundedDataStackNames(options.excludeColumns)})`,
    );
  }
  renderMatchedFileSummary(runtime, {
    files: options.prepared.files,
  });
  printLine(runtime.stderr, `- output format: ${options.outputFormat.toUpperCase()}`);
  printLine(
    runtime.stderr,
    `- output: ${displayPath(runtime, resolveFromCwd(runtime, options.output))}`,
  );
  printLine(runtime.stderr, `- overwrite: ${options.overwrite ? "yes" : "no"}`);
}

async function promptInteractiveStackInputFormat(): Promise<DataStackInputFormat> {
  return await select<DataStackInputFormat>({
    message: "Input format",
    choices: DATA_STACK_INTERACTIVE_INPUT_FORMAT_VALUES.map((format) => ({
      name: format,
      value: format,
    })),
  });
}

async function promptInteractiveStackPattern(inputFormat: DataStackInputFormat): Promise<string> {
  return (
    await input({
      message: "Filename pattern",
      default: `*.${inputFormat}`,
      validate: (value) =>
        String(value).trim().length > 0 ? true : "Enter a filename pattern such as *.csv.",
    })
  ).trim();
}

async function collectInteractiveStackSources(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<InteractiveDataStackSource[]> {
  const { promptRequiredPathWithConfig } = await import("../../prompts/path");
  const sources: InteractiveDataStackSource[] = [];

  while (true) {
    const source = await promptRequiredPathWithConfig(
      sources.length === 0 ? "Input source" : "Additional input source",
      {
        kind: "path",
        ...pathPromptContext,
      },
    );
    sources.push({
      raw: source,
      resolved: resolveFromCwd(runtime, source),
    });

    const addAnother = await confirm({ message: "Add another input source?", default: false });
    if (!addAnother) {
      break;
    }
  }

  return sources;
}

async function promptInteractiveStackTraversalMode(): Promise<boolean> {
  const traversalMode = await select<"shallow" | "recursive">({
    message: "Traversal mode",
    choices: [
      {
        name: "shallow only",
        value: "shallow",
        description: "Scan direct children of the selected directory only",
      },
      {
        name: "recursive",
        value: "recursive",
        description: "Include nested subdirectories",
      },
    ],
  });
  return traversalMode === "recursive";
}

async function promptInteractiveStackSchemaMode(): Promise<DataStackSchemaMode> {
  return await select<DataStackSchemaMode>({
    message: "Schema mode",
    choices: [
      {
        name: "strict",
        value: "strict",
        description: "Require every matched file to use the same columns or keys",
      },
      {
        name: "union by name",
        value: "union-by-name",
        description: "Opt in to named-schema union and fill missing values",
      },
    ],
  });
}

async function promptInteractiveStackExcludeColumns(
  schemaMode: DataStackSchemaMode,
): Promise<string[]> {
  if (schemaMode !== "union-by-name") {
    return [];
  }

  const value = (
    await input({
      message: "Exclude columns or keys (optional, comma-separated)",
    })
  ).trim();

  if (value.length === 0) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

async function collectInteractiveStackSetup(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<InteractiveDataStackSetup> {
  const sources = await collectInteractiveStackSources(runtime, pathPromptContext);
  const inputFormat = await promptInteractiveStackInputFormat();
  const pattern = await promptInteractiveStackPattern(inputFormat);
  const recursive = await promptInteractiveStackTraversalMode();
  const schemaMode = await promptInteractiveStackSchemaMode();
  const excludeColumns = await promptInteractiveStackExcludeColumns(schemaMode);

  return {
    excludeColumns,
    inputFormat,
    pattern,
    recursive,
    schemaMode,
    sources,
  };
}

async function promptInteractiveStackOutput(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<InteractiveDataStackWritePlan> {
  const outputFormat = await select<DataStackOutputFormat>({
    message: "Output format",
    choices: [
      { name: "CSV", value: "csv" },
      { name: "TSV", value: "tsv" },
      { name: "JSON", value: "json" },
    ],
  });

  while (true) {
    const fallbackOutputPath = createDataStackDefaultOutputPath(runtime, outputFormat);
    const chosenOutputPath = await promptOptionalOutputPathChoice({
      message: `Output ${outputFormat.toUpperCase()} file`,
      defaultHint: fallbackOutputPath,
      kind: "file",
      ...pathPromptContext,
      customMessage: `Custom ${outputFormat.toUpperCase()} output path`,
    });
    const output = chosenOutputPath ?? fallbackOutputPath;

    if (extname(output).toLowerCase() !== `.${outputFormat}`) {
      printLine(runtime.stdout, `Output file must end with .${outputFormat}.`);
      continue;
    }

    try {
      await stat(resolveFromCwd(runtime, output));
      const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
      if (overwrite) {
        return { output, outputFormat, overwrite };
      }
      printLine(runtime.stdout, "Choose a different output destination.");
    } catch {
      return { output, outputFormat, overwrite: false };
    }
  }
}

function renderSkippedInteractiveStackWrite(runtime: CliRuntime): void {
  printLine(runtime.stderr, "Skipped stack write.");
}

async function confirmInteractiveStackWrite(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  setup: InteractiveDataStackSetup,
): Promise<InteractiveDataStackWriteOutcome> {
  let outputPlan = await promptInteractiveStackOutput(runtime, pathPromptContext);

  while (true) {
    const outputPath = resolveFromCwd(runtime, outputPlan.output);
    const prepared = await prepareDataStackExecution({
      inputFormat: setup.inputFormat,
      excludeColumns: setup.excludeColumns,
      outputPath,
      pattern: setup.pattern,
      readText: readTextFileRequired,
      recursive: setup.recursive,
      renderPath: (path) => displayPath(runtime, path),
      schemaMode: setup.schemaMode,
      sources: setup.sources.map((source) => source.resolved),
    });

    renderInteractiveStackReview(runtime, {
      ...setup,
      ...outputPlan,
      prepared,
    });
    const confirmed = await confirm({ message: "Write stacked output now?", default: true });
    if (confirmed) {
      return {
        kind: "confirm",
        outputPath,
        plan: outputPlan,
        prepared,
      };
    }

    const nextStep = await select<"review" | "destination" | "cancel">({
      message: "Stack write next step",
      choices: [
        {
          name: "Revise stack setup",
          value: "review",
          description: "Choose a different directory, pattern, or traversal mode",
        },
        {
          name: "Change destination",
          value: "destination",
          description: "Keep the current stack setup and adjust only the output destination",
        },
        {
          name: "Cancel",
          value: "cancel",
          description: "Stop before writing the stacked output",
        },
      ],
    });
    if (nextStep === "review") {
      return { kind: "review" };
    }
    if (nextStep === "cancel") {
      renderSkippedInteractiveStackWrite(runtime);
      return { kind: "cancel" };
    }

    outputPlan = await promptInteractiveStackOutput(runtime, pathPromptContext);
  }
}

export async function runInteractiveDataStack(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<void> {
  writeInteractiveFlowTip(runtime, "data-stack");

  while (true) {
    const setup = await collectInteractiveStackSetup(runtime, pathPromptContext);
    const outcome = await confirmInteractiveStackWrite(runtime, pathPromptContext, setup);
    if (outcome.kind === "cancel") {
      return;
    }
    if (outcome.kind === "review") {
      continue;
    }

    await writePreparedDataStackOutput(runtime, {
      outputFormat: outcome.plan.outputFormat,
      outputPath: outcome.outputPath,
      overwrite: outcome.plan.overwrite,
      prepared: outcome.prepared,
    });
    return;
  }
}
