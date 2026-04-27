import { rm } from "node:fs/promises";
import { extname } from "node:path";

import { confirm } from "@inquirer/prompts";

import {
  createPreparedDataStackPlan,
  writeDataStackCodexReportArtifact,
  writePreparedDataStackPlan,
} from "../../../actions";
import { displayPath, printLine } from "../../../actions/shared";
import type { DataStackDiagnosticsResult } from "../../../data-stack/diagnostics";
import {
  generateDataStackPlanFileName,
  type DataStackPlanArtifact,
  type DataStackPlanMetadata,
} from "../../../data-stack/plan";
import type { PreparedDataStackExecution } from "../../../data-stack/prepare";
import { getCliColors } from "../../../colors";
import { CliError } from "../../../errors";
import { promptOptionalOutputPathChoice } from "../../../prompts/path";
import type { CliRuntime } from "../../../types";
import type { InteractivePathPromptContext } from "../../shared";

import {
  INTERACTIVE_DATA_STACK_DUPLICATE_POLICY,
  INTERACTIVE_DATA_STACK_UNIQUE_BY,
  type InteractiveDataStackPlanWriteOptions,
  type InteractiveDataStackPreviewState,
  type InteractiveDataStackReviewedPlan,
  type InteractiveDataStackSetup,
  type InteractiveDataStackWritePlan,
} from "./types";

export async function promptInteractiveStackPlanPath(
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

export function assertInteractiveStackPlanPathIsReplayable(options: {
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

export function assertInteractiveStackPlanPathDoesNotOverlapInputs(options: {
  planPath: string;
  prepared: PreparedDataStackExecution;
  runtime: CliRuntime;
}): void {
  const collidingInput = options.prepared.files.find((file) => file.path === options.planPath);
  if (!collidingInput) {
    return;
  }
  throw new CliError(
    `Stack plan path cannot be the same as an input source: ${displayPath(options.runtime, options.planPath)}.`,
    {
      code: "INVALID_INPUT",
      exitCode: 2,
    },
  );
}

export async function maybeKeepInteractiveStackPlan(
  runtime: CliRuntime,
  planPath: string,
): Promise<void> {
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

export function buildInteractiveStackPlanWriteOptions(options: {
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

export function getInteractiveStackPlanMetadata(
  plan: DataStackPlanArtifact,
): Partial<Omit<DataStackPlanMetadata, "artifactId" | "artifactType" | "issuedAt" | "payloadId">> {
  return {
    acceptedRecommendationIds: plan.metadata.acceptedRecommendationIds,
    createdBy: plan.metadata.createdBy,
    derivedFromPayloadId: plan.metadata.derivedFromPayloadId,
    recommendationDecisions: plan.metadata.recommendationDecisions,
  };
}

export async function createInteractiveStackPlanArtifact(
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

function setInteractiveStackDiagnosticsReportPath(
  diagnostics: DataStackDiagnosticsResult,
  reportPath: string | null,
): DataStackDiagnosticsResult {
  return {
    ...diagnostics,
    planDiagnostics: {
      ...diagnostics.planDiagnostics,
      reportPath,
    },
  };
}

function setInteractiveStackPlanReportPath(
  plan: DataStackPlanArtifact,
  reportPath: string | null,
): DataStackPlanArtifact {
  const next = structuredClone(plan) as DataStackPlanArtifact;
  next.diagnostics.reportPath = reportPath;
  return next;
}

function setInteractiveStackStateReportPath(
  state: InteractiveDataStackPreviewState,
  reportPath: string | null,
): InteractiveDataStackPreviewState {
  const diagnostics = setInteractiveStackDiagnosticsReportPath(state.diagnostics, reportPath);
  return {
    ...state,
    diagnostics,
    planArtifact: state.planArtifact
      ? setInteractiveStackPlanReportPath(state.planArtifact, reportPath)
      : undefined,
    planWriteOptions: {
      ...state.planWriteOptions,
      diagnostics,
    },
  };
}

type InteractiveStackReportPersistenceDecision = "none" | "keep" | "discard";

function normalizeInteractiveStackReportPersistence(options: {
  decision: InteractiveStackReportPersistenceDecision;
  reviewedPlan?: InteractiveDataStackReviewedPlan;
  state: InteractiveDataStackPreviewState;
}): {
  reviewedPlan?: DataStackPlanArtifact;
  state: InteractiveDataStackPreviewState;
} {
  if (!options.reviewedPlan?.report || options.decision === "none") {
    return {
      reviewedPlan: options.reviewedPlan?.plan,
      state: options.state,
    };
  }

  if (options.decision === "discard") {
    return {
      reviewedPlan: setInteractiveStackPlanReportPath(options.reviewedPlan.plan, null),
      state: setInteractiveStackStateReportPath(options.state, null),
    };
  }

  return {
    reviewedPlan: options.reviewedPlan.plan,
    state: options.state,
  };
}

export async function resolveInteractiveStackReportPersistence(
  runtime: CliRuntime,
  state: InteractiveDataStackPreviewState,
  reviewedPlan?: InteractiveDataStackReviewedPlan,
): Promise<{
  reviewedPlan?: DataStackPlanArtifact;
  state: InteractiveDataStackPreviewState;
}> {
  if (!reviewedPlan?.report) {
    return normalizeInteractiveStackReportPersistence({
      decision: "none",
      reviewedPlan,
      state,
    });
  }

  const keepReport = await confirm({ message: "Keep diagnostic/advisory report?", default: true });
  if (!keepReport) {
    printLine(runtime.stderr, "Skipped diagnostic/advisory report.");
    return normalizeInteractiveStackReportPersistence({
      decision: "discard",
      reviewedPlan,
      state,
    });
  }

  await writeDataStackCodexReportArtifact(reviewedPlan.report.path, reviewedPlan.report.artifact, {
    overwrite: true,
  });
  printLine(
    runtime.stderr,
    `Codex assist: wrote advisory report ${displayPath(runtime, reviewedPlan.report.path)}`,
  );
  return normalizeInteractiveStackReportPersistence({
    decision: "keep",
    reviewedPlan,
    state,
  });
}

export function buildInteractiveStackPlanWriteInput(
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
