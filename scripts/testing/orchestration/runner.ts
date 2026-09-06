import { requireProcessCapabilities } from "../execution/process-capabilities.ts";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { TOML } from "bun";

import { inspectFixtureExports } from "../fixtures/fixture-exports.ts";
import { inspectFixtureProcesses } from "../fixtures/fixture-process.ts";
import { finalizeRun, type FinalizationReceipt } from "../ownership/finalization.ts";
import {
  createOutputDelivery,
  type OutputDestinations,
  type OutputLimits,
} from "../execution/output.ts";
import { createSuiteEnvironment, parseInvocation } from "../suites/invocation.ts";
import { runSuitePreflight } from "../execution/prerequisites.ts";
import {
  startOwnedProcess,
  type OwnedProcessOptions,
  type OwnedProcessResult,
} from "../execution/process.ts";
import { prepareReport, readReport } from "../reports/report-storage.ts";
import { assertJUnitPassed } from "../reports/report-validation.ts";
import {
  allocateRun,
  assertRunPath,
  assertRunRoot,
  type RunContext,
} from "../ownership/run-context.ts";
import {
  assertUnitDiscoveryConfig,
  discoverSuites,
  exactTestArguments,
  selectTestFiles,
} from "../suites/selection.ts";
import {
  processDiagnostic,
  refreshSummaryState,
  renderSummary,
  type InvocationSummary,
  type LeafSummary,
} from "../terminal/summary.ts";
import { SUITE_POLICIES } from "../suites/suite-policy.ts";
import { createPresentation } from "../terminal/presentation.ts";

/** Internal bounded-fixture seams. None are accepted as command-line flags. */
export interface RunnerDependencies {
  capabilities(): void;
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
  capabilities: requireProcessCapabilities,
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
  streams?: OutputDestinations;
  outputLimits?: OutputLimits;
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
): Promise<{ exitCode: number; summary: InvocationSummary; outputFailed: boolean }> {
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
  const destinations = options.streams ?? { stdout: process.stdout, stderr: process.stderr };
  const output = createOutputDelivery(destinations, options.outputLimits);
  const presentation = createPresentation(output, destinations, sourceEnv);
  const signal = options.signal ? AbortSignal.any([options.signal, output.signal]) : output.signal;
  const recordDelivery = () => {
    for (const issue of output.issues) {
      if (!summary.errors.includes(issue)) summary.errors.push(issue);
    }
    refreshSummaryState(summary);
  };
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
    presentation.start(invocation.suites, invocation.keepResults);
    presentation.stage(undefined, "Validate selection");
    assertUnitDiscoveryConfig(await deps.readConfig(repoRoot));
    const { suites } = await deps.discover(repoRoot);
    // Validate the entire requested membership before allocating or launching prerequisites.
    selectTestFiles(suites, invocation.suites);
    if (signal.aborted) throw new Error("Invocation cancelled before run allocation.");
    presentation.stage(undefined, "Prepare test run");
    if (signal.aborted) throw new Error("Invocation stopped before run allocation.");
    deps.capabilities();
    context = await deps.allocate(repoRoot, invocation.suites, invocation.keepResults);
    for (const leaf of summary.leaves) {
      if (signal.aborted || !safeToClean) break;
      leaf.state = "failed";
      try {
        const env = await deps.environment(context, leaf.suite, sourceEnv);
        if (signal.aborted) throw new Error("Invocation cancelled before preflight.");
        presentation.stage(leaf.suite, "Preflight");
        if (signal.aborted) throw new Error("Invocation stopped before preflight launch.");
        // A thrown launch/completion cannot prove no work remains. Returned results restore proof.
        safeToClean = false;
        const preflight = await deps.preflight({
          suite: leaf.suite,
          repoRoot: context.repoRoot,
          bunExecutable: options.bunExecutable ?? process.execPath,
          env,
          sourceHome: sourceEnv.HOME,
          signal,
        });
        safeToClean = preflight.process.stopped;
        recordProcess(leaf, "preflight", preflight.process);
        if (preflight.error) leaf.errors.push(preflight.error);
        leaf.versions = preflight.versions;
        if (!preflight.process.ok || !safeToClean || preflight.error) continue;
        if (signal.aborted) throw new Error("Invocation cancelled after preflight.");
        const files = selectTestFiles(suites, [leaf.suite]);
        const ticket = await prepareReport(context, leaf.suite);
        if (signal.aborted) throw new Error("Invocation cancelled before tests.");
        presentation.stage(leaf.suite, "Test execution");
        if (signal.aborted) throw new Error("Invocation stopped before test launch.");
        safeToClean = false;
        const result = await deps.execute({
          executable: options.bunExecutable ?? process.execPath,
          args: [
            ...exactTestArguments(files),
            "--reporter=junit",
            "--reporter-outfile=" + ticket.path,
          ],
          cwd: context.repoRoot,
          env: presentation.childEnvironment(env),
          signal: options.signal,
          ...SUITE_POLICIES[leaf.suite].execution,
          maxOutputBytes: 8 * 1024 * 1024,
          output: presentation.testOutput,
        });
        recordProcess(leaf, "test", result);
        await output.flush();
        if (output.failed)
          leaf.errors.push("Test output delivery failed; diagnostics may be incomplete.");
        presentation.stage(leaf.suite, "Validate results", { producerEnded: true });
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
          presentation.stage(leaf.suite, "Validate fixture outputs");
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
      } finally {
        presentation.outcome(leaf);
        await output.flush();
        if (output.failed) {
          leaf.state = "failed";
          const error = "Test output delivery failed; diagnostics may be incomplete.";
          if (!leaf.errors.includes(error)) leaf.errors.push(error);
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
  await output.flush();
  recordDelivery();
  let receipt: FinalizationReceipt | undefined;
  if (context) {
    presentation.stage(undefined, "Cleanup");
    try {
      receipt = await deps.finalize(context, summary, safeToClean);
    } catch (error) {
      summary.errors.push("Finalization: " + errorText(error));
      summary.remainingOwnedPath = context.root;
    }
  }
  refreshSummaryState(summary);
  presentation.finish();
  output.write("stdout", presentation.renderSummary(summary));
  await output.flush();
  if (output.failed) {
    recordDelivery();
    await receipt?.persistFailure();
    await output.fallback(
      "Test invocation failed: terminal output delivery was incomplete.\n" + renderSummary(summary),
    );
    recordDelivery();
    await receipt?.persistFailure();
  }
  output.dispose();
  return { exitCode: summary.state === "passed" ? 0 : 1, summary, outputFailed: output.failed };
}
