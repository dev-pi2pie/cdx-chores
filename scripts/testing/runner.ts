import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { TOML } from "bun";

import { inspectFixtureExports } from "./fixture-exports.ts";
import { inspectFixtureProcesses } from "./fixture-process.ts";
import { finalizeRun } from "./finalization.ts";
import { createSuiteEnvironment, parseInvocation } from "./invocation.ts";
import { runSuitePreflight } from "./prerequisites.ts";
import { startOwnedProcess, type OwnedProcessOptions, type OwnedProcessResult } from "./process.ts";
import { prepareReport, readReport } from "./report-storage.ts";
import { assertJUnitPassed } from "./report-validation.ts";
import { allocateRun, assertRunPath, assertRunRoot, type RunContext } from "./run-context.ts";
import {
  assertUnitDiscoveryConfig,
  discoverSuites,
  exactTestArguments,
  selectTestFiles,
} from "./selection.ts";
import {
  processDiagnostic,
  refreshSummaryState,
  renderSummary,
  type InvocationSummary,
  type LeafSummary,
} from "./summary.ts";
import { SUITE_POLICIES } from "./suite-policy.ts";

/** Internal bounded-fixture seams. None are accepted as command-line flags. */
export interface RunnerDependencies {
  discover: typeof discoverSuites;
  readConfig(root: string): Promise<unknown>;
  allocate: typeof allocateRun;
  environment: typeof createSuiteEnvironment;
  preflight: typeof runSuitePreflight;
  execute(options: OwnedProcessOptions): Promise<OwnedProcessResult>;
  inspectProcesses: typeof inspectFixtureProcesses;
  inspectExports: typeof inspectFixtureExports;
  finalize: typeof finalizeRun;
}

const defaults: RunnerDependencies = {
  discover: discoverSuites,
  readConfig: async (root) => TOML.parse(await readFile(join(root, "bunfig.toml"), "utf8")),
  allocate: allocateRun,
  environment: createSuiteEnvironment,
  preflight: runSuitePreflight,
  execute: (options) => startOwnedProcess(options).completion,
  inspectProcesses: inspectFixtureProcesses,
  inspectExports: inspectFixtureExports,
  finalize: finalizeRun,
};

export interface RunnerOptions {
  signal?: AbortSignal;
  sourceEnv?: NodeJS.ProcessEnv;
  bunExecutable?: string;
  output?: (text: string) => void;
  dependencies?: Partial<RunnerDependencies>;
}

function errorText(error: unknown): string {
  if (error instanceof AggregateError)
    return [error.message, ...error.errors.map(errorText)].join("; ");
  return error instanceof Error ? error.message : String(error);
}

function recordProcess(
  leaf: LeafSummary,
  stage: "preflight" | "test",
  result: OwnedProcessResult,
): void {
  leaf.processes.push({ stage, result: processDiagnostic(result) });
  if (!result.ok || !result.stopped)
    leaf.errors.push(`${stage} process failed (${result.reason}); stopped=${result.stopped}.`);
  leaf.errors.push(...result.issues.map((issue) => `${stage}: ${issue}`));
}

