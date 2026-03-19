import { printLine } from "../actions/shared";
import { createDuckDbExtensionInstallCommand } from "../duckdb/extensions";
import type { DataQueryInputFormat } from "../duckdb/query";
import { CliError } from "../errors";
import type { CliRuntime } from "../types";

export function isDuckDbExtensionUnavailableError(error: unknown): error is CliError | { code: string } {
  return (
    (error instanceof CliError && error.code === "DUCKDB_EXTENSION_UNAVAILABLE") ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "DUCKDB_EXTENSION_UNAVAILABLE")
  );
}

export function formatSupportsManagedDuckDbExtensionInstall(
  format: DataQueryInputFormat,
): format is "sqlite" | "excel" {
  return format === "sqlite" || format === "excel";
}

export function canSuggestManagedDuckDbExtensionInstall(
  error: Error | { code: string; message?: string },
): boolean {
  const message = error instanceof Error ? error.message : String(error.message ?? "");
  return !/cannot install or cache it/i.test(message);
}

export function renderDuckDbExtensionRemediationCommand(
  runtime: CliRuntime,
  format: "sqlite" | "excel",
): void {
  printLine(runtime.stderr, "");
  printLine(
    runtime.stderr,
    `Install the missing DuckDB extension with: ${createDuckDbExtensionInstallCommand(format)}`,
  );
}

export function maybeRenderDuckDbExtensionRemediationCommand(
  runtime: CliRuntime,
  format: DataQueryInputFormat,
  error: unknown,
): void {
  if (
    isDuckDbExtensionUnavailableError(error) &&
    formatSupportsManagedDuckDbExtensionInstall(format) &&
    canSuggestManagedDuckDbExtensionInstall(error instanceof Error ? error : new Error(String(error)))
  ) {
    renderDuckDbExtensionRemediationCommand(runtime, format);
  }
}
