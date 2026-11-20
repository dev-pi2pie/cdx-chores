import { isAbsolute } from "node:path";

import { resolveCodexSessionRetention } from "../../../utils/codex-session-retention";
import { CodexAppServer, CodexRequestTimeoutError, isTurnInputTooLarge } from "../app-server";
import { claimThreadId } from "../app-server-identity";
import { extractAppServerVersion } from "../app-server-version";
import { resolveDiscoveryExecutable } from "../discovery/executable";
import { applyCodexSessionRetention } from "../session-retention";
import { BenchmarkCatalog, isTierRejection } from "./catalog";
import { readSavedTurn } from "./rollout";
import { TrialObserver } from "./turn";
import {
  benchmarkWorkload,
  type BenchmarkOptions,
  type BenchmarkRun,
  type BenchmarkSelection,
  type BenchmarkTrial,
} from "./types";

export type { BenchmarkOptions, BenchmarkRun, BenchmarkTrial } from "./types";

const turnTimeoutMs = 120_000;
const interruptTimeoutMs = 2_000;

interface Thread {
  id: string;
  path: string | null;
  model?: string | null;
  modelProvider?: string;
  reasoningEffort?: string | null;
}

interface ThreadStartResponse {
  thread: Thread;
  model?: string;
  modelProvider?: string;
  reasoningEffort?: string | null;
  serviceTier?: string | null;
}

