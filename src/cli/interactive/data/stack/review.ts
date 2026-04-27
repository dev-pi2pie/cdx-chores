import { displayPath, printLine } from "../../../actions/shared";
import {
  computeDataStackDiagnostics,
  type DataStackDiagnosticsResult,
} from "../../../data-stack/diagnostics";
import {
  formatBoundedDataStackNames,
  formatDataStackSchemaMode,
} from "../../../data-stack/disclosure";
import {
  prepareDataStackExecution,
  type PreparedDataStackExecution,
} from "../../../data-stack/prepare";
import type { DataStackPlanArtifact } from "../../../data-stack/plan";
import type {
  DataStackInputFormat,
  DataStackOutputFormat,
  DataStackSchemaMode,
  DataStackSchemaModeOption,
} from "../../../data-stack/types";
import { readTextFileRequired } from "../../../file-io";
import { resolveFromCwd } from "../../../path-utils";
import type { CliRuntime } from "../../../types";

import { buildInteractiveStackPlanWriteOptions } from "./artifacts";
import {
  formatInteractiveStackPattern,
  INTERACTIVE_DATA_STACK_DUPLICATE_POLICY,
  INTERACTIVE_DATA_STACK_UNIQUE_BY,
  usesInteractiveDirectoryDiscovery,
  type InteractiveDataStackPreviewState,
  type InteractiveDataStackSetup,
  type InteractiveDataStackSource,
  type InteractiveDataStackWritePlan,
} from "./types";

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

export function renderMatchedFileSummary(
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

export function renderInteractiveInputSourceSummary(
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

export function renderInteractiveStackReview(
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

export function renderInteractiveStackStatusPreview(
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

export async function prepareInteractiveStackPreviewState(options: {
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
