import { spawn } from "node:child_process";
import { EventEmitter, once } from "node:events";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const codex = fileURLToPath(new URL("../../node_modules/.bin/codex", import.meta.url));
const prompt =
  "Explain how an LRU cache works to a junior developer. Cover a cache hit, a cache miss, and an eviction. Walk through a short example with a capacity of three. Write about 250 words and answer directly without using tools.";
const rolloutDeadlineMs = 2_000;
const rolloutRetryMs = 50;
type Speed = "standard" | "fast" | "ultrafast";

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

function startAppServer() {
  const child = spawn(codex, ["app-server", "--listen", "stdio://"], {
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
  let nextId = 0;
  const send = (message: object) => child.stdin.write(`${JSON.stringify(message)}\n`);
  const wait = (event: string, timeoutMs: number) =>
    once(events, event, {
      signal: AbortSignal.any([stopped.signal, AbortSignal.timeout(timeoutMs)]),
    });

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
      const turnId = params?.turn?.id ?? params?.turnId;
      if (!params?.threadId || !turnId) return;
      const key = `${params.threadId}:${turnId}`;
      const live: LiveTurn = liveTurns.get(key) ?? { itemTypes: [] };
      liveTurns.set(key, live);
      if (message.method === "turn/completed" && params.turn) {
        live.completion = { turn: params.turn, receivedAt: performance.now() };
        events.emit(`turn:${key}`);
      } else if (message.method === "thread/tokenUsage/updated") {
        live.outputTokens = params.tokenUsage?.total.outputTokens;
      } else if (message.method === "item/completed" && params.item) {
        live.itemTypes.push(params.item.type);
      } else if (message.method === "model/rerouted") {
        live.rerouted = true;
      }
    } catch (error) {
      stopped.abort(error);
    }
  });

  return {
    notify(method: string) {
      send({ method });
    },
    async request<T>(method: string, params: object, timeoutMs = 15_000): Promise<T> {
      const id = ++nextId;
      const response = wait(`request:${id}`, timeoutMs);
      send({ id, method, params });
      const [message] = (await response) as [Message];
      if (message.error) throw new Error(`${method}: ${message.error.message}`);
      return message.result as T;
    },
    async waitForCompletion(threadId: string, turnId: string) {
      const key = `${threadId}:${turnId}`;
      if (!liveTurns.get(key)?.completion) await wait(`turn:${key}`, 120_000);
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

function tierFor(model: CatalogModel, speed: Speed) {
  if (speed === "standard") return "default";
  const tier = model.serviceTiers.find((entry) => entry.name.toLowerCase() === speed);
  if (!tier) throw new Error(`${model.model} does not advertise ${speed}.`);
  return tier.id;
}

interface RolloutEvent {
  type: string;
  turn_id?: string;
  time_to_first_token_ms?: number | null;
  duration_ms?: number | null;
  info?: { total_token_usage?: { output_tokens: number } } | null;
}

function savedTurn(jsonl: string, turnId: string) {
  const lines = jsonl.split("\n");
  lines.pop(); // The trailing segment may be a write in progress.
  let active = false;
  let outputTokens: number | null = null;
  for (const line of lines) {
    if (!line.trim()) continue;
    const record = JSON.parse(line) as { type: string; payload: RolloutEvent };
    if (record.type !== "event_msg") continue;
    const event = record.payload;
    if (event.type === "task_started") {
      if (active) break;
      active = event.turn_id === turnId;
    } else if (active && event.type === "token_count") {
      const count = event.info?.total_token_usage?.output_tokens;
      if (count !== undefined && Number.isSafeInteger(count) && count >= 0) outputTokens = count;
    } else if (
      active &&
      event.turn_id === turnId &&
      (event.type === "task_complete" || event.type === "turn_aborted")
    ) {
      return { terminal: event, outputTokens };
    }
  }
  return { terminal: null, outputTokens };
}

async function readSavedTurn(
  server: AppServer,
  thread: Thread,
  turnId: string,
  receivedAt: number,
) {
  const deadline = receivedAt + rolloutDeadlineMs;
  let path = thread.path;
  let saved: ReturnType<typeof savedTurn> = { terminal: null, outputTokens: null };
  let firstReadFoundTerminal: boolean | null = null;
  let terminalVisibleAfterMs: number | null = null;
  let readError: string | null = null;

  while (performance.now() < deadline) {
    if (!path) {
      try {
        const { thread: refreshed } = await server.request<{ thread: Thread }>(
          "thread/read",
          { threadId: thread.id },
          Math.max(1, Math.ceil(deadline - performance.now())),
        );
        path = refreshed.path;
        readError = null;
      } catch (error) {
        readError = String(error);
      }
    }
    const remaining = Math.ceil(deadline - performance.now());
    if (path && remaining > 0) {
      try {
        const jsonl = await readFile(path, {
          encoding: "utf8",
          signal: AbortSignal.timeout(remaining),
        });
        saved = savedTurn(jsonl, turnId);
        firstReadFoundTerminal ??= saved.terminal !== null;
        readError = null;
        if (saved.terminal) {
          terminalVisibleAfterMs = Math.round(performance.now() - receivedAt);
          break;
        }
      } catch (error) {
        firstReadFoundTerminal ??= false;
        readError = String(error);
      }
    }
    await delay(Math.max(0, Math.min(rolloutRetryMs, deadline - performance.now())));
  }
  return {
    ...saved,
    pathAtThreadStart: Boolean(thread.path),
    firstReadFoundTerminal,
    terminalVisibleAfterMs,
    readError,
  };
}

function compare(saved: number | null, live: number | null | undefined) {
  return saved === null || live == null ? null : saved === live;
}

async function runTrial(
  server: AppServer,
  model: string,
  effort: string,
  requestedSpeed: Speed,
  tier: string,
) {
  const { thread } = await server.request<{ thread: Thread }>("thread/start", {
    model,
    ephemeral: false,
    approvalPolicy: "never",
    sandbox: "read-only",
  });
  const started = await server.request<{ turn: Turn }>("turn/start", {
    threadId: thread.id,
    effort,
    serviceTierForTurn: tier,
    input: [{ type: "text", text: prompt, text_elements: [] }],
  });
  const { turn, live, receivedAt } = await server.waitForCompletion(thread.id, started.turn.id);
  const { terminal, outputTokens, ...rollout } = await readSavedTurn(
    server,
    thread,
    turn.id,
    receivedAt,
  );
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

  return {
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
    turnOutputTokensPerSecond:
      turn.status === "completed" && durationMs && durationMs > 0 && outputTokens !== null
        ? (1_000 * outputTokens) / durationMs
        : null,
    liveDurationMs: turn.durationMs,
    liveOutputTokens: live.outputTokens ?? null,
    durationMatchesLive,
    outputMatchesLive,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      model: { type: "string" },
      effort: { type: "string" },
      speed: { type: "string", multiple: true },
      help: { type: "boolean" },
    },
  });
  const usage =
    "Usage: bun scripts/spikes/codex-benchmark-live-check.ts --model <id> --effort <effort> [--speed standard|fast|ultrafast]";
  if (values.help) {
    console.log(usage);
    return;
  }
  const { model, effort, speed: speeds } = values;
  if (!model?.trim() || !effort?.trim()) throw new Error(usage);
  const speed = speeds?.[0];
  if (
    (speeds && speeds.length > 1) ||
    (speed !== undefined && speed !== "standard" && speed !== "fast" && speed !== "ultrafast")
  ) {
    throw new Error("Specify at most one --speed: standard, fast, or ultrafast.");
  }
  const requestedSpeeds: Speed[] = speed ? [speed] : ["standard", "fast"];

  const server = startAppServer();
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
        results.push(await runTrial(server, model, effort, requestedSpeed, sentTier));
      } catch (error) {
        process.exitCode = 1;
        results.push({ requestedSpeed, sentTier, status: "error", error: String(error) });
      }
    }
    console.log(
      JSON.stringify(
        { codexVersion: init.userAgent.split(/[ /]/)[1], model, effort, results },
        null,
        2,
      ),
    );
  } finally {
    await server.close();
  }
}

await main().catch((error: unknown) => {
  console.error(String(error));
  process.exitCode = 1;
});
