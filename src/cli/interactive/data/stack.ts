import { rm, stat } from "node:fs/promises";
import { extname } from "node:path";

import { confirm, input, select } from "@inquirer/prompts";

import { writePreparedDataStackOutput, writePreparedDataStackPlan } from "../../actions";
import { displayPath, printLine } from "../../actions/shared";
import {
  computeDataStackDiagnostics,
  type DataStackDiagnosticsResult,
} from "../../data-stack/diagnostics";
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
  generateDataStackPlanFileName,
  type DataStackDuplicatePolicy,
  type DataStackPlanArtifact,
} from "../../data-stack/plan";
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

const INTERACTIVE_DATA_STACK_DUPLICATE_POLICY: DataStackDuplicatePolicy = "preserve";
const INTERACTIVE_DATA_STACK_UNIQUE_BY: readonly string[] = [];

type InteractiveDataStackWriteOutcome =
  | {
      diagnostics: DataStackDiagnosticsResult;
      kind: "write";
      plan: InteractiveDataStackWritePlan;
      planArtifact: DataStackPlanArtifact;
      planPath: string;
      prepared: PreparedDataStackExecution;
      outputPath: string;
    }
  | { kind: "dry-run" }
  | { kind: "review" }
  | { kind: "cancel" };

type InteractiveDataStackPlanWriteOptions = Omit<
  Parameters<typeof writePreparedDataStackPlan>[1],
  "plan" | "planPath"
>;

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

function renderInteractiveStackStatusPreview(
  runtime: CliRuntime,
  options: {
    diagnostics: DataStackDiagnosticsResult;
    planPath: string;
    prepared: PreparedDataStackExecution;
  },
): void {
  printLine(runtime.stderr, `- row count: ${options.prepared.rows.length}`);
  printLine(
    runtime.stderr,
    `- duplicate rows: ${options.diagnostics.duplicateSummary.exactDuplicateRows}`,
  );
  printLine(runtime.stderr, "- unique key: not selected");
  printLine(
    runtime.stderr,
    `- stack plan: ${displayPath(runtime, resolveFromCwd(runtime, options.planPath))}`,
  );
  printLine(runtime.stderr, "- advisory report: not requested");
}

