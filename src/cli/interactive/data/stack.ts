import { confirm, input, select } from "@inquirer/prompts";
import { relative } from "node:path";

import { writePreparedDataStackOutput } from "../../actions";
import { displayPath, printLine } from "../../actions/shared";
import {
  prepareDataStackExecution,
  type PreparedDataStackExecution,
} from "../../data-stack/prepare";
import { promptFileOutputTarget } from "../../data-workflows/output";
import { readTextFileRequired } from "../../file-io";
import { defaultOutputPath, resolveFromCwd } from "../../path-utils";
import { formatDefaultOutputPathHint } from "../../prompts/path";
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

type InteractiveDataStackWriteOutcome =
  | {
      kind: "confirm";
      plan: InteractiveDataStackWritePlan;
      prepared: PreparedDataStackExecution;
      outputPath: string;
    }
  | { kind: "review" }
  | { kind: "cancel" };

function getInteractiveDataStackDefaultOutputPath(
  directory: string,
  outputFormat: DataStackOutputFormat,
): string {
  return defaultOutputPath(directory, `.stack.${outputFormat}`);
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
  directory: string,
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
  const fallbackOutputPath = getInteractiveDataStackDefaultOutputPath(directory, outputFormat);
  const outputHint = formatDefaultOutputPathHint(runtime, directory, `.stack.${outputFormat}`);
  const target = await promptFileOutputTarget({
    allowedExtensions: [`.${outputFormat}`],
    customMessage: `Custom ${outputFormat.toUpperCase()} output path`,
    defaultHint: outputHint,
    fallbackOutputPath,
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

async function confirmInteractiveStackWrite(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  setup: InteractiveDataStackSetup,
): Promise<InteractiveDataStackWriteOutcome> {
  let outputPlan = await promptInteractiveStackOutput(runtime, setup.directory, pathPromptContext);

  while (true) {
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

    outputPlan = await promptInteractiveStackOutput(runtime, setup.directory, pathPromptContext);
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
