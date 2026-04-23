import { confirm, input, select } from "@inquirer/prompts";
import { relative } from "node:path";

import { writePreparedDataStackOutput } from "../../actions";
import { displayPath, printLine } from "../../actions/shared";
import { prepareDataStackExecution, type PreparedDataStackExecution } from "../../data-stack/prepare";
import { promptFileOutputTarget } from "../../data-workflows/output";
import { readTextFileRequired } from "../../file-io";
import { resolveFromCwd } from "../../path-utils";
import type { CliRuntime } from "../../types";
import {
  DATA_STACK_INTERACTIVE_INPUT_FORMAT_VALUES,
  type DataStackDelimitedInputFormat,
  type DataStackOutputFormat,
} from "../../data-stack/types";
import { writeInteractiveFlowTip } from "../contextual-tip";
import type { InteractivePathPromptContext } from "../shared";

interface InteractiveDataStackSetup {
  directory: string;
  directoryPath: string;
  inputFormat: DataStackDelimitedInputFormat;
  pattern: string;
  recursive: boolean;
}

interface InteractiveDataStackWritePlan {
  output: string;
  outputFormat: DataStackOutputFormat;
  overwrite: boolean;
}

function renderMatchedFileSummary(
  runtime: CliRuntime,
  options: {
    directoryPath: string;
    files: ReadonlyArray<{ path: string }>;
  },
): void {
  const samplePaths = options.files
    .slice(0, 5)
    .map((file) => relative(options.directoryPath, file.path).replaceAll("\\", "/"));

  printLine(runtime.stderr, `- matched files: ${options.files.length}`);
  if (samplePaths.length > 0) {
    printLine(runtime.stderr, `- sample files: ${samplePaths.join(", ")}`);
  }
}

function renderInteractiveStackReview(
  runtime: CliRuntime,
  options: {
    directory: string;
    directoryPath: string;
    inputFormat: DataStackDelimitedInputFormat;
    output: string;
    outputFormat: DataStackOutputFormat;
    overwrite: boolean;
    pattern: string;
    prepared: PreparedDataStackExecution;
    recursive: boolean;
  },
): void {
  printLine(runtime.stderr, "Stack review");
  printLine(runtime.stderr, "");
  printLine(
    runtime.stderr,
    `- input directory: ${displayPath(runtime, resolveFromCwd(runtime, options.directory))}`,
  );
  printLine(runtime.stderr, `- input format: ${options.inputFormat.toUpperCase()}`);
  printLine(runtime.stderr, `- pattern: ${options.pattern}`);
  printLine(runtime.stderr, `- traversal: ${options.recursive ? "recursive" : "shallow only"}`);
  renderMatchedFileSummary(runtime, {
    directoryPath: options.directoryPath,
    files: options.prepared.files,
  });
  printLine(runtime.stderr, `- output format: ${options.outputFormat.toUpperCase()}`);
  printLine(
    runtime.stderr,
    `- output: ${displayPath(runtime, resolveFromCwd(runtime, options.output))}`,
  );
  printLine(runtime.stderr, `- overwrite: ${options.overwrite ? "yes" : "no"}`);
}

async function promptInteractiveStackInputFormat(): Promise<DataStackDelimitedInputFormat> {
  return await select<DataStackDelimitedInputFormat>({
    message: "Input format",
    choices: DATA_STACK_INTERACTIVE_INPUT_FORMAT_VALUES.map((format) => ({
      name: format,
      value: format,
    })),
  });
}

async function promptInteractiveStackPattern(
  inputFormat: DataStackDelimitedInputFormat,
): Promise<string> {
  return (
    await input({
      message: "Filename pattern",
      default: `*.${inputFormat}`,
      validate: (value) =>
        String(value).trim().length > 0 ? true : "Enter a filename pattern such as *.csv.",
    })
  ).trim();
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

async function collectInteractiveStackSetup(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<InteractiveDataStackSetup> {
  const { promptRequiredPathWithConfig } = await import("../../prompts/path");
  const directory = await promptRequiredPathWithConfig("Input directory", {
    kind: "directory",
    ...pathPromptContext,
  });
  const directoryPath = resolveFromCwd(runtime, directory);
  const inputFormat = await promptInteractiveStackInputFormat();
  const pattern = await promptInteractiveStackPattern(inputFormat);
  const recursive = await promptInteractiveStackTraversalMode();

  return {
    directory,
    directoryPath,
    inputFormat,
    pattern,
    recursive,
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
  const target = await promptFileOutputTarget({
    allowedExtensions: [`.${outputFormat}`],
    invalidExtensionMessage: `Output file must end with .${outputFormat}.`,
    message: `Output ${outputFormat.toUpperCase()} file`,
    pathPromptContext,
    runtime,
  });
  return {
    output: target.output,
    outputFormat,
    overwrite: target.overwrite,
  };
}

function renderSkippedInteractiveStackWrite(runtime: CliRuntime): void {
  printLine(runtime.stderr, "Skipped stack write.");
}

export async function runInteractiveDataStack(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<void> {
  writeInteractiveFlowTip(runtime, "data-stack");

  while (true) {
    const setup = await collectInteractiveStackSetup(runtime, pathPromptContext);
    const outputPlan = await promptInteractiveStackOutput(runtime, pathPromptContext);
    const outputPath = resolveFromCwd(runtime, outputPlan.output);
    const prepared = await prepareDataStackExecution({
      inputFormat: setup.inputFormat,
      outputPath,
      pattern: setup.pattern,
      readText: readTextFileRequired,
      recursive: setup.recursive,
      renderPath: (path) => displayPath(runtime, path),
      sources: [setup.directoryPath],
    });

    renderInteractiveStackReview(runtime, {
      ...setup,
      ...outputPlan,
      prepared,
    });
    const confirmed = await confirm({ message: "Write stacked output now?", default: true });
    if (confirmed) {
      await writePreparedDataStackOutput(runtime, {
        outputFormat: outputPlan.outputFormat,
        outputPath,
        overwrite: outputPlan.overwrite,
        prepared,
      });
      return;
    }

    const nextStep = await select<"revise" | "cancel">({
      message: "Stack review next step",
      choices: [
        {
          name: "Revise stack setup",
          value: "revise",
          description: "Choose a different directory, pattern, traversal mode, or output",
        },
        {
          name: "Cancel",
          value: "cancel",
          description: "Stop before writing the stacked output",
        },
      ],
    });
    if (nextStep === "cancel") {
      renderSkippedInteractiveStackWrite(runtime);
      return;
    }
  }
}