async function promptInteractiveStackPlanPath(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<string> {
  while (true) {
    const fallbackPlanPath = generateDataStackPlanFileName(runtime.now());
    const chosenPlanPath = await promptOptionalOutputPathChoice({
      message: "Stack plan JSON file",
      defaultHint: fallbackPlanPath,
      kind: "file",
      ...pathPromptContext,
      customMessage: "Custom stack plan JSON path",
    });
    const planPath = chosenPlanPath ?? fallbackPlanPath;
    if (extname(planPath).toLowerCase() === ".json") {
      return planPath;
    }
    printLine(runtime.stdout, "Stack plan file must end with .json.");
  }
}

async function removeInteractiveStackArtifact(runtime: CliRuntime, path: string): Promise<void> {
  await rm(path, { force: true });
  printLine(runtime.stderr, `Removed stack plan: ${displayPath(runtime, path)}`);
}

async function maybeKeepInteractiveStackPlan(runtime: CliRuntime, planPath: string): Promise<void> {
  const keepPlan = await confirm({ message: "Keep stack plan?", default: true });
  if (!keepPlan) {
    await removeInteractiveStackArtifact(runtime, planPath);
  }
}

async function maybeKeepInteractiveStackReport(
  runtime: CliRuntime,
  plan: DataStackPlanArtifact,
): Promise<void> {
  if (!plan.diagnostics.reportPath) {
    return;
  }
  const keepReport = await confirm({ message: "Keep diagnostic/advisory report?", default: true });
  if (!keepReport) {
    await rm(plan.diagnostics.reportPath, { force: true });
    printLine(
      runtime.stderr,
      `Removed diagnostic/advisory report: ${displayPath(runtime, plan.diagnostics.reportPath)}`,
    );
  }
}

function buildInteractiveStackPlanWriteOptions(options: {
  diagnostics: DataStackDiagnosticsResult;
  outputPath: string;
  outputPlan: InteractiveDataStackWritePlan;
  prepared: PreparedDataStackExecution;
  setup: InteractiveDataStackSetup;
}): InteractiveDataStackPlanWriteOptions {
  const sourcePaths = options.setup.sources.map((source) => source.resolved);
  return {
    diagnostics: options.diagnostics,
    duplicatePolicy: INTERACTIVE_DATA_STACK_DUPLICATE_POLICY,
    inputColumns: options.prepared.header,
    outputFormat: options.outputPlan.outputFormat,
    outputPath: options.outputPath,
    overwrite: options.outputPlan.overwrite,
    prepared: options.prepared,
    sourcePaths,
    stackOptions: {
      excludeColumns: options.setup.excludeColumns,
      inputFormat: options.setup.inputFormat,
      output: options.outputPlan.output,
      overwrite: options.outputPlan.overwrite,
      pattern: options.setup.pattern,
      recursive: options.setup.recursive,
      sources: sourcePaths,
      unionByName: options.setup.schemaMode === "union-by-name",
    },
    uniqueBy: INTERACTIVE_DATA_STACK_UNIQUE_BY,
  };
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
    const defaultPlanPath = generateDataStackPlanFileName(runtime.now());
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
    const diagnostics = computeDataStackDiagnostics({
      header: prepared.header,
      matchedFileCount: prepared.files.length,
      rows: prepared.rows,
      uniqueBy: INTERACTIVE_DATA_STACK_UNIQUE_BY,
    });
    const planWriteOptions = buildInteractiveStackPlanWriteOptions({
      diagnostics,
      outputPath,
      outputPlan,
      prepared,
      setup,
    });

    renderInteractiveStackReview(runtime, {
      ...setup,
      ...outputPlan,
      prepared,
    });
    renderInteractiveStackStatusPreview(runtime, {
      diagnostics,
      planPath: defaultPlanPath,
      prepared,
    });
    const nextStep = await select<"write" | "dry-run" | "review" | "destination" | "cancel">({
      message: "Stack action",
      choices: [
        {
          name: "Write now",
          value: "write",
          description: "Write the stacked output and save this stack plan first",
        },
        {
          name: "Dry-run plan only",
          value: "dry-run",
          description: "Save a replayable stack plan without writing stacked output",
        },
        {
          name: "Revise setup",
          value: "review",
          description: "Choose a different source, pattern, traversal, or schema mode",
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
    if (nextStep === "write") {
      const planPath = resolveFromCwd(runtime, defaultPlanPath);
      const planArtifact = await writePreparedDataStackPlan(runtime, {
        ...planWriteOptions,
        planPath,
      });
      return {
        diagnostics,
        kind: "write",
        outputPath,
        plan: outputPlan,
        planArtifact,
        planPath,
        prepared,
      };
    }
    if (nextStep === "dry-run") {
      const chosenPlanPath = resolveFromCwd(
        runtime,
        await promptInteractiveStackPlanPath(runtime, pathPromptContext),
      );
      const planArtifact = await writePreparedDataStackPlan(runtime, {
        ...planWriteOptions,
        planPath: chosenPlanPath,
      });
      printLine(
        runtime.stderr,
        `Dry run: wrote stack plan ${displayPath(runtime, chosenPlanPath)}`,
      );
      await maybeKeepInteractiveStackPlan(runtime, chosenPlanPath);
      await maybeKeepInteractiveStackReport(runtime, planArtifact);
      return { kind: "dry-run" };
    }
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
    if (outcome.kind === "dry-run") {
      return;
    }
    if (outcome.kind === "review") {
      continue;
    }

    try {
      await writePreparedDataStackOutput(runtime, {
        diagnostics: outcome.diagnostics,
        outputFormat: outcome.plan.outputFormat,
        outputPath: outcome.outputPath,
        overwrite: outcome.plan.overwrite,
        prepared: outcome.prepared,
        uniqueBy: INTERACTIVE_DATA_STACK_UNIQUE_BY,
      });
    } catch (error) {
      printLine(
        runtime.stderr,
        `Keeping stack plan after failed write: ${displayPath(runtime, outcome.planPath)}`,
      );
      throw error;
    }
    await maybeKeepInteractiveStackPlan(runtime, outcome.planPath);
    await maybeKeepInteractiveStackReport(runtime, outcome.planArtifact);
    return;
  }
}
