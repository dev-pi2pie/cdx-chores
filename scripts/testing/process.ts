import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { isLiveProcess, observeProcessGroup, type ProcessMember } from "./process-table.ts";

export interface ProcessLimits {
  timeoutMs: number;
  /** Normal descendant/stream drain and requested graceful shutdown allowance. */
  graceMs: number;
  /** Total termination budget, including grace, escalation, and verification. */
  cleanupMs: number;
}

export interface OwnedProcessOptions extends ProcessLimits {
  executable: string;
  args: readonly string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  maxOutputBytes?: number;
}

export type StopReason = "shutdown" | "timeout" | "cancelled" | "output-limit" | "unverified";

export interface ProcessObservation {
  elapsedMs: number;
  members: ProcessMember[];
}

export interface OwnedProcessResult {
  ok: boolean;
  reason: StopReason | "completed" | "exit-failed" | "launch-failed";
  pid?: number;
  /** Successfully spawned group; recovery still requires fresh ownership evidence. */
  groupId?: number;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  elapsedMs: number;
  /** Time from direct-child exit until final group/stream verification. */
  drainMs: number | null;
  /**
   * True only after direct-child close and a verified group with no live work.
   * False hands unresolved ownership back to the caller: retain scratch, stop
   * scheduling, and use fresh process evidence before any external recovery.
   */
  stopped: boolean;
  escalated: boolean;
  issues: string[];
  observations: ProcessObservation[];
  signals: Array<{ elapsedMs: number; signal: "SIGTERM" | "SIGKILL" }>;
}

export interface OwnedProcess {
  child: ChildProcessWithoutNullStreams;
  completion: Promise<OwnedProcessResult>;
  /** Expected shutdown of an intentionally long-lived server. */
  shutdown(): void;
}

/** A bounded observation seam for deterministic failure tests, not a public CLI option. */
export interface ProcessObserver {
  observe(groupId: number, timeoutMs: number): Promise<ProcessMember[]>;
}

/**
 * Own one POSIX process group. Descendants must remain in the inherited group;
 * processes that create a new group/session are outside this containment boundary.
 * Await completion before removing scratch.
 *
 * This implementation's observation and shutdown behavior is verified on macOS only.
 */
