#!/usr/bin/env node

const { spawn } = require("node:child_process");
const {
  appendFileSync,
  existsSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} = require("node:fs");
const { join } = require("node:path");
const { createInterface } = require("node:readline");
const { setTimeout: delay } = require("node:timers/promises");

const home = process.env.CODEX_HOME;
const scenario = JSON.parse(readFileSync(join(home, "scenario.json"), "utf8"));
const threads = new Map();
const send = (message) => console.log(JSON.stringify(message));
const trace = (event) => appendFileSync(join(home, "events.jsonl"), `${JSON.stringify(event)}\n`);
const notification = (method, params) => send({ method, params });
const event = (type, payload) =>
  `${JSON.stringify({ type: "event_msg", payload: { type, ...payload } })}\n`;
const tokenCount = {
  input_tokens: 150,
  output_tokens: 80,
  cached_input_tokens: 25,
  cache_write_input_tokens: 18,
  reasoning_output_tokens: 20,
  total_tokens: 230,
};

function openTurn(thread) {
  thread.turnId = `turn-${thread.id}`;
  const snapshot = scenario.usageSnapshots?.[threads.size - 1];
  const usage = snapshot === undefined ? tokenCount : snapshot;
  writeFileSync(
    thread.path,
    event("task_started", { turn_id: thread.turnId }) +
      (usage ? event("token_count", { info: { total_token_usage: usage } }) : ""),
  );
  notification("turn/started", {
    threadId: thread.id,
    turn: { id: thread.turnId, status: "inProgress" },
  });
  if (scenario.streamText) {
    const text = { threadId: thread.id, turnId: thread.turnId, itemId: "reply", delta: "" };
    notification("item/agentMessage/delta", text);
    notification("item/agentMessage/delta", {
      ...text,
      turnId: "unrelated-turn",
      delta: "ignored",
    });
    if (scenario.streamText === "matching") {
      notification("item/agentMessage/delta", { ...text, delta: "private fixture chunk" });
      notification("item/agentMessage/delta", { ...text, delta: "next chunk" });
    }
  }
}

function completeTurn(thread, status, error = null) {
  const turnId = thread.turnId;
  const terminal =
    status === "interrupted"
      ? event("turn_aborted", { turn_id: turnId, reason: "interrupted" })
      : event("task_complete", { turn_id: turnId, duration_ms: 800, time_to_first_token_ms: 200 });
  appendFileSync(thread.path, scenario.delayed ? terminal.slice(0, -1) : terminal);
  if (status === "completed") {
    const identity = { threadId: thread.id, turnId };
    if (scenario.rerouted)
      notification("model/rerouted", { ...identity, fromModel: thread.model, toModel: "other" });
    if (scenario.tool)
      notification("item/started", {
        ...identity,
        item: { id: "shell", type: "commandExecution" },
      });
    notification("item/completed", {
      ...identity,
      item: { id: "reply", type: "agentMessage", text: "fixture answer", phase: scenario.phase },
    });
  }
  trace({ method: "turn/completed", params: { threadId: thread.id, turnId, status } });
  notification("turn/completed", { threadId: thread.id, turn: { id: turnId, status, error } });
}

async function run() {
  if (scenario.resistantWorker) {
    const readyPath = join(home, "worker.pid");
    const worker = spawn(
      process.execPath,
      [
        "-e",
        'process.on("SIGTERM", () => {}); setTimeout(() => {}, 6000); require("node:fs").writeFileSync(process.argv[1], JSON.stringify({ pid: process.pid, groupId: process.ppid }));',
        readyPath,
      ],
      { stdio: "ignore" },
    );
    worker.unref();
    for (let attempt = 0; attempt < 100 && !existsSync(readyPath); attempt++) await delay(10);
    if (!existsSync(readyPath)) throw new Error("The fixture worker did not start.");
  }
  for await (const line of createInterface({ input: process.stdin })) {
    const { id, method, params } = JSON.parse(line);
    if (method === "initialize" && scenario.stallInitialization)
      writeFileSync(join(home, "initializing.pid"), String(process.pid));
    trace({ method, params });
    const reply = (result) => send({ id, result });
    const reject = (message) => send({ id, error: { code: -32603, message } });
    const thread = threads.get(params?.threadId);
    if (params?.threadId && !thread) throw new Error(`Unknown thread in ${method}`);
    if (method === scenario.rejectStart) {
      reject(`fixture rejected ${method}`);
      continue;
    }
    switch (method) {
      case "initialize":
        if (scenario.stallInitialization) {
          await delay(2_500);
          trace({ method: "initialize-fallback" });
          reject("fixture initialization fallback");
          break;
        }
        if (scenario.initializeError) {
          reject("fixture refused initialization");
        } else {
          const version = scenario.appServerVersion;
          reply({
            codexHome: home,
            userAgent: version === null ? null : `cdx_chores/${version ?? "0.170.0"}`,
          });
        }
        break;
      case "initialized":
        break;
      case "config/read":
        reply({ config: { model: "model-a" } });
        break;
      case "model/list":
        reply({
          data: ["model-a", "model-b"].map((model) => ({
            model,
            isDefault: model === "model-a",
            serviceTiers: [
              { id: "priority", name: "Fast" },
              ...(model === "model-a" ? [{ id: "ultrafast", name: "Ultrafast" }] : []),
            ],
          })),
          nextCursor: null,
        });
        break;
      case "thread/start": {
        if (params.ephemeral !== false) throw new Error("Use a persisted thread.");
        const settings = scenario.threadSettings?.[threads.size];
        const newId = `thread-${threads.size + 1}`;
        const started = {
          id: newId,
          path: join(home, `${newId}.jsonl`),
          model: params.model ?? "model-a",
          modelProvider: params.modelProvider ?? "fixture-provider",
          reasoningEffort: settings === undefined ? "medium" : undefined,
          reads: 0,
        };
        threads.set(newId, started);
        reply({
          ...settings,
          thread: {
            ...started,
            path:
              scenario.fallback || newId === `thread-${scenario.exitDuringReadbackThread}`
                ? null
                : started.path,
          },
        });
        break;
      }
      case "turn/start":
        openTurn(thread);
        if (!scenario.withholdStartReply)
          reply({ turn: { id: thread.turnId, status: "inProgress" } });
        if (scenario.interrupt || thread.id === `thread-${scenario.waitForInterruptThread}`) break;
        if (scenario.rejectFast && params.serviceTierForTurn === "priority") {
          completeTurn(thread, "failed", {
            message: "Service tier priority is not supported for this account.",
          });
        } else if (thread.id === `thread-${scenario.failThread}`) {
          completeTurn(thread, "failed", { message: "fixture inference failed" });
        } else {
          completeTurn(thread, "completed");
        }
        break;
      case "turn/interrupt":
        if (params.turnId !== thread.turnId) throw new Error("Interrupted the wrong turn.");
        reply({});
        if (scenario.interrupt !== "unconfirmed") completeTurn(thread, "interrupted");
        break;
      case "thread/read":
        if (thread.id === `thread-${scenario.exitDuringReadbackThread}`) process.exit(17);
        thread.reads++;
        reply({ thread: { ...thread, path: thread.reads === 1 ? null : thread.path } });
        break;
      case "thread/archive":
      case "thread/delete":
        if (scenario.retentionError) {
          reject("fixture cleanup failed");
          break;
        }
        if (method === "thread/archive") renameSync(thread.path, `${thread.path}.archive`);
        else unlinkSync(thread.path);
        reply({});
        break;
      default:
        reject(`Unexpected request ${method}`);
    }
  }
}

void run();
