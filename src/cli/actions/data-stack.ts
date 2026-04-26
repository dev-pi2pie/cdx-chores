import { stat } from "node:fs/promises";

import { readTextFileRequired, writeTextFileSafe } from "../file-io";
import { resolveFromCwd } from "../path-utils";
import type { CliRuntime } from "../types";
import {
  generateDataStackCodexReportFileName,
  writeDataStackCodexReportArtifact,
} from "../data-stack/codex-report";
import { suggestDataStackWithCodex, type DataStackCodexRunner } from "../data-stack/codex-assist";
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
  type DataStackPlanMetadata,
} from "../data-stack/plan";
import { prepareDataStackExecution, type PreparedDataStackExecution } from "../data-stack/prepare";
import type {
  DataStackInputFormat,
  DataStackOutputFormat,
  DataStackSchemaModeOption,
} from "../data-stack/types";
import { CliError } from "../errors";
import { assertNonEmpty, displayPath, printLine } from "./shared";

export interface DataStackOptions {
  codexAssist?: boolean;
  codexReportOutput?: string;
  codexRunner?: DataStackCodexRunner;
  codexTimeoutMs?: number;
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
  schemaMode?: DataStackSchemaModeOption;
  unionByName?: boolean;
  uniqueBy?: string[];
  sources: string[];
}

function resolveDataStackSchemaModeOption(options: DataStackOptions): DataStackSchemaModeOption {
  if (
    options.unionByName === true &&
    options.schemaMode &&
    options.schemaMode !== "union-by-name"
  ) {
    throw new CliError(
      "--union-by-name cannot be combined with --schema-mode other than union-by-name.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
  return options.unionByName === true ? "union-by-name" : (options.schemaMode ?? "strict");
}

function validateOptions(options: DataStackOptions): void {
  if (options.sources.length === 0) {
    throw new CliError("At least one input source is required for data stack.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  resolveDataStackSchemaModeOption(options);

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

  if (options.codexAssist && !options.dryRun) {
    throw new CliError("--codex-assist requires --dry-run.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.codexReportOutput?.trim() && !options.codexAssist) {
    throw new CliError("--codex-report-output requires --codex-assist.", {
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
    if (!Number.isFinite(sourceStats.mtimeMs) || !Number.isFinite(sourceStats.size)) {
      return undefined;
    }
    return {
      mtimeMs: sourceStats.mtimeMs,
      sizeBytes: sourceStats.size,
    };
  } catch {
    return undefined;
  }
}

export async function createPreparedDataStackPlan(options: {
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
  metadata?: Partial<
    Omit<DataStackPlanMetadata, "artifactId" | "artifactType" | "issuedAt" | "payloadId">
  >;
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
    metadata: options.metadata,
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

export async function writePreparedDataStackPlan(
  runtime: CliRuntime,
  options: {
    diagnostics: DataStackDiagnosticsResult;
    duplicatePolicy: DataStackDuplicatePolicy;
    inputColumns?: readonly string[];
    outputFormat: DataStackOutputFormat;
    outputPath: string;
    overwrite?: boolean;
    plan?: DataStackPlanArtifact;
    planPath: string;
    prepared: PreparedDataStackExecution;
    sourcePaths: readonly string[];
    stackOptions: DataStackOptions;
    uniqueBy: readonly string[];
    metadata?: Partial<
      Omit<DataStackPlanMetadata, "artifactId" | "artifactType" | "issuedAt" | "payloadId">
    >;
  },
): Promise<DataStackPlanArtifact> {
  const plan =
    options.plan ??
    (await createPreparedDataStackPlan({
      diagnostics: options.diagnostics,
      duplicatePolicy: options.duplicatePolicy,
      inputColumns: options.inputColumns,
      outputFormat: options.outputFormat,
      outputPath: options.outputPath,
      overwrite: options.overwrite,
      prepared: options.prepared,
      runtime,
      sourcePaths: options.sourcePaths,
      stackOptions: options.stackOptions,
      uniqueBy: options.uniqueBy,
      metadata: options.metadata,
    }));
  await writeDataStackPlanArtifact(options.planPath, plan, { overwrite: options.overwrite });
  return plan;
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
  const codexReportPath = options.codexAssist
    ? resolveFromCwd(
        runtime,
        options.codexReportOutput?.trim() || generateDataStackCodexReportFileName(runtime.now()),
      )
    : undefined;
  const sourcePaths = options.sources.map((source) =>
    resolveFromCwd(runtime, assertNonEmpty(source, "Input source")),
  );
  const outputFormat = normalizeDataStackOutputFormat(outputPath);
  const uniqueBy = options.uniqueBy ?? [];
  const duplicatePolicy = options.onDuplicate ?? "preserve";
  const schemaMode = resolveDataStackSchemaModeOption(options);
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
    schemaMode,
    sources: sourcePaths,
  });
  if (options.unionByName === true) {
    printLine(
      runtime.stderr,
      "Warning: --union-by-name is a canary compatibility alias. Use --schema-mode union-by-name.",
    );
  }

  const diagnostics = computeDataStackDiagnostics({
    header: prepared.header,
    matchedFileCount: prepared.files.length,
    reportPath: codexReportPath,
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
    const plan = await writePreparedDataStackPlan(runtime, {
      diagnostics,
      duplicatePolicy,
      inputColumns: options.columns?.length ? options.columns : prepared.header,
      outputFormat,
      outputPath,
      overwrite: options.overwrite,
      planPath,
      prepared,
      sourcePaths,
      stackOptions: options,
      uniqueBy,
    });
    if (options.codexAssist) {
      const reportPath = assertNonEmpty(codexReportPath, "Codex report path");
      let report;
      try {
        report = await suggestDataStackWithCodex({
          diagnostics,
          now: runtime.now(),
          plan,
          runner: options.codexRunner,
          timeoutMs: options.codexTimeoutMs,
          workingDirectory: runtime.cwd,
        });
      } catch (error) {
        if (error instanceof CliError) {
          throw error;
        }
        throw new CliError(
          `Codex stack assist failed: ${error instanceof Error ? error.message : String(error)}`,
          {
            code: "DATA_STACK_CODEX_FAILED",
            exitCode: 2,
          },
        );
      }
      await writeDataStackCodexReportArtifact(reportPath, report, { overwrite: options.overwrite });
      printLine(
        runtime.stderr,
        `Codex assist: wrote advisory report ${displayPath(runtime, reportPath)}`,
      );
      printLine(runtime.stderr, "Codex recommendations were not applied.");
    }
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
