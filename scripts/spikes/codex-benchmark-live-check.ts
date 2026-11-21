import { spawn } from "node:child_process";
import { EventEmitter, once } from "node:events";
import { createInterface } from "node:readline";
import { setImmediate } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import {
  claimThreadId,
  isAppServerId,
  TurnStartEvidence,
} from "../../src/adapters/codex/app-server-identity.ts";
import { createAppServerShutdown } from "../../src/adapters/codex/app-server-shutdown.ts";
import {
  checkAppServerLaunchDuringCancellation,
  stopAppServerOnSignal,
} from "../../src/adapters/codex/app-server-signals.ts";
import { extractAppServerVersion } from "../../src/adapters/codex/app-server-version.ts";
import { writeAppServerTurn } from "../../src/adapters/codex/app-server-write.ts";
import { CodexAppServerError, isTurnInputTooLarge } from "../../src/adapters/codex/app-server.ts";
import {
  readSavedTurn,
  type RolloutReadOptions,
} from "../../src/adapters/codex/benchmark/rollout.ts";
import {
  applyCodexSessionRetention,
  type CodexSessionRetentionResult,
} from "../../src/adapters/codex/session-retention.ts";
import { resolveCodexSpeed, type CodexSpeed } from "../../src/utils/codex-execution.ts";
import {
  resolveCodexSessionRetention,
  type CodexSessionRetention,
} from "../../src/utils/codex-session-retention.ts";

const defaultAppServer = {
  executable: fileURLToPath(new URL("../../node_modules/.bin/codex", import.meta.url)),
  args: ["app-server", "--listen", "stdio://"],
};
const requestTimeoutMs = 15_000;
const prompt =
  "Explain how an LRU cache works to a junior developer. Cover a cache hit, a cache miss, and an eviction. Walk through a short example with a capacity of three. Write about 250 words and answer directly without using tools.";
const usage =
  "Usage: node examples/playground/codex-benchmark-live-check.mjs --model <id> --effort <effort> [--speed standard|fast|ultrafast] [--session-retention archive|keep|delete]";
const buildInstructions =
  "From the repository root, build the Node.js bundle with:\n  bun build scripts/spikes/codex-benchmark-live-check.ts --target=node --format=esm --outfile=examples/playground/codex-benchmark-live-check.mjs";

interface Thread {
  id: string;
  path: string | null;
  modelProvider: string;
}

interface Turn {
  id: string;
  status: string;
  error: { message: string } | null;
  durationMs: number | null;
}

interface LiveTurn {
  completion?: { turn: Turn; receivedAt: number };
  outputTokens?: number;
  itemTypes: string[];
  rerouted?: boolean;
}

interface Message {
  id?: number | string;
  method?: string;
  result?: unknown;
  error?: unknown;
  params?: {
    threadId?: string;
    turnId?: string;
    turn?: Turn;
    tokenUsage?: { total: { outputTokens: number } };
    item?: { type: string };
  };
}

