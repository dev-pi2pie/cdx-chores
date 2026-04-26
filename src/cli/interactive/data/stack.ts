import { lstat, rm, stat } from "node:fs/promises";
import { extname } from "node:path";

import { confirm, editor, input, select } from "@inquirer/prompts";

import {
  applyDataStackCodexRecommendationDecisions,
  createPreparedDataStackPlan,
  formatDataStackCodexAssistFailure,
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
  formatDataStackCodexAssistSignal,
  getDataStackCodexAssistSignals,
  type DataStackCodexAssistSignal,
} from "../../data-stack/codex-signals";
import {
  prepareDataStackExecution,
  type PreparedDataStackExecution,
} from "../../data-stack/prepare";
import {
  resolveDataStackInputSources,
  type DataStackNormalizedInputFile,
} from "../../data-stack/input-router";
import {
  formatBoundedDataStackNames,
  formatDataStackSchemaMode,
} from "../../data-stack/disclosure";
import { createDataStackDefaultOutputPath } from "../../data-stack/default-output";
import { CliError } from "../../errors";
import { readTextFileRequired } from "../../file-io";
import { resolveFromCwd } from "../../path-utils";
import { promptOptionalOutputPathChoice } from "../../prompts/path";
import type { CliRuntime } from "../../types";
import { getCliColors } from "../../colors";
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
  type DataStackSchemaModeOption,
} from "../../data-stack/types";
import { isSupportedDataStackDiscoveryPath } from "../../data-stack/formats";
import { writeInteractiveFlowTip } from "../contextual-tip";
import { createInteractiveAnalyzerStatus } from "../analyzer-status";
import type { InteractivePathPromptContext } from "../shared";

interface InteractiveDataStackSourcePath {
  raw: string;
  resolved: string;
}

interface InteractiveDataStackSource extends InteractiveDataStackSourcePath {
  kind: "directory" | "file";
}

interface InteractiveDataStackSetup {
  excludeColumns: string[];
  inputFormat: DataStackInputFormat;
  pattern?: string;
  recursive: boolean;
  schemaMode: DataStackSchemaModeOption;
  sources: InteractiveDataStackSource[];
}

interface InteractiveDataStackSourceDiscoveryState {
  inputFormat: DataStackInputFormat;
  pattern?: string;
  recursive: boolean;
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

type InteractiveDataStackMatchedFileAction = "accept" | "options" | "sources" | "cancel";
type InteractiveDataStackSourceDiscoveryOption = "pattern" | "recursive" | "format" | "back";

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
  requestedSchemaMode: DataStackSchemaModeOption;
  resolvedSchemaMode: DataStackSchemaMode;
  setup: InteractiveDataStackSetup;
}

const INTERACTIVE_STACK_PREVIEW_SAMPLE_LIMIT = 5;

function createInteractiveStackPreviewSample<T>(items: readonly T[]): {
  hiddenCount: number;
  sample: T[];
} {
  const sample = items.slice(0, INTERACTIVE_STACK_PREVIEW_SAMPLE_LIMIT);
  return {
    hiddenCount: Math.max(items.length - sample.length, 0),
    sample,
  };
}

function renderMatchedFileSummary(
  runtime: CliRuntime,
  options: {
    files: ReadonlyArray<{ path: string }>;
  },
): void {
  const { hiddenCount, sample } = createInteractiveStackPreviewSample(options.files);
  const samplePaths = sample.map((file) => displayPath(runtime, file.path));

  printLine(runtime.stderr, `- matched files: ${options.files.length}`);
  if (samplePaths.length > 0) {
    printLine(
      runtime.stderr,
      `- sample files (first ${samplePaths.length}): ${samplePaths.join(", ")}`,
    );
  }
  if (hiddenCount > 0) {
    printLine(runtime.stderr, `- sample files hidden: ${hiddenCount}`);
  }
}

