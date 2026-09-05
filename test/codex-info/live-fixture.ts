import { startFixtureProcess } from "../../scripts/testing/fixtures/fixture-process.ts";
import {
  flushFixtureExports,
  removeFixtureDir,
} from "../../scripts/testing/fixtures/fixture-exports.ts";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import {
  type OwnedProcess,
  type OwnedProcessOptions,
  type OwnedProcessResult,
} from "../../scripts/testing/execution/process.ts";
import { createTempFixtureDir } from "../helpers/cli-test-utils";

// Unresolved ownership survives individual cases: this process must stop scheduling.
let unresolvedScratch: string | undefined;

function assertLaunchAllowed(): void {
  if (unresolvedScratch) {
    throw new Error(
      `Earlier process completion is unverified; retained scratch: ${unresolvedScratch}`,
    );
  }
}

export function lifecycleDiagnostic(result: OwnedProcessResult): string {
  return JSON.stringify({
    pid: result.pid,
    groupId: result.groupId,
    reason: result.reason,
    exitCode: result.exitCode,
    signal: result.signal,
    stopped: result.stopped,
    escalated: result.escalated,
    issues: result.issues,
  });
}

function cleanupFailure(result: OwnedProcessResult): Error | undefined {
  // A protocol case may deliberately exercise a rejected configuration (exit 1).
  // Its original assertion owns that exit; cleanup owns group/stream completion.
  if (result.stopped && (result.ok || result.reason === "exit-failed") && !result.issues.length) {
    return undefined;
  }
  return new Error(`Codex fixture lifecycle failed: ${lifecycleDiagnostic(result)}`);
}

function shutdownIfRunning(owned: OwnedProcess): void {
  if (owned.child.exitCode === null && owned.child.signalCode === null) owned.shutdown();
}

/** Isolated live-only support. Registration and prerequisite probing stay in the test. */
export async function withLiveCodexFixture(
  run: (fixture: {
    root: string;
    cwd: string;
    env: NodeJS.ProcessEnv;
    start: (
      options: Pick<OwnedProcessOptions, "executable" | "args"> & {
        env?: NodeJS.ProcessEnv;
        timeoutMs?: number;
      },
    ) => OwnedProcess;
    close: (owned: OwnedProcess) => Promise<void>;
  }) => Promise<void>,
): Promise<void> {
  assertLaunchAllowed();
  const root = await createTempFixtureDir("codex-live-protocol");
  const recordCompletion = (result: OwnedProcessResult): OwnedProcessResult => {
    if (!result.stopped) unresolvedScratch ??= root;
    return result;
  };
  const owned: OwnedProcess[] = [];
  const abort = new AbortController();
  const cancel = () => abort.abort();
  // The whole fixture must finish cleanup before the live test's 120-second limit.
  const deadline = setTimeout(cancel, 90_000);
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  let failed = false;
  let failure: unknown;
  const errors: Error[] = [];
  try {
    const cwd = join(root, "project");
    for (const directory of ["home/.codex", "tmp", "project", "config", "data", "cache"]) {
      await mkdir(join(root, directory), { recursive: true });
    }
    // Never forward account state, API keys, user configuration, or ancestor Git state.
    const env: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      HOME: join(root, "home"),
      TMPDIR: join(root, "tmp"),
      XDG_CONFIG_HOME: join(root, "config"),
      XDG_DATA_HOME: join(root, "data"),
      XDG_CACHE_HOME: join(root, "cache"),
      GIT_CEILING_DIRECTORIES: root,
    };
    await run({
      root,
      cwd,
      env,
      start: (options) => {
        assertLaunchAllowed();
        const spawned = startFixtureProcess({
          timeoutMs: 30_000,
          graceMs: 1000,
          cleanupMs: 3000,
          cwd,
          env,
          signal: abort.signal,
          ...options,
        });
        // Record before callers awaiting completion can schedule another command.
        const child = { ...spawned, completion: spawned.completion.then(recordCompletion) };
        owned.push(child);
        return child;
      },
      close: async (child) => {
        shutdownIfRunning(child);
        const error = cleanupFailure(recordCompletion(await child.completion));
        if (error) throw error;
      },
    });
  } catch (error) {
    failed = true;
    failure = error;
  } finally {
    for (const child of owned) shutdownIfRunning(child);
    const results = await Promise.all(owned.map((child) => child.completion));
    results.forEach(recordCompletion);
    errors.push(...results.map(cleanupFailure).filter((error) => error !== undefined));
    if (results.every((result) => result.stopped)) {
      try {
        await flushFixtureExports(root, !failed && errors.length === 0);
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
      try {
        await removeFixtureDir(root);
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    } else {
      errors.push(new Error(`Process completion unverified; retained scratch: ${root}`));
    }
    process.off("SIGINT", cancel);
    process.off("SIGTERM", cancel);
    clearTimeout(deadline);
    if (abort.signal.aborted) errors.push(new Error("Codex fixture was cancelled."));
  }
  if (errors.length) {
    throw new AggregateError(failed ? [failure, ...errors] : errors, "Codex fixture failed.");
  }
  if (failed) throw failure;
}
