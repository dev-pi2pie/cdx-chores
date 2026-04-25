import { rm, stat } from "node:fs/promises";
import { extname } from "node:path";

import { confirm, editor, input, select } from "@inquirer/prompts";

import {
  applyDataStackCodexRecommendationDecisions,
  createPreparedDataStackPlan,
  generateDataStackCodexReportFileName,
  suggestDataStackWithCodex,
  writeDataStackCodexReportArtifact,
  writePreparedDataStackOutput,
  writePreparedDataStackPlan,
  type DataStackCodexPatch,
  type DataStackCodexRecommendation,
  type DataStackCodexRecommendationDecisionInput,
  type DataStackCodexReportArtifact,
} from "../../actions";
import { displayPath, printLine } from "../../actions/shared";
import {
  computeDataStackDiagnostics,
  enforceDataStackDuplicatePolicy,
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
  type DataStackPlanMetadata,
} from "../../data-stack/plan";
import {
  DATA_STACK_INTERACTIVE_INPUT_FORMAT_VALUES,
  type DataStackInputFormat,
  type DataStackOutputFormat,
  type DataStackSchemaMode,
} from "../../data-stack/types";
import { writeInteractiveFlowTip } from "../contextual-tip";
import { createInteractiveAnalyzerStatus } from "../analyzer-status";
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
const INTERACTIVE_DATA_STACK_CODEX_TIMEOUT_MS = 30_000;

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

interface InteractiveDataStackPreviewState {
  diagnostics: DataStackDiagnosticsResult;
  outputPath: string;
  plan: InteractiveDataStackWritePlan;
  planArtifact?: DataStackPlanArtifact;
  planWriteOptions: InteractiveDataStackPlanWriteOptions;
  prepared: PreparedDataStackExecution;
  setup: InteractiveDataStackSetup;
}

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
    plan?: DataStackPlanArtifact;
    prepared: PreparedDataStackExecution;
  },
): void {
  const uniqueBy = options.plan?.duplicates.uniqueBy ?? INTERACTIVE_DATA_STACK_UNIQUE_BY;
  printLine(runtime.stderr, `- row count: ${options.prepared.rows.length}`);
  printLine(
    runtime.stderr,
    `- duplicate rows: ${options.diagnostics.duplicateSummary.exactDuplicateRows}`,
  );
  if (uniqueBy.length > 0) {
    printLine(runtime.stderr, `- unique key: ${uniqueBy.join(", ")}`);
    printLine(
      runtime.stderr,
      `- duplicate key conflicts: ${options.diagnostics.duplicateSummary.duplicateKeyConflicts}`,
    );
  } else {
    printLine(runtime.stderr, "- unique key: not selected");
  }
  printLine(
    runtime.stderr,
    `- duplicate policy: ${options.plan?.duplicates.policy ?? INTERACTIVE_DATA_STACK_DUPLICATE_POLICY}`,
  );
  printLine(
    runtime.stderr,
    `- stack plan: ${displayPath(runtime, resolveFromCwd(runtime, options.planPath))}`,
  );
  printLine(
    runtime.stderr,
    `- advisory report: ${options.plan?.diagnostics.reportPath ? displayPath(runtime, options.plan.diagnostics.reportPath) : "not requested"}`,
  );
  if ((options.plan?.metadata.recommendationDecisions.length ?? 0) > 0) {
    printLine(
      runtime.stderr,
      `- Codex accepted changes: ${options.plan?.metadata.recommendationDecisions.length}`,
    );
  }
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

function getInteractiveStackPlanMetadata(
  plan: DataStackPlanArtifact,
): Partial<Omit<DataStackPlanMetadata, "artifactId" | "artifactType" | "issuedAt" | "payloadId">> {
  return {
    acceptedRecommendationIds: plan.metadata.acceptedRecommendationIds,
    createdBy: plan.metadata.createdBy,
    derivedFromPayloadId: plan.metadata.derivedFromPayloadId,
    recommendationDecisions: plan.metadata.recommendationDecisions,
  };
}

async function createInteractiveStackPlanArtifact(
  runtime: CliRuntime,
  state: InteractiveDataStackPreviewState,
  metadata?: Partial<
    Omit<DataStackPlanMetadata, "artifactId" | "artifactType" | "issuedAt" | "payloadId">
  >,
): Promise<DataStackPlanArtifact> {
  return await createPreparedDataStackPlan({
    ...state.planWriteOptions,
    runtime,
    metadata,
  });
}

function buildInteractiveStackPlanWriteInput(
  state: InteractiveDataStackPreviewState,
  planPath: string,
  reviewedPlan?: DataStackPlanArtifact,
): Parameters<typeof writePreparedDataStackPlan>[1] {
  return {
    ...state.planWriteOptions,
    ...(reviewedPlan ? { metadata: getInteractiveStackPlanMetadata(reviewedPlan) } : {}),
    planPath,
  };
}

function renderInteractiveCodexRecommendations(
  runtime: CliRuntime,
  recommendations: readonly DataStackCodexRecommendation[],
): void {
  printLine(runtime.stderr, "Codex recommendations");
  if (recommendations.length === 0) {
    printLine(runtime.stderr, "- none");
    return;
  }
  for (const recommendation of recommendations) {
    printLine(
      runtime.stderr,
      `- ${recommendation.id}: ${recommendation.title} (${Math.round(recommendation.confidence * 100)}%)`,
    );
    printLine(runtime.stderr, `  ${recommendation.reasoningSummary}`);
    for (const patch of recommendation.patches) {
      printLine(runtime.stderr, `  ${patch.path}: ${JSON.stringify(patch.value)}`);
    }
  }
}

function renderInteractiveAcceptedCodexChanges(
  runtime: CliRuntime,
  plan: DataStackPlanArtifact,
): void {
  printLine(runtime.stderr, "Accepted Codex changes");
  printLine(runtime.stderr, `- output columns: ${plan.schema.includedNames.join(", ")}`);
  printLine(
    runtime.stderr,
    `- excluded columns: ${plan.schema.excludedNames.length > 0 ? plan.schema.excludedNames.join(", ") : "none"}`,
  );
  printLine(
    runtime.stderr,
    `- unique key: ${plan.duplicates.uniqueBy.length > 0 ? plan.duplicates.uniqueBy.join(", ") : "not selected"}`,
  );
  printLine(runtime.stderr, `- duplicate policy: ${plan.duplicates.policy}`);
}

function parseEditedCodexPatches(value: string): DataStackCodexPatch[] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Edited patches must be a JSON array.");
  }
  return parsed as DataStackCodexPatch[];
}