function startAppServer({ executable, args }: typeof defaultAppServer, env: NodeJS.ProcessEnv) {
  const separateGroup = process.platform !== "win32";
  if (separateGroup) checkAppServerLaunchDuringCancellation();
  const child = spawn(executable, args, {
    env,
    stdio: "pipe",
    detached: separateGroup,
  });
  const shutdown = createAppServerShutdown(child, separateGroup);
  const lines = createInterface({ input: child.stdout });
  const events = new EventEmitter();
  const stopped = new AbortController();
  const stop = () => stopped.abort(new Error("Codex app-server stopped."));
  child.on("error", (error) => stopped.abort(error));
  child.stdin.on("error", (error) => stopped.abort(error));
  child.stderr.on("error", (error) => stopped.abort(error));
  child.stderr.pipe(process.stderr, { end: false });
  lines.once("close", stop);

  const liveTurns = new Map<string, LiveTurn>();
  const starts = new Map<string, TurnStartEvidence>();
  const turnKey = (threadId: string, turnId: string) => JSON.stringify([threadId, turnId]);
  let nextId = 0;
  const send = (message: object, onQueued?: () => void): void => {
    const line = `${JSON.stringify(message)}\n`;
    if (onQueued) {
      writeAppServerTurn(child.stdin, line, (error) => stopped.abort(error));
      onQueued();
    } else {
      child.stdin.write(line);
    }
  };
  async function wait(event: string, timeoutMs: number, operation: string, cancel?: AbortSignal) {
    const deadline = AbortSignal.timeout(timeoutMs);
    const signal = AbortSignal.any([stopped.signal, deadline, ...(cancel ? [cancel] : [])]);
    try {
      return await once(events, event, { signal });
    } catch (error) {
      if (deadline.aborted && signal.reason === deadline.reason)
        throw new Error(`${operation} timed out.`);
      if (stopped.signal.aborted && signal.reason === stopped.signal.reason) throw signal.reason;
      throw error;
    }
  }

  lines.on("line", (line) => {
    try {
      const message = JSON.parse(line) as Message;
      if (message.id !== undefined) {
        if (message.method) {
          send({
            id: message.id,
            error: { code: -32601, message: "Live check supports prompt-only turns." },
          });
        } else {
          events.emit(`request:${message.id}`, message);
        }
        return;
      }

      const params = message.params;
      if (typeof params?.threadId !== "string") return;
      const start = starts.get(params.threadId);
      if (!start) return;
      const lifecycle = message.method === "turn/started" || message.method === "turn/completed";
      if (lifecycle || typeof params.turnId === "string") start.observed = true;
      const turnId = lifecycle ? params?.turn?.id : params?.turnId;
      if (!isAppServerId(turnId)) return;
      const key = turnKey(params.threadId, turnId);
      const live: LiveTurn = liveTurns.get(key) ?? { itemTypes: [] };
      liveTurns.set(key, live);
      if (message.method === "turn/started" && params.turn) {
        start.recordStart(turnId);
      } else if (
        message.method === "turn/completed" &&
        params.turn &&
        ["completed", "interrupted", "failed"].includes(params.turn.status)
      ) {
        live.completion = { turn: params.turn, receivedAt: performance.now() };
        events.emit(`turn:${key}`);
      } else if (message.method === "thread/tokenUsage/updated") {
        live.outputTokens = params.tokenUsage?.total.outputTokens;
      } else if (message.method === "item/completed" && params.item) {
        live.itemTypes.push(params.item.type);
      } else if (message.method === "model/rerouted") {
        live.rerouted = true;
      }
      if (lifecycle && live.completion && start.turnId === turnId) {
        events.emit(`announced-terminal:${params.threadId}`, turnId);
      }
    } catch (error) {
      stopped.abort(error);
    }
  });

  async function request<T>(
    method: string,
    params: object,
    timeoutMs = requestTimeoutMs,
    cancel?: AbortSignal,
    onQueued?: () => void,
  ): Promise<T> {
    const id = ++nextId;
    stopped.signal.throwIfAborted();
    send({ id, method, params }, onQueued);
    // A child-process reply arrives on a later I/O turn. Install the waiter only
    // after a successful local write so a thrown write leaves no pending listener.
    const [message] = (await wait(`request:${id}`, timeoutMs, method, cancel)) as [Message];
    if (message.id !== id || "result" in message === "error" in message) {
      throw new Error("Codex app-server returned an invalid response.");
    }
    if ("error" in message) throw new CodexAppServerError(method, message.error);
    return message.result as T;
  }

  return {
    signal: stopped.signal,
    notify(method: string) {
      send({ method });
    },
    request,
    async startTurn(
      threadId: string,
      params: object,
      start: TurnStartEvidence,
      onQueued: () => void,
    ) {
      starts.set(threadId, start);
      const settled = new AbortController();
      const terminal = once(events, `announced-terminal:${threadId}`, {
        signal: AbortSignal.any([settled.signal, start.signal]),
      }).then(async ([id]) => {
        // Let a reply from the same input batch settle before inferring the start.
        await setImmediate(undefined, { signal: settled.signal });
        start.assertUnambiguous();
        return id as string;
      });
      try {
        // The reply can still contradict the recovered turn during readback.
        const reply = request(
          "turn/start",
          { ...params, threadId },
          requestTimeoutMs,
          start.signal,
          onQueued,
        );
        return await Promise.race([terminal, reply.then((result) => start.recordReply(result))]);
      } catch (error) {
        start.assertUnambiguous();
        throw error;
      } finally {
        settled.abort();
      }
    },
    async waitForCompletion(threadId: string, turnId: string, start: TurnStartEvidence) {
      start.assertUnambiguous();
      const key = turnKey(threadId, turnId);
      if (!liveTurns.get(key)?.completion) {
        try {
          await wait(`turn:${key}`, 120_000, "Turn completion", start.signal);
        } catch (error) {
          start.assertUnambiguous();
          throw error;
        }
      }
      start.assertUnambiguous();
      const live = liveTurns.get(key);
      if (!live?.completion) throw new Error("Matching turn completion was unavailable.");
      return { live, ...live.completion };
    },
    close() {
      lines.close();
      return shutdown();
    },
  };
}

