import type { DataStackDiagnosticsResult } from "../../data-stack/diagnostics";
import {
  formatBoundedDataStackNames,
  formatDataStackSchemaMode,
} from "../../data-stack/disclosure";
import type { PreparedDataStackExecution } from "../../data-stack/prepare";
import type { DataStackDuplicatePolicy } from "../../data-stack/plan";
import type { DataStackOutputFormat } from "../../data-stack/types";
import type { CliRuntime } from "../../types";
import { displayPath, printLine } from "../shared";

export function renderDataStackDiagnosticsSummary(
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

export function renderDataStackUnionByNameAliasWarning(runtime: CliRuntime): void {
  printLine(
    runtime.stderr,
    "Warning: --union-by-name is a canary compatibility alias. Use --schema-mode union-by-name.",
  );
}

export function renderDataStackCodexReportSummary(
  runtime: CliRuntime,
  options: {
    reportPath: string;
  },
): void {
  printLine(
    runtime.stderr,
    `Codex assist: wrote advisory report ${displayPath(runtime, options.reportPath)}`,
  );
  printLine(runtime.stderr, "Codex recommendations were not applied.");
}

export function renderDryRunSummary(
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

export function renderDataStackOutputSummary(
  runtime: CliRuntime,
  options: {
    diagnostics?: DataStackDiagnosticsResult;
    outputFormat: DataStackOutputFormat;
    outputPath: string;
    prepared: PreparedDataStackExecution;
    uniqueBy?: readonly string[];
  },
): void {
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
