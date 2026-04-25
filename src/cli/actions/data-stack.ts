import { stat } from "node:fs/promises";

import { readTextFileRequired, writeTextFileSafe } from "../file-io";
import { resolveFromCwd } from "../path-utils";
import type { CliRuntime } from "../types";
import {
  computeDataStackDiagnostics,
  enforceDataStackDuplicatePolicy,
  type DataStackDiagnosticsResult,
} from "../data-stack/diagnostics";
import { formatBoundedDataStackNames, formatDataStackSchemaMode } from "../data-stack/disclosure";
import { normalizeDataStackOutputFormat } from "../data-stack/formats";
import { materializeDataStackRows } from "../data-stack/materialize";
import {
  createDataStackPlanArtifact,
  DATA_STACK_DUPLICATE_POLICY_VALUES,
  generateDataStackPlanFileName,
  writeDataStackPlanArtifact,
  type DataStackDuplicatePolicy,
  type DataStackPlanArtifact,
} from "../data-stack/plan";
import { prepareDataStackExecution, type PreparedDataStackExecution } from "../data-stack/prepare";
import type { DataStackInputFormat, DataStackOutputFormat } from "../data-stack/types";
import { CliError } from "../errors";
import { assertNonEmpty, displayPath, printLine } from "./shared";

export interface DataStackOptions {
  columns?: string[];
  dryRun?: boolean;
  excludeColumns?: string[];
  inputFormat?: DataStackInputFormat;
  maxDepth?: number;
  noHeader?: boolean;
  onDuplicate?: DataStackDuplicatePolicy;
  output?: string;
  overwrite?: boolean;
  pattern?: string;
  planOutput?: string;
  recursive?: boolean;
  unionByName?: boolean;
  uniqueBy?: string[];
  sources: string[];
}