function renderInteractiveInputSourceSummary(
  runtime: CliRuntime,
  sources: readonly InteractiveDataStackSource[],
): void {
  const { hiddenCount, sample } = createInteractiveStackPreviewSample(sources);
  printLine(runtime.stderr, `- input sources: ${sources.length}`);
  for (const [index, source] of sample.entries()) {
    printLine(runtime.stderr, `  ${index + 1}. ${displayPath(runtime, source.resolved)}`);
  }
  if (hiddenCount > 0) {
    printLine(runtime.stderr, `  ... ${hiddenCount} more input source(s) hidden`);
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
    pattern?: string;
    prepared: PreparedDataStackExecution;
    recursive: boolean;
    requestedSchemaMode: DataStackSchemaModeOption;
    schemaMode: DataStackSchemaMode;
    sources: readonly InteractiveDataStackSource[];
  },
): void {
  printLine(runtime.stderr, "Stack review");
  printLine(runtime.stderr, "");
  printLine(runtime.stderr, "Input discovery");
  renderInteractiveInputSourceSummary(runtime, options.sources);
  printLine(runtime.stderr, `- input format: ${options.inputFormat.toUpperCase()}`);
  if (usesInteractiveDirectoryDiscovery(options.sources)) {
    printLine(
      runtime.stderr,
      `- pattern: ${formatInteractiveStackPattern(options.pattern, options.inputFormat)}`,
    );
    printLine(runtime.stderr, `- traversal: ${options.recursive ? "recursive" : "shallow only"}`);
  }
  renderMatchedFileSummary(runtime, {
    files: options.prepared.files,
  });
  printLine(runtime.stderr, "");
  printLine(runtime.stderr, "Schema analysis");
  printLine(runtime.stderr, `- schema mode: ${formatDataStackSchemaMode(options.schemaMode)}`);
  if (options.requestedSchemaMode === "auto") {
    printLine(
      runtime.stderr,
      `- schema analysis: auto -> ${formatDataStackSchemaMode(options.schemaMode)}`,
    );
  }
  printLine(runtime.stderr, `- output columns: ${options.prepared.header.length}`);
  if (options.excludeColumns.length > 0) {
    printLine(
      runtime.stderr,
      `- excluded columns: ${options.excludeColumns.length} (${formatBoundedDataStackNames(options.excludeColumns)})`,
    );
  }
  printLine(runtime.stderr, "");
  printLine(runtime.stderr, "Output target");
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
  printLine(runtime.stderr, "");
  printLine(runtime.stderr, "Duplicate and key diagnostics");
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

function assertInteractiveStackPlanPathIsReplayable(options: {
  outputPath: string;
  planPath: string;
  runtime: CliRuntime;
}): void {
  if (options.planPath !== options.outputPath) {
    return;
  }
  throw new CliError(
    `Stack plan path cannot be the same as stack output path: ${displayPath(options.runtime, options.planPath)}.`,
    {
      code: "INVALID_INPUT",
      exitCode: 2,
    },
  );
}

async function maybeKeepInteractiveStackPlan(runtime: CliRuntime, planPath: string): Promise<void> {
  const keepPlan = await confirm({ message: "Keep stack plan?", default: true });
  if (!keepPlan) {
    await removeInteractiveStackArtifact(runtime, planPath);
    return;
  }
  renderInteractiveStackReplayTip(runtime, planPath);
}

function renderInteractiveStackReplayTip(runtime: CliRuntime, planPath: string): void {
  const pc = getCliColors(runtime);
  const replayCommand = `cdx-chores data stack replay ${displayPath(runtime, planPath)}`;
  printLine(runtime.stderr, `${pc.yellow("Replay later:")} ${pc.cyan(replayCommand)}`);
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
      schemaMode: options.prepared.schemaMode,
      sources: sourcePaths,
      unionByName: options.prepared.schemaMode === "union-by-name",
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

function getInteractiveStackCodexAssistSignals(
  state: InteractiveDataStackPreviewState,
): DataStackCodexAssistSignal[] {
  const plan = state.planArtifact;
  const uniqueBy = plan?.duplicates.uniqueBy ?? INTERACTIVE_DATA_STACK_UNIQUE_BY;

  return getDataStackCodexAssistSignals({
    diagnostics: state.diagnostics,
    headerMode: plan?.input.headerMode ?? "header",
    inputColumns: plan?.input.columns ?? state.prepared.header,
    schemaMode: plan?.schema.mode ?? state.resolvedSchemaMode,
    uniqueBy,
  });
}

function createInteractiveStackCodexSignalKey(
  state: InteractiveDataStackPreviewState,
  signals: readonly DataStackCodexAssistSignal[],
): string {
  const uniqueBy = state.planArtifact?.duplicates.uniqueBy ?? INTERACTIVE_DATA_STACK_UNIQUE_BY;
  return JSON.stringify({
    duplicateKeyConflicts: state.diagnostics.duplicateSummary.duplicateKeyConflicts,
    exactDuplicateRows: state.diagnostics.duplicateSummary.exactDuplicateRows,
    header: state.prepared.header,
    schemaMode: state.planArtifact?.schema.mode ?? state.resolvedSchemaMode,
    signals,
    uniqueBy,
  });
}

async function promptInteractiveStackCodexCheckpoint(
  runtime: CliRuntime,
  signals: readonly DataStackCodexAssistSignal[],
): Promise<"codex" | "continue" | "review" | "cancel"> {
  printLine(runtime.stderr, "Codex-powered analysis checkpoint");
  printLine(
    runtime.stderr,
    `- signals: ${signals.map(formatDataStackCodexAssistSignal).join(", ")}`,
  );

  return await select<"codex" | "continue" | "review" | "cancel">({
    message: "Codex-powered analysis checkpoint",
    choices: [
      {
        name: "Analyze with Codex",
        value: "codex",
        description: "Ask for advisory schema, key, and duplicate-policy suggestions",
      },
      {
        name: "Continue without Codex",
        value: "continue",
        description: "Keep the deterministic stack setup and choose a final action",
      },
      {
        name: "Revise setup",
        value: "review",
        description: "Choose a different source, pattern, traversal, or schema mode",
      },
      {
        name: "Cancel",
        value: "cancel",
        description: "Stop before writing the stacked output",
      },
    ],
  });
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

function formatInteractiveStackPattern(
  pattern: string | undefined,
  inputFormat: DataStackInputFormat,
): string {
  return pattern ?? `format default (*.${inputFormat})`;
}

function usesInteractiveDirectoryDiscovery(
  sources: readonly InteractiveDataStackSource[],
): boolean {
  return sources.some((source) => source.kind === "directory");
}

async function inferInteractiveStackSourceKind(
  source: InteractiveDataStackSourcePath,
): Promise<"directory" | "file"> {
  try {
    const sourceStats = await lstat(source.resolved);
    if (sourceStats.isFile()) {
      return "file";
    }
    if (sourceStats.isDirectory()) {
      return "directory";
    }
  } catch {
    // Let the later resolver produce the user-facing missing-source error.
  }

  return isSupportedDataStackDiscoveryPath(source.raw) ? "file" : "directory";
}

function renderInteractiveStackSourceDiscovery(
  runtime: CliRuntime,
  options: {
    files: readonly DataStackNormalizedInputFile[];
    inputFormat: DataStackInputFormat;
    pattern?: string;
    recursive: boolean;
    sources: readonly InteractiveDataStackSource[];
  },
): void {
  printLine(runtime.stderr, "Source discovery");
  printLine(runtime.stderr, "");
  renderInteractiveInputSourceSummary(runtime, options.sources);
  printLine(runtime.stderr, `- input format: ${options.inputFormat.toUpperCase()}`);
  if (usesInteractiveDirectoryDiscovery(options.sources)) {
    printLine(
      runtime.stderr,
      `- pattern: ${formatInteractiveStackPattern(options.pattern, options.inputFormat)}`,
    );
    printLine(runtime.stderr, `- traversal: ${options.recursive ? "recursive" : "shallow only"}`);
  } else {
    printLine(runtime.stderr, "- pattern: skipped for explicit file sources");
  }
  renderMatchedFileSummary(runtime, { files: options.files });
}

async function promptInteractiveStackMatchedFiles(options: {
  allowAccept: boolean;
  allowOptions: boolean;
}): Promise<InteractiveDataStackMatchedFileAction> {
  return await select<InteractiveDataStackMatchedFileAction>({
    message: "Matched files",
    choices: [
      ...(options.allowAccept
        ? [
            {
              name: "Use these files",
              value: "accept" as const,
              description: "Continue to dry-run, schema, and duplicate setup",
            },
          ]
        : []),
      ...(options.allowOptions
        ? [
            {
              name: "Options",
              value: "options" as const,
              description: "Change source discovery settings and preview again",
            },
          ]
        : []),
      {
        name: "Revise sources",
        value: "sources",
        description: "Choose input files or directories again",
      },
      {
        name: "Cancel",
        value: "cancel",
        description: "Stop before preparing the stack plan",
      },
    ],
  });
}

async function promptInteractiveStackSourceDiscoveryOptions(options: {
  recursive: boolean;
}): Promise<InteractiveDataStackSourceDiscoveryOption> {
  return await select<InteractiveDataStackSourceDiscoveryOption>({
    message: "Source discovery options",
    choices: [
      {
        name: "Change filename pattern",
        value: "pattern",
        description: "Override the selected format's default filename match",
      },
      {
        name: options.recursive ? "Use shallow scan" : "Scan subdirectories",
        value: "recursive",
        description: options.recursive
          ? "Preview direct children only"
          : "Include nested subdirectories in the preview",
      },
      {
        name: "Change input format",
        value: "format",
        description: "Choose CSV, TSV, JSON, or JSONL and preview again",
      },
      {
        name: "Back to matched files",
        value: "back",
        description: "Return without changing source discovery settings",
      },
    ],
  });
}

function renderInteractiveStackDryRunPrimer(runtime: CliRuntime): void {
  printLine(runtime.stderr, "");
  printLine(runtime.stderr, "Dry-run path");
  printLine(
    runtime.stderr,
    "- save a replayable stack plan without writing output; later run data stack replay <record>",
  );
}

async function collectInteractiveStackSources(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<InteractiveDataStackSourcePath[]> {
  const { promptRequiredPathWithConfig } = await import("../../prompts/path");
  const sources: InteractiveDataStackSourcePath[] = [];

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

async function addInteractiveStackSourceKinds(
  sources: readonly InteractiveDataStackSourcePath[],
): Promise<InteractiveDataStackSource[]> {
  return await Promise.all(
    sources.map(async (source) => ({
      ...source,
      kind: await inferInteractiveStackSourceKind(source),
    })),
  );
}

async function updateInteractiveStackSourceDiscoveryState(
  state: InteractiveDataStackSourceDiscoveryState,
  sourcePaths: readonly InteractiveDataStackSourcePath[],
): Promise<InteractiveDataStackSourceDiscoveryState> {
  const discoveryOption = await promptInteractiveStackSourceDiscoveryOptions({
    recursive: state.recursive,
  });

  switch (discoveryOption) {
    case "pattern":
      return {
        ...state,
        pattern: await promptInteractiveStackPattern(state.inputFormat),
      };
    case "recursive":
      return {
        ...state,
        recursive: !state.recursive,
      };
    case "format": {
      const inputFormat = await promptInteractiveStackInputFormat();
      return {
        inputFormat,
        pattern: undefined,
        recursive: state.recursive,
        sources: await addInteractiveStackSourceKinds(sourcePaths),
      };
    }
    case "back":
      return state;
  }
}

async function promptInteractiveStackSchemaMode(): Promise<DataStackSchemaModeOption> {
  return await select<DataStackSchemaModeOption>({
    message: "Schema mode",
    choices: [
      {
        name: "Automatic schema check",
        value: "auto",
        description: "Use strict when possible, then deterministic union by name when safe",
      },
      {
        name: "Strict matching",
        value: "strict",
        description: "Require every matched file to use the same columns or keys",
      },
      {
        name: "Union by name",
        value: "union-by-name",
        description: "Opt in to named-schema union and fill missing values",
      },
    ],
  });
}

async function promptInteractiveStackExcludeColumns(
  schemaMode: DataStackSchemaModeOption,
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

async function collectInteractiveStackMatchedFiles(options: {
  inputFormat: DataStackInputFormat;
  runtime: CliRuntime;
  sourcePaths: readonly InteractiveDataStackSourcePath[];
}): Promise<
  | {
      inputFormat: DataStackInputFormat;
      pattern?: string;
      recursive: boolean;
      sources: InteractiveDataStackSource[];
    }
  | "sources"
  | "cancel"
> {
  let state: InteractiveDataStackSourceDiscoveryState = {
    inputFormat: options.inputFormat,
    pattern: undefined,
    recursive: false,
    sources: await addInteractiveStackSourceKinds(options.sourcePaths),
  };

  while (true) {
    const usesDirectorySource = usesInteractiveDirectoryDiscovery(state.sources);
    try {
      const preview = await resolveDataStackInputSources({
        inputFormat: state.inputFormat,
        pattern: state.pattern,
        recursive: state.recursive,
        sources: state.sources.map((source) => source.resolved),
      });
      renderInteractiveStackSourceDiscovery(options.runtime, {
        files: preview.files,
        inputFormat: state.inputFormat,
        pattern: state.pattern,
        recursive: state.recursive,
        sources: state.sources,
      });

      const previewAction = await promptInteractiveStackMatchedFiles({
        allowAccept: true,
        allowOptions: usesDirectorySource,
      });
      switch (previewAction) {
        case "accept":
          return state;
        case "options":
          state = await updateInteractiveStackSourceDiscoveryState(state, options.sourcePaths);
          continue;
        case "sources":
          return "sources";
        case "cancel":
          return "cancel";
      }
    } catch (error) {
      printLine(
        options.runtime.stderr,
        `Matched-file preview failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      const previewAction = await promptInteractiveStackMatchedFiles({
        allowAccept: false,
        allowOptions: usesDirectorySource,
      });
      switch (previewAction) {
        case "options":
          state = await updateInteractiveStackSourceDiscoveryState(state, options.sourcePaths);
          continue;
        case "sources":
          return "sources";
        case "cancel":
          return "cancel";
        case "accept":
          continue;
      }
    }
  }
}

async function collectInteractiveStackSetup(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<InteractiveDataStackSetup | undefined> {
  while (true) {
    const rawSources = await collectInteractiveStackSources(runtime, pathPromptContext);
    const inputFormat = await promptInteractiveStackInputFormat();
    const matchedFiles = await collectInteractiveStackMatchedFiles({
      inputFormat,
      runtime,
      sourcePaths: rawSources,
    });
    switch (matchedFiles) {
      case "sources":
        continue;
      case "cancel":
        return undefined;
      default: {
        renderInteractiveStackDryRunPrimer(runtime);
        const schemaMode = await promptInteractiveStackSchemaMode();
        const excludeColumns = await promptInteractiveStackExcludeColumns(schemaMode);
        return {
          excludeColumns,
          inputFormat: matchedFiles.inputFormat,
          pattern: matchedFiles.pattern,
          recursive: matchedFiles.recursive,
          schemaMode,
          sources: matchedFiles.sources,
        };
      }
    }
  }
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
    requestedSchemaMode: options.setup.schemaMode,
    resolvedSchemaMode: prepared.schemaMode,
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
    printLine(runtime.stderr, formatDataStackCodexAssistFailure(error));
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
  let handledCodexSignalKey: string | undefined;

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
      requestedSchemaMode: state.requestedSchemaMode,
      schemaMode: state.prepared.schemaMode,
    });
    renderInteractiveStackStatusPreview(runtime, {
      diagnostics: state.diagnostics,
      plan: reviewedPlan,
      planPath: defaultPlanPath,
      prepared: state.prepared,
    });

    const codexSignals = getInteractiveStackCodexAssistSignals(state);
    const codexSignalKey = createInteractiveStackCodexSignalKey(state, codexSignals);
    const hasReviewedCodexChanges =
      (state.planArtifact?.metadata.recommendationDecisions.length ?? 0) > 0;
    if (
      codexSignals.length > 0 &&
      handledCodexSignalKey !== codexSignalKey &&
      !hasReviewedCodexChanges
    ) {
      const checkpointAction = await promptInteractiveStackCodexCheckpoint(runtime, codexSignals);
      if (checkpointAction === "codex") {
        handledCodexSignalKey = codexSignalKey;
        reviewedPlan = await requestInteractiveStackCodexReview(runtime, state);
        continue;
      }
      if (checkpointAction === "review") {
        return { kind: "review" };
      }
      if (checkpointAction === "cancel") {
        renderSkippedInteractiveStackWrite(runtime);
        return { kind: "cancel" };
      }
      handledCodexSignalKey = codexSignalKey;
    }

    const nextStep = await select<"write" | "dry-run" | "review" | "destination" | "cancel">({
      message: "Stack plan action",
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
      assertInteractiveStackPlanPathIsReplayable({ outputPath, planPath, runtime });
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
      assertInteractiveStackPlanPathIsReplayable({
        outputPath,
        planPath: chosenPlanPath,
        runtime,
      });
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
    if (!setup) {
      renderSkippedInteractiveStackWrite(runtime);
      return;
    }
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
