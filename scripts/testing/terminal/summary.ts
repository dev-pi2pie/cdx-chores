import { lstatSync } from "node:fs";
import { createColors } from "picocolors";

import type { OwnedProcessResult } from "../execution/process.ts";
import type { JUnitSummary } from "../reports/report-validation.ts";
import type { Suite } from "../suites/selection.ts";

export interface LeafSummary {
  suite: Suite;
  state: "passed" | "failed" | "not-run";
  versions?: Record<string, string>;
  counts?: JUnitSummary;
  errors: string[];
  processes: Array<{
    stage: "preflight" | "test";
    result: Omit<OwnedProcessResult, "stdout" | "stderr">;
  }>;
}

export interface InvocationSummary {
  schema: 1;
  selected: Suite[];
  keepResults: boolean;
  state: "passed" | "failed";
  leaves: LeafSummary[];
  errors: string[];
  remainingOwnedPath?: string;
  retainedResultsPath?: string;
}

/** Raw process streams can contain fixture data and never belong in the run summary. */
export function processDiagnostic(
  result: OwnedProcessResult,
): Omit<OwnedProcessResult, "stdout" | "stderr"> {
  const { stdout: _stdout, stderr: _stderr, ...diagnostic } = result;
  return diagnostic;
}

export function refreshSummaryState(summary: InvocationSummary): void {
  summary.state =
    summary.selected.length > 0 &&
    new Set(summary.selected).size === summary.selected.length &&
    summary.leaves.length === summary.selected.length &&
    new Set(summary.leaves.map((leaf) => leaf.suite)).size === summary.leaves.length &&
    summary.errors.length === 0 &&
    summary.selected.every((suite) =>
      summary.leaves.some(
        (leaf) => leaf.suite === suite && leaf.state === "passed" && leaf.errors.length === 0,
      ),
    )
      ? "passed"
      : "failed";
}

function existingDirectory(path: string | undefined): path is string {
  if (!path) return false;
  try {
    const stat = lstatSync(path);
    return stat.isDirectory() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

function existingLocation(path: string | undefined): path is string {
  if (!path) return false;
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

/** Render from the in-memory record, including after default results have been removed. */
export function renderSummary(
  summary: InvocationSummary,
  options: { color?: boolean; groupProcessDetails?: boolean } = {},
): string {
  const colors = createColors(options.color ?? false);
  const stateColor = (state: string) =>
    state === "passed" ? colors.green : state === "failed" ? colors.red : colors.yellow;
  const lines = [colors.bold(stateColor(summary.state)("Test invocation: " + summary.state))];
  const processDetails: string[] = [];
  for (const leaf of summary.leaves) {
    lines.push(stateColor(leaf.state)(leaf.suite + ": " + leaf.state));
    if (leaf.counts) {
      const count = leaf.counts;
      lines.push(
        `  ${count.tests} cases, ${count.assertions} assertions, ${count.failures} failures, ${count.errors} errors, ${count.skipped} skipped, ${count.files.length} files, ${count.durationSeconds}s`,
      );
    }
    if (leaf.versions && Object.keys(leaf.versions).length)
      lines.push(
        "  Versions: " +
          Object.entries(leaf.versions)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([name, version]) => name + "=" + version)
            .join(", "),
      );
    for (const error of leaf.errors) lines.push(colors.red("  " + error));
    const details = options.groupProcessDetails ? processDetails : lines;
    if (options.groupProcessDetails && leaf.processes.length) details.push(leaf.suite + ":");
    for (const { stage, result } of leaf.processes) {
      details.push(
        `  ${stage}: ${result.reason}; exit=${result.exitCode ?? "none"}; signal=${result.signal ?? "none"}; stopped=${result.stopped}; escalated=${result.escalated}; elapsed=${result.elapsedMs}ms; drain=${result.drainMs ?? "unknown"}ms`,
      );
      if (result.pid !== undefined || result.groupId !== undefined)
        details.push(`    pid=${result.pid ?? "unknown"}; group=${result.groupId ?? "unknown"}`);
      for (const issue of result.issues) details.push(colors.red("    " + issue));
      if (result.signals.length)
        details.push(
          "    Termination signals: " +
            result.signals.map((entry) => entry.signal + "@" + entry.elapsedMs + "ms").join(", "),
        );
    }
  }
  for (const error of summary.errors) lines.push(colors.red("Run failure: " + error));
  lines.push(
    existingDirectory(summary.retainedResultsPath)
      ? "Retained results: " + summary.retainedResultsPath
      : "No results were retained.",
  );
  if (existingLocation(summary.remainingOwnedPath))
    lines.push("Remaining owned location: " + summary.remainingOwnedPath);
  if (processDetails.length) {
    lines.push("", colors.dim("Process diagnostics:"), ...processDetails);
  }
  return lines.join("\n") + "\n";
}