/** One allocation, one attempt per leaf, and one finalization after all stopped work. */
export async function runManagedTests(
  repoRoot: string,
  args: readonly string[],
  options: RunnerOptions = {},
): Promise<{ exitCode: number; summary: InvocationSummary }> {
  const deps = { ...defaults, ...options.dependencies };
  const sourceEnv = Object.freeze({ ...(options.sourceEnv ?? process.env) });
  const summary: InvocationSummary = {
    schema: 1,
    selected: [],
    keepResults: false,
    state: "failed",
    leaves: [],
    errors: [],
  };
  let context: RunContext | undefined;
  let safeToClean = true;
  const terminalDiagnostics: string[] = [];
  try {
    const invocation = parseInvocation(args);
    summary.selected = [...invocation.suites];
    summary.keepResults = invocation.keepResults;
    summary.leaves = invocation.suites.map((suite) => ({
      suite,
      state: "not-run",
      errors: [],
      processes: [],
    }));
    assertUnitDiscoveryConfig(await deps.readConfig(repoRoot));
    const { suites } = await deps.discover(repoRoot);
    // Validate the entire requested membership before allocating or launching prerequisites.
    selectTestFiles(suites, invocation.suites);
    if (options.signal?.aborted) throw new Error("Invocation cancelled before run allocation.");
    context = await deps.allocate(repoRoot, invocation.suites, invocation.keepResults);
    for (const leaf of summary.leaves) {
      if (options.signal?.aborted || !safeToClean) break;
      leaf.state = "failed";
      try {
        const env = await deps.environment(context, leaf.suite, sourceEnv);
        if (options.signal?.aborted) throw new Error("Invocation cancelled before preflight.");
        // A thrown launch/completion cannot prove no work remains. Returned results restore proof.
        safeToClean = false;
        const preflight = await deps.preflight({
          suite: leaf.suite,
          repoRoot: context.repoRoot,
          bunExecutable: options.bunExecutable ?? process.execPath,
          env,
          sourceHome: sourceEnv.HOME,
          signal: options.signal,
        });
        safeToClean = preflight.process.stopped;
        recordProcess(leaf, "preflight", preflight.process);
        if (preflight.error) leaf.errors.push(preflight.error);
        leaf.versions = preflight.versions;
        if (!preflight.process.ok || !safeToClean || preflight.error) continue;
        if (options.signal?.aborted) throw new Error("Invocation cancelled after preflight.");
        const files = selectTestFiles(suites, [leaf.suite]);
        const ticket = await prepareReport(context, leaf.suite);
        if (options.signal?.aborted) throw new Error("Invocation cancelled before tests.");
        safeToClean = false;
        const result = await deps.execute({
          executable: options.bunExecutable ?? process.execPath,
          args: [
            ...exactTestArguments(files),
            "--reporter=junit",
            "--reporter-outfile=" + ticket.path,
          ],
          cwd: context.repoRoot,
          env,
          signal: options.signal,
          ...SUITE_POLICIES[leaf.suite].execution,
          maxOutputBytes: 8 * 1024 * 1024,
        });
        recordProcess(leaf, "test", result);
        // Keep assertion/stack diagnostics available after default cleanup, but
        // never copy raw streams into the retained invocation summary.
        if (!result.ok && (result.stdout || result.stderr)) {
          terminalDiagnostics.push(
            `${leaf.suite} test diagnostics:\n${result.stdout}${result.stderr}`,
          );
        }
        const nested = deps.inspectProcesses(context, leaf.suite);
        safeToClean = result.stopped && nested.stopped;
        leaf.errors.push(...nested.issues);
        if (safeToClean) {
          if (result.groupId !== undefined) {
            try {
              leaf.counts = await readReport(context, ticket, files);
              assertJUnitPassed(leaf.counts);
            } catch (error) {
              leaf.errors.push("JUnit: " + errorText(error));
            }
          }
          // An exception may mean export ownership or interrupted cleanup is unknown.
          safeToClean = false;
          assertRunPath(context, "results/" + leaf.suite);
          const exports = await deps.inspectExports(context, leaf.suite);
          safeToClean = exports.cleanupVerified;
          leaf.errors.push(...exports.issues);
          if (!exports.ok && !exports.issues.length)
            leaf.errors.push("Fixture export validation failed.");
        }
        if (options.signal?.aborted)
          leaf.errors.push("Invocation cancelled during this suite attempt.");
        if (!leaf.errors.length && result.ok && safeToClean && leaf.counts) leaf.state = "passed";
      } catch (error) {
        leaf.errors.push(errorText(error));
        try {
          assertRunRoot(context);
        } catch (ownerError) {
          safeToClean = false;
          summary.errors.push(errorText(ownerError));
        }
      }
    }
    if (options.signal?.aborted)
      summary.errors.push("Invocation cancelled; remaining suites were not run.");
    if (!safeToClean)
      summary.errors.push(
        "Owned work or ownership remains unverified; scheduling and cleanup stopped.",
      );
  } catch (error) {
    summary.errors.push(errorText(error));
    if (
      error &&
      typeof error === "object" &&
      "remainingRoot" in error &&
      typeof error.remainingRoot === "string"
    ) {
      summary.remainingOwnedPath = error.remainingRoot;
    }
  }
  refreshSummaryState(summary);
  if (context) {
    try {
      await deps.finalize(context, summary, safeToClean);
    } catch (error) {
      summary.errors.push("Finalization: " + errorText(error));
      summary.remainingOwnedPath = context.root;
    }
  }
  refreshSummaryState(summary);
  (options.output ?? console.log)([...terminalDiagnostics, renderSummary(summary)].join("\n"));
  return { exitCode: summary.state === "passed" ? 0 : 1, summary };
}