async function reviewInteractiveCodexRecommendations(
  runtime: CliRuntime,
  report: DataStackCodexReportArtifact,
): Promise<DataStackCodexRecommendationDecisionInput[]> {
  const decisions: DataStackCodexRecommendationDecisionInput[] = [];
  for (const recommendation of report.recommendations) {
    printLine(runtime.stderr, "");
    printLine(runtime.stderr, `Recommendation ${recommendation.id}: ${recommendation.title}`);
    printLine(runtime.stderr, recommendation.reasoningSummary);
    for (const patch of recommendation.patches) {
      printLine(runtime.stderr, `- ${patch.path}: ${JSON.stringify(patch.value)}`);
    }

    const action = await select<"accept" | "edit" | "skip" | "cancel">({
      message: "Codex recommendation review",
      choices: [
        {
          name: "Accept recommendation",
          value: "accept",
          description: "Apply this recommendation to the deterministic stack plan",
        },
        {
          name: "Edit patches",
          value: "edit",
          description: "Edit this recommendation's JSON patches before applying",
        },
        {
          name: "Skip recommendation",
          value: "skip",
          description: "Leave this recommendation out of the stack plan",
        },
        {
          name: "Cancel review",
          value: "cancel",
          description: "Stop reviewing recommendations and keep the current stack setup",
        },
      ],
    });

    if (action === "cancel") {
      return [];
    }
    if (action === "skip") {
      continue;
    }
    if (action === "accept") {
      decisions.push({ decision: "accepted", recommendationId: recommendation.id });
      continue;
    }

    const edited = await editor({
      message: "Edit recommendation patches JSON",
      default: JSON.stringify(recommendation.patches, null, 2),
      postfix: ".json",
      validate: (value) => {
        try {
          parseEditedCodexPatches(String(value ?? ""));
          return true;
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      },
    });
    decisions.push({
      decision: "edited",
      recommendationId: recommendation.id,
      patches: parseEditedCodexPatches(edited),
    });
  }
  return decisions;
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

async function prepareInteractiveStackPreviewState(options: {
  outputPath: string;
  outputPlan: InteractiveDataStackWritePlan;
  planArtifact?: DataStackPlanArtifact;
  runtime: CliRuntime;
  setup: InteractiveDataStackSetup;
}): Promise<InteractiveDataStackPreviewState> {
  const plan = options.planArtifact;
  const sourcePaths = options.setup.sources.map((source) => source.resolved);
  const prepared = await prepareDataStackExecution({
    columns: plan?.input.headerMode === "no-header" ? plan.input.columns : undefined,
    excludeColumns: plan?.schema.excludedNames ?? options.setup.excludeColumns,
    inputFormat: plan?.input.format ?? options.setup.inputFormat,
    noHeader: plan?.input.headerMode === "no-header",
    outputPath: options.outputPath,
    pattern: options.setup.pattern,
    readText: readTextFileRequired,
    recursive: options.setup.recursive,
    renderPath: (path) => displayPath(options.runtime, path),
    schemaMode: plan?.schema.mode ?? options.setup.schemaMode,
    sources: sourcePaths,
  });
  const uniqueBy = plan?.duplicates.uniqueBy ?? INTERACTIVE_DATA_STACK_UNIQUE_BY;
  const diagnostics = computeDataStackDiagnostics({
    header: prepared.header,
    matchedFileCount: prepared.files.length,
    reportPath: plan?.diagnostics.reportPath,
    rows: prepared.rows,
    uniqueBy,
  });
  const planWriteOptions = buildInteractiveStackPlanWriteOptions({
    diagnostics,
    outputPath: options.outputPath,
    outputPlan: options.outputPlan,
    prepared,
    setup: {
      ...options.setup,
      excludeColumns: plan?.schema.excludedNames ?? options.setup.excludeColumns,
      inputFormat: plan?.input.format ?? options.setup.inputFormat,
      schemaMode: plan?.schema.mode ?? options.setup.schemaMode,
    },
  });

  return {
    diagnostics,
    outputPath: options.outputPath,
    plan: options.outputPlan,
    planArtifact: plan,
    planWriteOptions: {
      ...planWriteOptions,
      duplicatePolicy: plan?.duplicates.policy ?? planWriteOptions.duplicatePolicy,
      inputColumns:
        plan?.input.headerMode === "no-header" ? plan.input.columns : planWriteOptions.inputColumns,
      uniqueBy,
    },
    prepared,
    setup: options.setup,
  };
}

async function requestInteractiveStackCodexReview(
  runtime: CliRuntime,
  state: InteractiveDataStackPreviewState,
): Promise<DataStackPlanArtifact | undefined> {
  const reportPath = resolveFromCwd(runtime, generateDataStackCodexReportFileName(runtime.now()));
  const diagnosticsWithReport = computeDataStackDiagnostics({
    header: state.prepared.header,
    matchedFileCount: state.prepared.files.length,
    reportPath,
    rows: state.prepared.rows,
    uniqueBy: state.planArtifact?.duplicates.uniqueBy ?? INTERACTIVE_DATA_STACK_UNIQUE_BY,
  });
  const plan = await createInteractiveStackPlanArtifact(runtime, {
    ...state,
    diagnostics: diagnosticsWithReport,
    planWriteOptions: {
      ...state.planWriteOptions,
      diagnostics: diagnosticsWithReport,
    },
  });

  const status = createInteractiveAnalyzerStatus(runtime.stdout, runtime.colorEnabled);
  let report: DataStackCodexReportArtifact;
  try {
    status.wait("Waiting for Codex stack recommendations");
    report = await suggestDataStackWithCodex({
      diagnostics: diagnosticsWithReport,
      now: runtime.now(),
      plan,
      timeoutMs: INTERACTIVE_DATA_STACK_CODEX_TIMEOUT_MS,
      workingDirectory: runtime.cwd,
    });
  } catch (error) {
    printLine(
      runtime.stderr,
      `Codex stack recommendations failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    printLine(runtime.stderr, "Keeping current deterministic stack setup.");
    return undefined;
  } finally {
    status.stop();
  }

  await writeDataStackCodexReportArtifact(reportPath, report, { overwrite: true });
  printLine(
    runtime.stderr,
    `Codex assist: wrote advisory report ${displayPath(runtime, reportPath)}`,
  );
  renderInteractiveCodexRecommendations(runtime, report.recommendations);
  const decisions = await reviewInteractiveCodexRecommendations(runtime, report);
  if (decisions.length === 0) {
    printLine(runtime.stderr, "No Codex recommendations accepted.");
    return plan;
  }

  try {
    const appliedPlan = applyDataStackCodexRecommendationDecisions({
      decisions,
      now: runtime.now(),
      plan,
      report,
    });
    const nextState = await prepareInteractiveStackPreviewState({
      outputPath: state.outputPath,
      outputPlan: state.plan,
      planArtifact: appliedPlan,
      runtime,
      setup: state.setup,
    });
    const nextPlan = await createInteractiveStackPlanArtifact(
      runtime,
      nextState,
      getInteractiveStackPlanMetadata(appliedPlan),
    );
    renderInteractiveAcceptedCodexChanges(runtime, nextPlan);
    printLine(runtime.stderr, "Re-running stack status preview with accepted Codex changes.");
    return nextPlan;
  } catch (error) {
    printLine(
      runtime.stderr,
      `Codex recommendation application failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    printLine(runtime.stderr, "Keeping current deterministic stack setup.");
    return plan;
  }
}

async function confirmInteractiveStackWrite(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  setup: InteractiveDataStackSetup,
): Promise<InteractiveDataStackWriteOutcome> {
  let outputPlan = await promptInteractiveStackOutput(runtime, pathPromptContext);
  let reviewedPlan: DataStackPlanArtifact | undefined;

  while (true) {
    const outputPath = resolveFromCwd(runtime, outputPlan.output);
    const defaultPlanPath = generateDataStackPlanFileName(runtime.now());
    const state = await prepareInteractiveStackPreviewState({
      outputPath,
      outputPlan,
      planArtifact: reviewedPlan,
      runtime,
      setup,
    });

    renderInteractiveStackReview(runtime, {
      ...setup,
      ...outputPlan,
      prepared: state.prepared,
    });
    renderInteractiveStackStatusPreview(runtime, {
      diagnostics: state.diagnostics,
      plan: reviewedPlan,
      planPath: defaultPlanPath,
      prepared: state.prepared,
    });
    const nextStep = await select<
      "write" | "dry-run" | "codex" | "review" | "destination" | "cancel"
    >({
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
          name: "Request Codex recommendations",
          value: "codex",
          description: "Ask for advisory schema, key, and duplicate-policy suggestions",
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
    if (nextStep === "codex") {
      reviewedPlan = await requestInteractiveStackCodexReview(runtime, state);
      continue;
    }
    if (nextStep === "write") {
      const planPath = resolveFromCwd(runtime, defaultPlanPath);
      const planArtifact = await writePreparedDataStackPlan(
        runtime,
        buildInteractiveStackPlanWriteInput(state, planPath, reviewedPlan),
      );
      return {
        diagnostics: state.diagnostics,
        kind: "write",
        outputPath,
        plan: outputPlan,
        planArtifact,
        planPath,
        prepared: state.prepared,
      };
    }
    if (nextStep === "dry-run") {
      const chosenPlanPath = resolveFromCwd(
        runtime,
        await promptInteractiveStackPlanPath(runtime, pathPromptContext),
      );
      const planArtifact = await writePreparedDataStackPlan(
        runtime,
        buildInteractiveStackPlanWriteInput(state, chosenPlanPath, reviewedPlan),
      );
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
      enforceDataStackDuplicatePolicy({
        diagnostics: outcome.diagnostics,
        policy: outcome.planArtifact.duplicates.policy,
        uniqueBy: outcome.planArtifact.duplicates.uniqueBy,
      });
      await writePreparedDataStackOutput(runtime, {
        diagnostics: outcome.diagnostics,
        outputFormat: outcome.plan.outputFormat,
        outputPath: outcome.outputPath,
        overwrite: outcome.plan.overwrite,
        prepared: outcome.prepared,
        uniqueBy: outcome.planArtifact.duplicates.uniqueBy,
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
