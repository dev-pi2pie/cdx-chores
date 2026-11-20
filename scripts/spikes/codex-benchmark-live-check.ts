import { spawn } from "node:child_process";
import { EventEmitter, once } from "node:events";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import {
  readSavedTurn,
  type RolloutReadOptions,
} from "../../src/adapters/codex/benchmark/rollout.ts";
import { applyCodexSessionRetention } from "../../src/adapters/codex/session-retention.ts";
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
  error?: { message: string };
  params?: {
    threadId?: string;
    turnId?: string;
    turn?: Turn;
    tokenUsage?: { total: { outputTokens: number } };
    item?: { type: string };
  };
}

class LiveCheckTimeout extends Error {}

function startAppServer({ executable, args }: typeof defaultAppServer) {
  const child = spawn(executable, args, {
    stdio: ["pipe", "pipe", "inherit"],
  });
  const closed = new Promise<void>((resolve) => child.once("close", () => resolve()));
  const lines = createInterface({ input: child.stdout });
  const events = new EventEmitter();
  const stopped = new AbortController();
  const stop = () => stopped.abort(new Error("Codex app-server stopped."));
  child.on("error", (error) => stopped.abort(error));
  child.stdin.on("error", (error) => stopped.abort(error));
  lines.once("close", stop);

  const liveTurns = new Map<string, LiveTurn>();
  const announcedTurns = new Map<string, string>();
  const turnKey = (threadId: string, turnId: string) => JSON.stringify([threadId, turnId]);
  let nextId = 0;
  const send = (message: object) => child.stdin.write(`${JSON.stringify(message)}\n`);
  async function wait(event: string, timeoutMs: number, operation: string, cancel?: AbortSignal) {
    const deadline = AbortSignal.timeout(timeoutMs);
    const signal = AbortSignal.any([stopped.signal, deadline, ...(cancel ? [cancel] : [])]);
    try {
      return await once(events, event, { signal });
    } catch (error) {
      if (deadline.aborted && signal.reason === deadline.reason)
        throw new LiveCheckTimeout(`${operation} timed out.`);
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
      const lifecycle = message.method === "turn/started" || message.method === "turn/completed";
      const turnId = lifecycle ? params?.turn?.id : params?.turnId;
      if (typeof params?.threadId !== "string" || typeof turnId !== "string" || !turnId) return;
      const key = turnKey(params.threadId, turnId);
      const live: LiveTurn = liveTurns.get(key) ?? { itemTypes: [] };
      liveTurns.set(key, live);
      if (message.method === "turn/started" && params.turn) {
        announcedTurns.set(params.threadId, turnId);
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
      if (lifecycle && live.completion && announcedTurns.get(params.threadId) === turnId) {
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
  ): Promise<T> {
    const id = ++nextId;
    stopped.signal.throwIfAborted();
    send({ id, method, params });
    // A child-process reply arrives on a later I/O turn. Install the waiter only
    // after a successful local write so a thrown write leaves no pending listener.
    const [message] = (await wait(`request:${id}`, timeoutMs, method, cancel)) as [Message];
    if (message.error) throw new Error(`${method}: ${message.error.message}`);
    return message.result as T;
  }

  return {
    notify(method: string) {
      send({ method });
    },
    request,
    announcedTurnId(threadId: string) {
      return announcedTurns.get(threadId);
    },
    async startTurn(threadId: string, params: object) {
      const settled = new AbortController();
      const terminal = once(events, `announced-terminal:${threadId}`, {
        signal: settled.signal,
      }).then(([id]) => id as string);
      try {
        const reply = request<{ turn: Turn }>(
          "turn/start",
          { ...params, threadId },
          requestTimeoutMs,
          settled.signal,
        );
        return await Promise.race([terminal, reply.then(({ turn }) => turn.id)]);
      } finally {
        settled.abort();
      }
    },
    async waitForCompletion(threadId: string, turnId: string) {
      const key = turnKey(threadId, turnId);
      if (!liveTurns.get(key)?.completion) await wait(`turn:${key}`, 120_000, "Turn completion");
      const live = liveTurns.get(key);
      if (!live?.completion) throw new Error("Matching turn completion was unavailable.");
      return { live, ...live.completion };
    },
    async close() {
      lines.close();
      child.stdin.destroy();
      child.kill();
      const forceKill = setTimeout(() => child.kill("SIGKILL"), 1_000);
      try {
        await closed;
      } finally {
        clearTimeout(forceKill);
      }
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
  requestedSpeed: CodexSpeed,
  tier: string,
  retention: CodexSessionRetention,
  rolloutReadOptions: RolloutReadOptions | undefined,
) {
  const { thread } = await server.request<{ thread: Thread }>("thread/start", {
    model,
    ephemeral: false,
    approvalPolicy: "never",
    sandbox: "read-only",
  });
  let completion: Awaited<ReturnType<AppServer["waitForCompletion"]>>;
  let turnId: string | undefined;
  try {
    turnId = await server.startTurn(thread.id, {
      effort,
      serviceTierForTurn: tier,
      input: [{ type: "text", text: prompt, text_elements: [] }],
    });
    completion = await server.waitForCompletion(thread.id, turnId);
  } catch (error) {
    process.exitCode = 1;
    return {
      stopScheduling: error instanceof LiveCheckTimeout,
      requestedSpeed,
      sentTier: tier,
      provider: thread.modelProvider,
      threadId: thread.id,
      turnId: turnId ?? server.announcedTurnId(thread.id) ?? null,
      status: "error",
      error: String(error),
      sessionRetention: await applyCodexSessionRetention({
        mode: retention,
        threadId: thread.id,
        completed: false,
        request: (method, params) => server.request(method, params),
      }),
    };
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
  if (sessionRetention.status === "failed") process.exitCode = 1;
  return {
    stopScheduling: false,
    requestedSpeed,
    sentTier: tier,
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
  const usage =
    "Usage: bun scripts/spikes/codex-benchmark-live-check.ts --model <id> --effort <effort> [--speed standard|fast|ultrafast] [--session-retention archive|keep|delete]";
  if (values.help) {
    console.log(usage);
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

  const server = startAppServer(appServer);
  try {
    const init = await server.request<{ userAgent: string }>("initialize", {
      clientInfo: { name: "cdx_chores", title: "cdx-chores", version: "1" },
    });
    server.notify("initialized");
    const catalogModel = await findModel(server, model);
    if (
      !catalogModel.supportedReasoningEfforts.some((option) => option.reasoningEffort === effort)
    ) {
      throw new Error(`${model} does not advertise reasoning effort ${effort}.`);
    }
    const trials = requestedSpeeds.map((requestedSpeed) => ({
      requestedSpeed,
      sentTier: tierFor(catalogModel, requestedSpeed),
    }));
    const results = [];
    for (const { requestedSpeed, sentTier } of trials) {
      try {
        const { stopScheduling, ...result } = await runTrial(
          server,
          model,
          effort,
          requestedSpeed,
          sentTier,
          sessionRetention,
          rollout,
        );
        results.push(result);
        if (stopScheduling) break;
      } catch (error) {
        process.exitCode = 1;
        results.push({ requestedSpeed, sentTier, status: "error", error: String(error) });
      }
    }
    console.log(
      JSON.stringify(
        { codexVersion: init.userAgent.split(/[ /]/)[1], model, effort, sessionRetention, results },
        null,
        2,
      ),
    );
  } finally {
    await server.close();
  }
}

if (import.meta.main) {
  await runLiveCheck(process.argv.slice(2)).catch((error: unknown) => {
    console.error(String(error));
    process.exitCode = 1;
  });
}