export function startOwnedProcess(
  options: OwnedProcessOptions,
  observer: ProcessObserver = { observe: observeProcessGroup },
): OwnedProcess {
  if (process.platform !== "darwin")
    throw new Error("Process ownership is verified on macOS only.");
  for (const value of [options.timeoutMs, options.graceMs, options.cleanupMs]) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error("Invalid process deadline.");
  }
  if (options.cleanupMs <= options.graceMs) {
    throw new Error("Cleanup allowance must exceed the graceful shutdown allowance.");
  }
  const maximum = options.maxOutputBytes ?? 1024 * 1024;
  if (!Number.isSafeInteger(maximum) || maximum <= 0) throw new Error("Invalid output limit.");
  if (options.signal?.aborted) throw new Error("Process launch was cancelled before allocation.");

  const started = performance.now();
  const child = spawn(options.executable, [...options.args], {
    cwd: options.cwd,
    env: { ...options.env },
    detached: true,
    stdio: "pipe",
  });
  let exitCode: number | null = null;
  let exitSignal: NodeJS.Signals | null = null;
  let exitedAt: number | undefined;
  let closed = false;
  let launchFailed = false;
  let spawnedSuccessfully = false;
  let finished = false;
  let stopReason: StopReason | undefined;
  let requestedAt: number | undefined;
  let termAt: number | undefined;
  let killSent = false;
  let groupRetired = false;
  let outputBytes = 0;
  let executionTimer: ReturnType<typeof setTimeout> | undefined;
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  const issues: string[] = [];
  const observations: ProcessObservation[] = [];
  const signals: OwnedProcessResult["signals"] = [];
  const elapsed = () => Math.round(performance.now() - started);
  const issue = (message: string) => {
    if (!issues.includes(message)) issues.push(message);
  };
  const requestStop = (reason: StopReason) => {
    if (finished) return;
    // A normal shutdown request must not hide a later cancellation/failure.
    if (!stopReason || stopReason === "shutdown") stopReason = reason;
    requestedAt ??= performance.now();
    clearTimeout(executionTimer);
  };
  const onAbort = () => requestStop("cancelled");
  options.signal?.addEventListener("abort", onAbort, { once: true });
  if (options.signal?.aborted) onAbort();
  if (requestedAt === undefined) {
    executionTimer = setTimeout(() => requestStop("timeout"), options.timeoutMs);
  }

  const capture = (chunks: Buffer[], chunk: Buffer) => {
    const remaining = maximum - outputBytes;
    outputBytes += chunk.length;
    if (remaining > 0) chunks.push(chunk.subarray(0, remaining));
    if (outputBytes > maximum) requestStop("output-limit");
  };
  child.stdout.on("data", (chunk: Buffer) => capture(stdout, chunk));
  child.stderr.on("data", (chunk: Buffer) => capture(stderr, chunk));
  child.stdin.on("error", () => {
    if (requestedAt === undefined && exitedAt === undefined) {
      issue("Owned process input failed.");
      requestStop("unverified");
    }
  });
  for (const stream of [child.stdout, child.stderr]) {
    stream.on("error", () => {
      issue("Owned process output failed.");
      requestStop("unverified");
    });
  }
  child.once("exit", (code, signal) => {
    exitCode = code;
    exitSignal = signal;
    exitedAt = performance.now();
    clearTimeout(executionTimer);
  });
  child.once("close", () => {
    closed = true;
  });
  const spawned = new Promise<void>((resolve) => {
    child.once("spawn", () => {
      spawnedSuccessfully = true;
      resolve();
    });
    child.once("error", () => {
      launchFailed = true;
      issue("Unable to launch the owned process.");
      resolve();
    });
  });

  const completion = (async (): Promise<OwnedProcessResult> => {
    let verifiedStopped = false;
    let previousSnapshot = "";
    let knownDescendants = new Set<number>();
    try {
      await spawned;
      const groupId = child.pid;
      if (launchFailed && groupId === undefined) verifiedStopped = true;
      if (!launchFailed && (!Number.isSafeInteger(groupId) || groupId! <= 1)) {
        issue("Spawn did not establish a valid owned process group.");
        requestStop("unverified");
      }
      while (!launchFailed && groupId !== undefined && groupId > 1) {
        const now = performance.now();
        if (
          requestedAt === undefined &&
          exitedAt === undefined &&
          now - started >= options.timeoutMs
        ) {
          requestStop("timeout");
        }
        let members: ProcessMember[] | undefined;
        const exitBeforeObservation = exitedAt;
        try {
          const deadline = requestedAt === undefined ? now + 500 : requestedAt + options.cleanupMs;
          members = await observer.observe(groupId, Math.max(1, Math.min(500, deadline - now)));
          const snapshot = JSON.stringify(members);
          if (snapshot !== previousSnapshot && observations.length < 100) {
            observations.push({ elapsedMs: elapsed(), members });
            previousSnapshot = snapshot;
          }
        } catch {
          issue("Required process-state observation is unavailable.");
          requestStop("unverified");
        }
        if (members !== undefined && exitBeforeObservation !== exitedAt) {
          // The snapshot may predate the exit event received while awaiting it.
          // Refresh before using it to retire ownership, signal, or fail cleanup.
          if (requestedAt !== undefined && performance.now() - requestedAt >= options.cleanupMs) {
            issue("Owned process completion could not be verified within the cleanup allowance.");
            break;
          }
          continue;
        }
        const live = members?.filter(isLiveProcess);
        // After leader exit, a previously observed live descendant must still
        // anchor any signal. The same PGID alone does not exclude group-ID reuse.
        const continuousGroup =
          live !== undefined &&
          (exitedAt === undefined || live.some((member) => knownDescendants.has(member.pid)));
        if (continuousGroup) {
          knownDescendants = new Set(
            live!.filter((member) => member.pid !== groupId).map((member) => member.pid),
          );
        }
        // A live direct child still anchors ownership if a snapshot omits it.
        if (exitedAt !== undefined && live?.length === 0) groupRetired = true;
        if (closed && live?.length === 0) {
          verifiedStopped = true;
          break;
        }
        if (groupRetired && live && live.length > 0) {
          issue("An emptied process group was reused; refusing to signal it.");
          break;
        }
        const afterObservation = performance.now();
        if (
          requestedAt === undefined &&
          exitedAt !== undefined &&
          afterObservation - exitedAt >= options.graceMs
        ) {
          issue(
            live?.length
              ? continuousGroup
                ? "Owned descendants outlived the normal completion allowance."
                : "Owned process group continuity is unverified."
              : "Owned process streams did not close within the normal allowance.",
          );
          requestStop("unverified");
        }
        if (requestedAt !== undefined) {
          if (afterObservation - requestedAt >= options.cleanupMs) {
            if (live?.length && !continuousGroup) {
              issue("Owned process group continuity is unverified.");
            }
            issue("Owned process completion could not be verified within the cleanup allowance.");
            break;
          }
          // Only the group established by spawn can be signaled, and never after
          // retirement. A live direct child also establishes ownership
          // when observation fails; no unrelated snapshot PID is a signal target.
          const canSignal =
            !groupRetired && (exitedAt === undefined || (continuousGroup && Boolean(live?.length)));
          const send = (signal: "SIGTERM" | "SIGKILL") => {
            try {
              process.kill(-groupId, signal);
              signals.push({ elapsedMs: elapsed(), signal });
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
                issue("Unable to signal the owned process group.");
              }
            }
          };
          if (termAt === undefined && canSignal) {
            termAt = afterObservation;
            send("SIGTERM");
          }
          if (
            !killSent &&
            termAt !== undefined &&
            afterObservation - termAt >= options.graceMs &&
            canSignal
          ) {
            killSent = true;
            issue("Owned work required forced termination.");
            send("SIGKILL");
          }
        }
        await delay(20);
      }
    } finally {
      finished = true;
      clearTimeout(executionTimer);
      options.signal?.removeEventListener("abort", onAbort);
      child.stdin.destroy();
      if (!verifiedStopped) {
        child.stdout.destroy();
        child.stderr.destroy();
        child.unref();
      }
    }
    const reason = launchFailed
      ? "launch-failed"
      : (stopReason ?? (exitCode === 0 ? "completed" : "exit-failed"));
    const expectedExit = exitCode === 0 || (reason === "shutdown" && exitSignal === "SIGTERM");
    return {
      ok:
        verifiedStopped &&
        expectedExit &&
        issues.length === 0 &&
        (reason === "completed" || reason === "shutdown"),
      reason,
      pid: child.pid,
      groupId: spawnedSuccessfully ? child.pid : undefined,
      exitCode,
      signal: exitSignal,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8"),
      elapsedMs: elapsed(),
      drainMs: exitedAt === undefined ? null : Math.round(performance.now() - exitedAt),
      stopped: verifiedStopped,
      escalated: killSent,
      issues,
      observations,
      signals,
    };
  })();
  return { child, completion, shutdown: () => requestStop("shutdown") };
}