type AppServer = ReturnType<typeof startAppServer>;

interface CatalogModel {
  model: string;
  supportedReasoningEfforts: Array<{ reasoningEffort: string }>;
  serviceTiers: Array<{ name: string; id: string }>;
}

async function findModel(server: AppServer, model: string) {
  let cursor: string | null = null;
  do {
    const page: { data: CatalogModel[]; nextCursor: string | null } = await server.request(
      "model/list",
      { cursor, limit: 100 },
    );
    const selected = page.data.find((entry) => entry.model === model);
    if (selected) return selected;
    if (page.nextCursor && page.nextCursor === cursor)
      throw new Error("Repeated model list cursor.");
    cursor = page.nextCursor;
  } while (cursor);
  throw new Error(`${model} was absent from the configured provider's model catalog.`);
}

function tierFor(model: CatalogModel, speed: CodexSpeed) {
  if (speed === "standard") return "default";
  const tier = model.serviceTiers.find((entry) => entry.name.toLowerCase() === speed);
  if (!tier) throw new Error(`${model.model} does not advertise ${speed}.`);
  return tier.id;
}

function compare(saved: number | null, live: number | null | undefined) {
  return saved === null || live == null ? null : saved === live;
}

async function runTrial(
  server: AppServer,
  model: string,
  effort: string,
  trial: { tier: string; sentTier: string | null },
  retention: CodexSessionRetention,
  rolloutReadOptions: RolloutReadOptions | undefined,
  ownedThreadIds: Set<string>,
) {
  const response = await server.request<{ thread: Thread }>("thread/start", {
    model,
    ephemeral: false,
    approvalPolicy: "never",
    sandbox: "read-only",
  });
  const thread = response?.thread;
  claimThreadId(thread?.id, ownedThreadIds);
  const start = new TurnStartEvidence();
  let completion: Awaited<ReturnType<AppServer["waitForCompletion"]>>;
  const failed = async (error: unknown, appliedRetention?: CodexSessionRetentionResult) => {
    process.exitCode = 1;
    const dispatched = trial.sentTier !== null;
    const turnId = dispatched ? (start.turnId ?? null) : null;
    const sessionRetention =
      appliedRetention ??
      (await applyCodexSessionRetention({
        mode: retention,
        threadId: thread.id,
        completed: false,
        request: (method, params) => server.request(method, params),
      }));
    return {
      stopScheduling: dispatched && (start.observed || !isTurnInputTooLarge(error)),
      provider: thread.modelProvider,
      threadId: thread.id,
      turnId: start.conflicting ? null : turnId,
      status: "error",
      error: String(start.conflicting ? start.signal.reason : error),
      sessionRetention,
    };
  };
  try {
    const turnId = await server.startTurn(
      thread.id,
      {
        effort,
        serviceTierForTurn: trial.tier,
        input: [{ type: "text", text: prompt, text_elements: [] }],
      },
      start,
      () => {
        trial.sentTier = trial.tier;
      },
    );
    completion = await server.waitForCompletion(thread.id, turnId, start);
  } catch (error) {
    return failed(error);
  }
  const { turn, live, receivedAt } = completion;
  const { terminal, outputTokens, usage, ...rollout } = await readSavedTurn({
    ...rolloutReadOptions,
    initialPath: thread.path,
    turnId: turn.id,
    receivedAt,
    lookupPath: async (timeoutMs) => {
      const { thread: refreshed } = await server.request<{ thread: Thread }>(
        "thread/read",
        { threadId: thread.id },
        timeoutMs,
      );
      if (refreshed.id !== thread.id) throw new Error("Rollout lookup returned the wrong thread.");
      return refreshed.path;
    },
  });
  try {
    start.assertUnambiguous();
  } catch (error) {
    return failed(error);
  }
  const durationMs = terminal?.duration_ms ?? null;
  const firstTokenMs = terminal?.time_to_first_token_ms ?? null;
  const durationMatchesLive = compare(durationMs, turn.durationMs);
  const outputMatchesLive = compare(outputTokens, live.outputTokens);
  if (
    turn.status !== "completed" ||
    firstTokenMs === null ||
    !durationMs ||
    outputTokens === null ||
    durationMatchesLive === false ||
    outputMatchesLive === false
  )
    process.exitCode = 1;

  const sessionRetention = await applyCodexSessionRetention({
    mode: retention,
    threadId: thread.id,
    completed: true,
    request: (method, params) => server.request(method, params),
  });
  if (start.conflicting) return failed(start.signal.reason, sessionRetention);
  if (sessionRetention.status === "failed") process.exitCode = 1;
  return {
    stopScheduling: false,
    provider: thread.modelProvider,
    threadId: thread.id,
    turnId: turn.id,
    status: turn.status,
    error: turn.error?.message ?? null,
    itemTypes: live.itemTypes,
    rerouted: live.rerouted ?? false,
    ...rollout,
    terminalEvent: terminal?.type ?? null,
    firstTokenMs,
    durationMs,
    outputTokens,
    usage,
    usagePartial:
      usage !== null && (turn.status !== "completed" || terminal?.type !== "task_complete"),
    turnOutputTokensPerSecond:
      turn.status === "completed" &&
      terminal?.type === "task_complete" &&
      durationMs &&
      durationMs > 0 &&
      outputTokens !== null
        ? (1_000 * outputTokens) / durationMs
        : null,
    liveDurationMs: turn.durationMs,
    liveOutputTokens: live.outputTokens ?? null,
    durationMatchesLive,
    outputMatchesLive,
    sessionRetention,
  };
}