function validateOptions(options: DataStackOptions): void {
  if (options.sources.length === 0) {
    throw new CliError("At least one input source is required for data stack.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (!options.output?.trim()) {
    throw new CliError("--output is required for data stack runs.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.columns && options.columns.length === 0) {
    throw new CliError("--columns requires at least one column name.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if ((options.columns?.length ?? 0) > 0 && options.noHeader !== true) {
    throw new CliError("--columns requires --no-header.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if ((options.columns?.length ?? 0) > 0) {
    const normalizedColumns =
      options.columns?.map((value) => value.trim()).filter((value) => value.length > 0) ?? [];
    if (normalizedColumns.length !== options.columns?.length) {
      throw new CliError("--columns cannot contain empty names.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    if (
      new Set(normalizedColumns.map((value) => value.toLowerCase())).size !==
      normalizedColumns.length
    ) {
      throw new CliError("--columns cannot contain duplicate names.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
  }

  if (!options.dryRun && options.planOutput?.trim()) {
    throw new CliError("--plan-output requires --dry-run.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (
    options.onDuplicate &&
    !(DATA_STACK_DUPLICATE_POLICY_VALUES as readonly string[]).includes(options.onDuplicate)
  ) {
    throw new CliError(
      `--on-duplicate must be one of: ${DATA_STACK_DUPLICATE_POLICY_VALUES.join(", ")}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  if (options.uniqueBy) {
    const normalizedUniqueBy = options.uniqueBy
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    if (normalizedUniqueBy.length !== options.uniqueBy.length || normalizedUniqueBy.length === 0) {
      throw new CliError("--unique-by requires at least one non-empty column or key name.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    if (
      new Set(normalizedUniqueBy.map((value) => value.toLowerCase())).size !==
      normalizedUniqueBy.length
    ) {
      throw new CliError("--unique-by cannot contain duplicate names.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
  }
}

async function createSourceFingerprint(path: string): Promise<
  | {
      mtimeMs: number;
      sizeBytes: number;
    }
  | undefined
> {
  try {
    const sourceStats = await stat(path);
    return {
      mtimeMs: sourceStats.mtimeMs,
      sizeBytes: sourceStats.size,
    };
  } catch {
    return undefined;
  }
}

async function createPreparedDataStackPlan(options: {
  diagnostics: DataStackDiagnosticsResult;
  duplicatePolicy: DataStackDuplicatePolicy;
  inputColumns?: readonly string[];
  outputFormat: DataStackOutputFormat;
  outputPath: string;
  overwrite?: boolean;
  prepared: PreparedDataStackExecution;
  runtime: CliRuntime;
  sourcePaths: readonly string[];
  stackOptions: DataStackOptions;
  uniqueBy: readonly string[];
}): Promise<DataStackPlanArtifact> {
  return createDataStackPlanArtifact({
    diagnostics: options.diagnostics.planDiagnostics,
    duplicates: {
      duplicateKeyConflicts: options.diagnostics.duplicateSummary.duplicateKeyConflicts,
      exactDuplicateRows: options.diagnostics.duplicateSummary.exactDuplicateRows,
      policy: options.duplicatePolicy,
      uniqueBy: [...options.uniqueBy],
    },
    input: {
      columns: options.stackOptions.noHeader ? [...(options.inputColumns ?? [])] : [],
      format: options.prepared.inputFormat,
      headerMode: options.stackOptions.noHeader ? "no-header" : "header",
    },
    now: options.runtime.now(),
    output: {
      format: options.outputFormat,
      overwrite: options.overwrite ?? false,
      path: options.outputPath,
    },
    schema: {
      excludedNames: [...options.prepared.excludedColumns],
      includedNames: [...options.prepared.header],
      mode: options.prepared.schemaMode,
    },
    sources: {
      baseDirectory: options.runtime.cwd,
      maxDepth: options.stackOptions.maxDepth ?? null,
      pattern: options.stackOptions.pattern?.trim() || null,
      raw: [...options.sourcePaths],
      recursive: options.stackOptions.recursive ?? false,
      resolved: await Promise.all(
        options.prepared.files.map(async (file) => ({
          fingerprint: await createSourceFingerprint(file.path),
          kind: "file" as const,
          path: file.path,
        })),
      ),
    },
  });
}

function renderDataStackDiagnosticsSummary(
  runtime: CliRuntime,
  options: {
    diagnostics: DataStackDiagnosticsResult;
    uniqueBy: readonly string[];
  },
): void {
  printLine(
    runtime.stderr,
    `Exact duplicate rows: ${options.diagnostics.duplicateSummary.exactDuplicateRows}`,
  );
  if (options.uniqueBy.length > 0) {
    printLine(runtime.stderr, `Unique key: ${options.uniqueBy.join(", ")}`);
    printLine(
      runtime.stderr,
      `Duplicate key conflicts: ${options.diagnostics.duplicateSummary.duplicateKeyConflicts}`,
    );
    if (options.diagnostics.duplicateKeyNullRows > 0) {
      printLine(runtime.stderr, `Null key rows: ${options.diagnostics.duplicateKeyNullRows}`);
    }
  }
}

function renderDryRunSummary(
  runtime: CliRuntime,
  options: {
    duplicatePolicy: DataStackDuplicatePolicy;
    outputFormat: DataStackOutputFormat;
    outputPath: string;
    planPath: string;
    prepared: PreparedDataStackExecution;
    diagnostics: DataStackDiagnosticsResult;
    uniqueBy: readonly string[];
  },
): void {
  printLine(runtime.stderr, `Dry run: wrote stack plan ${displayPath(runtime, options.planPath)}`);
  printLine(runtime.stderr, `Files: ${options.prepared.files.length}`);
  printLine(runtime.stderr, `Rows: ${options.prepared.rows.length}`);
  printLine(runtime.stderr, `Columns: ${options.prepared.header.length}`);
  printLine(
    runtime.stderr,
    `Schema mode: ${formatDataStackSchemaMode(options.prepared.schemaMode)}`,
  );
  printLine(
    runtime.stderr,
    `Output: ${options.outputFormat.toUpperCase()} ${displayPath(runtime, options.outputPath)}`,
  );
  printLine(runtime.stderr, `Duplicate policy: ${options.duplicatePolicy}`);
  renderDataStackDiagnosticsSummary(runtime, {
    diagnostics: options.diagnostics,
    uniqueBy: options.uniqueBy,
  });
}

export async function writePreparedDataStackOutput(
  runtime: CliRuntime,
  options: {
    diagnostics?: DataStackDiagnosticsResult;
    outputFormat: DataStackOutputFormat;
    outputPath: string;
    overwrite?: boolean;
    prepared: PreparedDataStackExecution;
    uniqueBy?: readonly string[];
  },
): Promise<void> {
  const text = materializeDataStackRows({
    format: options.outputFormat,
    header: options.prepared.header,
    rows: options.prepared.rows,
  });

  await writeTextFileSafe(options.outputPath, text, { overwrite: options.overwrite });
  printLine(
    runtime.stderr,
    `Wrote ${options.outputFormat.toUpperCase()}: ${displayPath(runtime, options.outputPath)}`,
  );
  printLine(runtime.stderr, `Files: ${options.prepared.files.length}`);
  printLine(runtime.stderr, `Rows: ${options.prepared.rows.length}`);
  printLine(
    runtime.stderr,
    `Schema mode: ${formatDataStackSchemaMode(options.prepared.schemaMode)}`,
  );
  printLine(runtime.stderr, `Columns: ${options.prepared.header.length}`);
  if (options.prepared.excludedColumns.length > 0) {
    printLine(
      runtime.stderr,
      `Excluded columns: ${options.prepared.excludedColumns.length} (${formatBoundedDataStackNames(options.prepared.excludedColumns)})`,
    );
  }
  if (options.diagnostics) {
    renderDataStackDiagnosticsSummary(runtime, {
      diagnostics: options.diagnostics,
      uniqueBy: options.uniqueBy ?? [],
    });
  }
}

export async function actionDataStack(
  runtime: CliRuntime,
  options: DataStackOptions,
): Promise<void> {
  validateOptions(options);

  const outputPath = resolveFromCwd(runtime, assertNonEmpty(options.output, "Output path"));
  const sourcePaths = options.sources.map((source) =>
    resolveFromCwd(runtime, assertNonEmpty(source, "Input source")),
  );
  const outputFormat = normalizeDataStackOutputFormat(outputPath);
  const uniqueBy = options.uniqueBy ?? [];
  const duplicatePolicy = options.onDuplicate ?? "preserve";
  const prepared = await prepareDataStackExecution({
    columns: options.columns,
    excludeColumns: options.excludeColumns,
    inputFormat: options.inputFormat,
    maxDepth: options.maxDepth,
    noHeader: options.noHeader,
    outputPath,
    pattern: options.pattern?.trim() || undefined,
    readText: readTextFileRequired,
    recursive: options.recursive,
    renderPath: (path) => displayPath(runtime, path),
    schemaMode: options.unionByName === true ? "union-by-name" : "strict",
    sources: sourcePaths,
  });

  const diagnostics = computeDataStackDiagnostics({
    header: prepared.header,
    matchedFileCount: prepared.files.length,
    rows: prepared.rows,
    uniqueBy,
  });
  if (!options.dryRun) {
    enforceDataStackDuplicatePolicy({
      diagnostics,
      policy: duplicatePolicy,
      uniqueBy,
    });
  }

  if (options.dryRun) {
    const planPath = resolveFromCwd(
      runtime,
      options.planOutput?.trim() || generateDataStackPlanFileName(runtime.now()),
    );
    const plan = await createPreparedDataStackPlan({
      diagnostics,
      duplicatePolicy,
      inputColumns: options.columns?.length ? options.columns : prepared.header,
      outputFormat,
      outputPath,
      overwrite: options.overwrite,
      prepared,
      runtime,
      sourcePaths,
      stackOptions: options,
      uniqueBy,
    });
    await writeDataStackPlanArtifact(planPath, plan, { overwrite: options.overwrite });
    renderDryRunSummary(runtime, {
      diagnostics,
      duplicatePolicy,
      outputFormat,
      outputPath,
      planPath,
      prepared,
      uniqueBy,
    });
    return;
  }

  await writePreparedDataStackOutput(runtime, {
    diagnostics,
    outputFormat,
    outputPath,
    overwrite: options.overwrite,
    prepared,
    uniqueBy,
  });
}