function trialRecord(selection: BenchmarkSelection): BenchmarkTrial {
  return {
    ...selection,
    status: "failed",
    error: null,
    threadId: null,
    turnId: null,
    inferenceAttempted: false,
    resolvedModel: null,
    resolvedProvider: null,
    resolvedReasoningEffort: null,
    configuredTier: null,
    sentTier: null,
    servedSpeed: null,
    firstTokenMs: null,
    durationMs: null,
    outputTokens: null,
    usage: null,
    usagePartial: false,
    eligible: false,
    sessionRetention: null,
  };
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function timing(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function rolloutPath(path: string | null | undefined): string | null {
  return typeof path === "string" && isAbsolute(path) && !path.includes("\0") ? path : null;
}

class BenchmarkRunner {
  private readonly ownedThreadIds = new Set<string>();
  private readonly catalog: BenchmarkCatalog;
  private readonly retention;
  canStartTrial = true;

  constructor(
    private readonly server: CodexAppServer,
    private readonly options: BenchmarkOptions,
  ) {
    this.catalog = new BenchmarkCatalog(server, options.cwd, options.provider, options.signal);
    this.retention = resolveCodexSessionRetention(options.sessionRetention);
  }

  private async completion(observer: TrialObserver, threadId: string, turnId: string) {
    const { signal } = this.options;
    const deadline = AbortSignal.timeout(turnTimeoutMs);
    const stopped = this.server.signal;
    const waiting = AbortSignal.any([stopped, deadline, ...(signal ? [signal] : [])]);
    try {
      return { ...(await observer.waitForCompletion(turnId, waiting)), timedOut: false };
    } catch (error) {
      if (stopped.aborted || observer.start.conflicting) throw error;
      const timedOut = deadline.aborted && waiting.reason === deadline.reason;
      try {
        return { ...(await this.interrupt(observer, threadId, turnId)), timedOut };
      } catch (interruptError) {
        if (timedOut) throw new Error(`Codex turn timed out. ${messageFrom(interruptError)}`);
        throw interruptError;
      }
    }
  }

  private async interrupt(observer: TrialObserver, threadId: string, turnId: string) {
    const stopWaiting = AbortSignal.any([
      this.server.signal,
      AbortSignal.timeout(interruptTimeoutMs),
    ]);
    const interruption = this.server
      .request("turn/interrupt", { threadId, turnId }, { timeoutMs: interruptTimeoutMs })
      .then(
        () => null,
        (error: unknown) => messageFrom(error),
      );
    try {
      return await observer.waitForCompletion(turnId, stopWaiting);
    } catch {
      throw new Error(
        (await interruption) ?? "Codex did not confirm turn completion after interruption.",
      );
    }
  }

  private async recover(
    trial: BenchmarkTrial,
    thread: Thread,
    turnId: string,
    completedAt?: number,
  ) {
    const saved = await readSavedTurn({
      ...this.options.rollout,
      initialPath: rolloutPath(thread.path),
      turnId,
      receivedAt: completedAt ?? performance.now(),
      lookupPath: async (timeoutMs) => {
        const { thread: refreshed } = await this.server.request<{ thread: Thread }>(
          "thread/read",
          { threadId: thread.id },
          { timeoutMs },
        );
        if (refreshed.id !== thread.id)
          throw new Error("Rollout lookup returned the wrong thread.");
        return rolloutPath(refreshed.path);
      },
    });
    trial.usage = saved.usage;
    trial.outputTokens = saved.outputTokens;
    trial.usagePartial =
      saved.usage !== null &&
      (completedAt === undefined ||
        trial.status !== "completed" ||
        saved.terminal?.type !== "task_complete");
    if (completedAt !== undefined) {
      trial.firstTokenMs = timing(saved.terminal?.time_to_first_token_ms);
      trial.durationMs = timing(saved.terminal?.duration_ms);
    }
  }

  async runTrial(trial: BenchmarkTrial): Promise<void> {
    const { prompt, cwd, signal } = this.options;
    const { model, requestedSpeed, provider, reasoningEffort } = trial;
    let thread: Thread | undefined;
    let observer: TrialObserver | undefined;
    let completionConfirmed = false;
    let refusedBeforeSubmission = false;
    try {
      const tier =
        requestedSpeed === null ? undefined : await this.catalog.tierFor(model, requestedSpeed);
      signal?.throwIfAborted();
      if (requestedSpeed !== null && tier === undefined) {
        trial.status = "unavailable";
        trial.error = `${model ?? "The inherited model"} does not advertise ${requestedSpeed}.`;
        return;
      }
      const startedThread = await this.server.request<ThreadStartResponse>(
        "thread/start",
        {
          cwd,
          model: model ?? undefined,
          modelProvider: provider ?? undefined,
          ephemeral: false,
          approvalPolicy: "never",
          sandbox: "read-only",
          config: { web_search: "disabled", "features.shell_tool": false },
        },
        { signal },
      );
      const freshThread = startedThread?.thread;
      claimThreadId(freshThread?.id, this.ownedThreadIds);
      thread = freshThread;
      trial.threadId = thread.id;
      trial.resolvedModel = startedThread.model ?? thread.model ?? null;
      trial.resolvedProvider = startedThread.modelProvider ?? thread.modelProvider ?? null;
      trial.resolvedReasoningEffort =
        reasoningEffort ?? startedThread.reasoningEffort ?? thread.reasoningEffort ?? null;
      trial.configuredTier = startedThread.serviceTier ?? null;
      signal?.throwIfAborted();
      observer = new TrialObserver(this.server, thread.id, this.options.onFirstText);
      this.server.signal.throwIfAborted();
      trial.turnId = await observer.waitForStart(
        this.server.request(
          "turn/start",
          {
            threadId: thread.id,
            effort: reasoningEffort ?? undefined,
            serviceTierForTurn: tier,
            input: [{ type: "text", text: prompt, text_elements: [] }],
          },
          {
            onQueued() {
              trial.inferenceAttempted = true;
              trial.sentTier = tier ?? null;
            },
          },
        ),
        signal,
      );
      observer.watchFirstText(trial.turnId);
      const { turn, receivedAt, timedOut } = await this.completion(
        observer,
        thread.id,
        trial.turnId,
      );
      completionConfirmed = true;
      trial.error = timedOut
        ? "Codex turn timed out after 120 seconds."
        : (turn.error?.message ?? null);
      trial.status = timedOut
        ? "failed"
        : turn.status === "interrupted"
          ? "cancelled"
          : turn.status === "completed"
            ? "completed"
            : "failed";
      if (trial.status === "cancelled" && !signal?.aborted && !trial.error?.trim()) {
        trial.error = "Codex app-server interrupted the turn.";
      }
      if (
        trial.status === "failed" &&
        requestedSpeed &&
        trial.error &&
        isTierRejection(trial.error)
      ) {
        trial.status = "unavailable";
      }
      const eligible =
        trial.status === "completed" && !trial.warmup && observer.isEligible(turn.id);
      await this.recover(trial, thread, turn.id, receivedAt);
      observer.start.assertUnambiguous();
      trial.eligible = eligible;
    } catch (error) {
      trial.error = messageFrom(error);
      trial.status = signal?.aborted
        ? "cancelled"
        : !trial.inferenceAttempted && requestedSpeed && isTierRejection(trial.error)
          ? "unavailable"
          : "failed";
      if (trial.inferenceAttempted) trial.turnId = observer?.start.turnId ?? null;
      if (thread && trial.turnId && !completionConfirmed && !observer?.start.conflicting) {
        let receivedAt: number | undefined;
        if (
          error instanceof CodexRequestTimeoutError &&
          error.method === "turn/start" &&
          observer &&
          !signal?.aborted &&
          !this.server.signal.aborted
        ) {
          try {
            ({ receivedAt } = await this.interrupt(observer, thread.id, trial.turnId));
            completionConfirmed = true;
          } catch (interruptError) {
            trial.error += ` ${messageFrom(interruptError)}`;
          }
        }
        this.canStartTrial = completionConfirmed;
        await this.recover(trial, thread, trial.turnId, receivedAt);
      } else if (trial.inferenceAttempted) {
        refusedBeforeSubmission = isTurnInputTooLarge(error);
        this.canStartTrial = false;
      }
    } finally {
      try {
        if (thread) {
          trial.sessionRetention = await applyCodexSessionRetention({
            mode: this.retention,
            threadId: thread.id,
            completed: completionConfirmed && !observer?.start.conflicting,
            request: (method, params) => this.server.request(method, params),
          });
        }
      } finally {
        observer?.close();
        if (refusedBeforeSubmission) this.canStartTrial = observer?.start.observed === false;
        if (observer?.start.conflicting) {
          this.canStartTrial = false;
          trial.status = signal?.aborted ? "cancelled" : "failed";
          trial.error = messageFrom(observer.start.signal.reason);
          trial.turnId = null;
          trial.eligible = false;
          trial.usagePartial = trial.usage !== null;
        }
      }
    }
  }
}

export async function runCodexBenchmark(options: BenchmarkOptions): Promise<BenchmarkRun> {
  const { signal, cwd, onTrialStart, onTrial } = options;
  const report: BenchmarkRun = {
    codexVersion: null,
    codexHome: null,
    trials: [],
    interrupted: false,
    startupError: null,
    transportError: null,
    shutdownError: null,
  };
  if (signal?.aborted) return { ...report, interrupted: true };
  const env = { ...(options.env ?? process.env) };
  let server: CodexAppServer | undefined;
  try {
    try {
      server = new CodexAppServer(resolveDiscoveryExecutable(env), cwd, env, {
        isolateSignals: true,
      });
      const initialized = await server.initialize(undefined, signal);
      report.codexVersion = extractAppServerVersion(initialized.userAgent, env)?.version ?? null;
      report.codexHome = rolloutPath(initialized.codexHome);
    } catch (error) {
      if (!(signal?.aborted && error === signal.reason)) report.startupError = messageFrom(error);
      return report;
    }
    const runner = new BenchmarkRunner(server, options);
    for (const selection of benchmarkWorkload(options)) {
      if (signal?.aborted || server.signal.aborted || !runner.canStartTrial) break;
      onTrialStart?.(selection);
      const trial = trialRecord(selection);
      await runner.runTrial(trial);
      report.trials.push(trial);
      onTrial?.(trial);
    }
    if (!signal?.aborted && server.signal.aborted) {
      report.transportError = messageFrom(server.stopReason);
    }
    return report;
  } finally {
    try {
      await server?.close();
    } catch (error) {
      report.shutdownError = messageFrom(error);
    }
    report.interrupted = signal?.aborted ?? false;
  }
}