export async function runLiveCheck(
  args: string[],
  {
    appServer = defaultAppServer,
    rollout,
  }: {
    appServer?: typeof defaultAppServer;
    rollout?: RolloutReadOptions;
  } = {},
) {
  const { values } = parseArgs({
    args,
    options: {
      model: { type: "string" },
      effort: { type: "string" },
      speed: { type: "string", multiple: true },
      "session-retention": { type: "string", multiple: true },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(usage);
    console.log(buildInstructions);
    console.log(
      "Session retention defaults to keep. Delete permanently removes the trial session.",
    );
    return;
  }
  const { model, effort, speed: speeds } = values;
  if (!model?.trim() || !effort?.trim()) throw new Error(usage);
  const speed = speeds?.[0];
  if (speeds && speeds.length > 1) {
    throw new Error("Specify at most one --speed: standard, fast, or ultrafast.");
  }
  const requestedSpeeds: CodexSpeed[] =
    speed === undefined ? ["standard", "fast"] : [resolveCodexSpeed(speed)];
  const retentionValues = values["session-retention"];
  if (retentionValues && retentionValues.length > 1) {
    throw new Error("Specify at most one --session-retention: archive, keep, or delete.");
  }
  const sessionRetention = resolveCodexSessionRetention(retentionValues?.[0]);

  const env = { ...process.env };
  const server = startAppServer(appServer, env);
  let closing: Promise<void> | undefined;
  let shutdownFailed = false;
  let hungUp = false;
  let signalExit: number | undefined;
  const close = (): Promise<void> =>
    (closing ??= server
      .close()
      .catch((error: unknown) => {
        shutdownFailed = true;
        console.error(`Shutdown failed: ${String(error)}`);
      })
      .finally(() => releaseHangup?.()));
  const releaseHangup =
    process.platform === "win32"
      ? undefined
      : stopAppServerOnSignal(() => {
          hungUp = true;
          return close();
        }, "hangup");
  const cancel = (exitCode: number) => {
    signalExit ??= exitCode;
    void close();
  };
  const interrupt = () => cancel(130);
  const terminate = () => cancel(143);
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  try {
    const init = await server.request<{ userAgent?: unknown }>("initialize", {
      clientInfo: { name: "cdx_chores", title: "cdx-chores", version: "1" },
    });
    const codexVersion = extractAppServerVersion(init.userAgent, env)?.version;
    server.notify("initialized");
    const catalogModel = await findModel(server, model);
    if (
      !catalogModel.supportedReasoningEfforts.some((option) => option.reasoningEffort === effort)
    ) {
      throw new Error(`${model} does not advertise reasoning effort ${effort}.`);
    }
    const trials = requestedSpeeds.map((requestedSpeed) => ({
      requestedSpeed,
      tier: tierFor(catalogModel, requestedSpeed),
    }));
    const results = [];
    const ownedThreadIds = new Set<string>();
    for (const { requestedSpeed, tier } of trials) {
      if (signalExit !== undefined || server.signal.aborted) break;
      const trial = { tier, sentTier: null as string | null };
      try {
        const { stopScheduling, ...result } = await runTrial(
          server,
          model,
          effort,
          trial,
          sessionRetention,
          rollout,
          ownedThreadIds,
        );
        results.push({ requestedSpeed, sentTier: trial.sentTier, ...result });
        if (stopScheduling) break;
      } catch (error) {
        if (!hungUp) process.exitCode = 1;
        results.push({
          requestedSpeed,
          sentTier: trial.sentTier,
          status: "error",
          error: String(error),
        });
      }
    }
    if (!hungUp && signalExit === undefined && server.signal.aborted) {
      process.exitCode = 1;
      console.error(`Transport failed: ${String(server.signal.reason)}`);
    }
    console.log(
      JSON.stringify({ codexVersion, model, effort, sessionRetention, results }, null, 2),
    );
  } catch (error) {
    await close();
    if (!hungUp && signalExit === undefined) throw error;
  } finally {
    await close();
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
    if (signalExit !== undefined) process.exitCode = signalExit;
    else if (shutdownFailed && !hungUp) process.exitCode = 1;
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (process.versions.bun && !(args.length === 1 && args[0] === "--help")) {
    console.error(
      `Run the maintainer live check with the Node.js bundle.\n${buildInstructions}\n${usage}`,
    );
    process.exitCode = 1;
  } else {
    const executable = process.env.CDX_CHORES_CODEX_PATH?.trim() || defaultAppServer.executable;
    await runLiveCheck(args, {
      appServer: { ...defaultAppServer, executable },
    }).catch((error: unknown) => {
      console.error(String(error));
      process.exitCode = 1;
    });
  }
}
