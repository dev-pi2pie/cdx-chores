#!/usr/bin/env node

import { spawn } from "node:child_process";
import {
  appendFileSync,
  closeSync,
  existsSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";

const home = process.env.CODEX_HOME;
const scenario = JSON.parse(readFileSync(join(home, "scenario.json"), "utf8"));
const threads = new Map();
const send = (message) => console.log(JSON.stringify(message));
const trace = (event) => appendFileSync(join(home, "events.jsonl"), `${JSON.stringify(event)}\n`);
const traceLifecycle = (method, params) => {
  if (scenario.traceLifecycle) trace({ method, params });
};
const notification = (method, params) => send({ method, params });
async function waitForReceipt(name) {
  const path = join(home, name);
  const deadline = performance.now() + 2_000;
  while (!existsSync(path)) {
    if (performance.now() >= deadline) throw new Error(`Fixture did not receive ${name}`);
    await delay(10);
  }
}

function conflictingStart(thread) {
  const turnId = "conflicting-turn";
  traceLifecycle("turn/started", { threadId: thread.id, turnId });
  notification("turn/started", { threadId: thread.id, turn: { id: turnId } });
}

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
  traceLifecycle("turn/started", { threadId: thread.id, turnId: thread.turnId });
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
  const unfinished = scenario.delayed || thread.id === `thread-${scenario.unfinishedRolloutThread}`;
  appendFileSync(thread.path, unfinished ? terminal.slice(0, -1) : terminal);
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

function resistShutdown() {
  process.on("SIGTERM", () => {});
  // Survive stdin closure and TERM, but stop if the fixture owner exits unexpectedly.
  setTimeout(() => {}, 6_000);
  const releasePath = join(home, "release-shutdown");
  setInterval(() => {
    if (existsSync(releasePath)) process.exit(0);
  }, 20).unref();
}

async function run() {
  if (scenario.resistantLeader || scenario.resistantWorker || scenario.stallPeerShutdown) {
    writeFileSync(join(home, "leader.pid"), String(process.pid));
  }
  if (scenario.stallPeerShutdown) process.on("SIGTERM", () => {});
  else if (scenario.resistantLeader) resistShutdown();
  if (scenario.resistantWorker) {
    const readyPath = join(home, "worker.pid");
    const worker = spawn(process.execPath, [process.argv[1], "resistant-worker"], {
      stdio: "ignore",
    });
    worker.unref();
    for (let attempt = 0; attempt < 100 && !existsSync(readyPath); attempt++) await delay(10);
    if (!existsSync(readyPath)) throw new Error("The fixture worker did not start.");
  }
  let rejectFirstLookup = scenario.rejectFirstLookup;
  let threadStarts = 0;
  for await (const line of createInterface({ input: process.stdin })) {
    const { id, method, params } = JSON.parse(line);
    if (method === "initialize" && scenario.stallInitialization)
      writeFileSync(join(home, "initializing.pid"), String(process.pid));
    trace({ method, params });
    const reply = (result) => send({ id, result });
    const reject = (message) => send({ id, error: { code: -32603, message } });
    if (rejectFirstLookup && method === rejectFirstLookup) {
      rejectFirstLookup = undefined;
      reject(`temporary ${method} failure`);
      continue;
    }
    const thread = threads.get(params?.threadId);
    if (params?.threadId && !thread) throw new Error(`Unknown thread in ${method}`);
    if (
      method === scenario.rejectStart ||
      (method === "turn/start" && thread.id === `thread-${scenario.rejectTurnStartThread}`)
    ) {
      reject(`fixture rejected ${method}`);
      continue;
    }
    const stalledTierLookup =
      method !== undefined && method === scenario.stallTierLookup && !params?.cursor;
    if (stalledTierLookup) {
      await delay(2_500);
      trace({ method: "tier-lookup-fallback" });
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
          const { appServerUserAgent = "cdx_chores/0.170.0" } = scenario;
          reply({
            codexHome: home,
            userAgent: appServerUserAgent,
          });
        }
        break;
      case "initialized":
        break;
      case "config/read":
        reply({
          config: {
            model: scenario.configuredModel === undefined ? "model-a" : scenario.configuredModel,
          },
        });
        break;
      case "model/list":
        reply({
          data: ["model-a", "model-b"].map((model) => ({
            model,
            isDefault: model === "model-a",
            supportedReasoningEfforts: [{ reasoningEffort: "low" }],
            serviceTiers: [
              { id: "priority", name: "Fast" },
              ...(model === "model-a" ? [{ id: "ultrafast", name: "Ultrafast" }] : []),
            ],
          })),
          nextCursor: stalledTierLookup ? "next-page" : null,
        });
        break;
      case "thread/start": {
        if (params.ephemeral !== false) throw new Error("Use a persisted thread.");
        const threadNumber = ++threadStarts;
        if (threadNumber === scenario.rejectThreadStartAt) {
          reject("fixture rejected thread/start");
          break;
        }
        if (threadNumber === scenario.threadStartReply?.at) {
          reply(scenario.threadStartReply.result);
          break;
        }
        const settings = scenario.threadSettings?.[threads.size];
        const newId = `thread-${threadNumber}`;
        const started = {
          id: newId,
          path: join(home, `${newId}.jsonl`),
          model: params.model ?? "model-a",
          modelProvider: params.modelProvider ?? "fixture-provider",
          reasoningEffort: settings === undefined ? "medium" : undefined,
          reads: 0,
        };
        threads.set(newId, started);
        if (scenario.withholdThreadStartReply) {
          trace({ method: "fixture/thread-created", params: { threadId: newId } });
          break;
        }
        const closeInput = threadNumber === scenario.closeStdinOnThreadStart;
        if (closeInput) {
          process.stdin.pause();
          closeSync(0);
          trace({ method: "stdin-closed", params: { pid: process.pid } });
        }
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
        if (closeInput) {
          const releasePath = join(
            home,
            scenario.stallPeerShutdown ? "release-stalled-peer" : "release-shutdown",
          );
          const deadline = performance.now() + (scenario.stallPeerShutdown ? 8_000 : 5_000);
          while (performance.now() < deadline && !existsSync(releasePath)) await delay(20);
          return;
        }
        break;
      }
      case "fixture/announce-late-turn":
        if (!scenario.omitTurnStart) throw new Error("Unexpected late announcement request.");
        openTurn(thread);
        reply({});
        break;
      case "turn/start": {
        const delayedReply =
          thread.id === "thread-1" &&
          ["reply-during-readback", "reply-after-readback"].includes(scenario.conflictingStart);
        if (thread.id === `thread-${scenario.turnStartRefusal?.at}`) {
          const { error, evidence, errorFirst } = scenario.turnStartRefusal;
          const turn = { id: `turn-${thread.id}` };
          const started = { method: "turn/started", params: { threadId: thread.id, turn } };
          const terminal = {
            method: "turn/completed",
            params: {
              threadId: evidence === "other-thread" ? "other-thread" : thread.id,
              turn: { ...turn, status: "completed" },
            },
          };
          const messages = [];
          if (evidence === "started" || evidence === "pair") messages.push(started);
          if (evidence === "terminal" || evidence === "pair" || evidence === "other-thread")
            messages.push(terminal);
          if (evidence === "item") {
            messages.push({
              method: "item/started",
              params: { threadId: thread.id, turnId: turn.id, item: { id: "reply" } },
            });
          }
          if (errorFirst) messages.unshift({ id, error });
          else messages.push({ id, error });
          for (const message of messages) {
            if (message.method) traceLifecycle(message.method, message.params);
            else traceLifecycle("fixture/turn-start-error", { threadId: thread.id });
          }
          process.stdout.write(
            messages.map((message) => JSON.stringify(message)).join("\n") + "\n",
          );
          break;
        }
        if (thread.id === `thread-${scenario.turnStartReply?.at}`) {
          if (scenario.turnStartReply.announce) openTurn(thread);
          reply(scenario.turnStartReply.result);
          if (scenario.turnStartReply.complete) completeTurn(thread, "completed");
          break;
        }
        if (scenario.conflictingStart === "after-reply" && thread.id === "thread-1") {
          traceLifecycle("fixture/turn-start-reply", {
            threadId: thread.id,
            turnId: `turn-${thread.id}`,
          });
          reply({ turn: { id: `turn-${thread.id}` } });
          await waitForReceipt("caller-turn-reply");
          conflictingStart(thread);
          break;
        }
        if (scenario.omitTurnStart) break;
        if (scenario.holdTurnStart) {
          while (!existsSync(join(home, "release-turn-start"))) await delay(10);
        }
        openTurn(thread);
        if (scenario.mismatchedCompletion) {
          const unrelated = {
            threadId: scenario.mismatchedCompletion === "thread" ? "other-thread" : thread.id,
            turn: {
              id: scenario.mismatchedCompletion === "turn" ? "other-turn" : thread.turnId,
              status: "completed",
            },
          };
          trace({
            method: "turn/completed",
            params: { threadId: unrelated.threadId, turnId: unrelated.turn.id },
          });
          notification("turn/completed", unrelated);
          if (!scenario.withholdStartReply)
            reject("fixture rejected turn/start after unrelated completion");
          break;
        }
        if (
          !scenario.withholdStartReply &&
          thread.id !== `thread-${scenario.withholdStartReplyThread}` &&
          !delayedReply
        ) {
          reply({ turn: { id: thread.turnId, status: "inProgress" } });
          traceLifecycle("fixture/turn-start-reply", {
            threadId: thread.id,
            turnId: thread.turnId,
          });
        }
        if (thread.id === `thread-${scenario.endStdoutDuringThread}`) {
          process.stdout.end(() => trace({ method: "stdout-ended" }));
          break;
        }
        if (
          scenario.waitForInterruptThread !== undefined
            ? thread.id === `thread-${scenario.waitForInterruptThread}`
            : scenario.interrupt
        )
          break;
        if (scenario.rejectFast && params.serviceTierForTurn === "priority") {
          completeTurn(thread, "failed", {
            message: scenario.rejectFast,
          });
        } else if (thread.id === `thread-${scenario.failThread}`) {
          completeTurn(thread, "failed", { message: "fixture inference failed" });
        } else if (thread.id === `thread-${scenario.serverInterrupt?.thread}`) {
          const { message } = scenario.serverInterrupt;
          completeTurn(thread, "interrupted", message === null ? null : { message });
        } else {
          completeTurn(thread, "completed");
          if (delayedReply) {
            if (scenario.conflictingStart === "reply-after-readback") {
              await waitForReceipt("caller-rollout-finished");
              await delay(100);
            } else {
              await waitForReceipt("caller-rollout-read");
            }
            const turnId =
              scenario.lateStartReply === "matching" ? thread.turnId : "conflicting-turn";
            traceLifecycle("fixture/turn-start-reply", { threadId: thread.id, turnId });
            if (scenario.lateStartReply === "rejected") reject("fixture rejected the late reply");
            else reply({ turn: { id: turnId } });
          } else if (scenario.conflictingStart === "during-readback" && thread.id === "thread-1") {
            await waitForReceipt("caller-rollout-read");
            conflictingStart(thread);
          }
          if (thread.id === `thread-${scenario.endStdoutAfterThread}`) {
            process.stdout.end(() => trace({ method: "stdout-ended" }));
          }
        }
        break;
      }
      case "turn/interrupt":
        if (params.turnId !== thread.turnId) throw new Error("Interrupted the wrong turn.");
        if (!scenario.withholdInterruptReply) {
          reply({});
          traceLifecycle("fixture/turn-interrupt-reply", {
            threadId: thread.id,
            turnId: thread.turnId,
          });
        }
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
        if (
          scenario.conflictingStart === "during-retention" &&
          thread.id === `thread-${scenario.retentionConflictThread ?? 1}`
        ) {
          conflictingStart(thread);
        }
        reply({});
        break;
      default:
        reject(`Unexpected request ${method}`);
    }
  }
}

if (process.argv[2] === "resistant-worker") {
  resistShutdown();
  writeFileSync(
    join(home, "worker.pid"),
    JSON.stringify({ pid: process.pid, groupId: process.ppid }),
  );
} else {
  void run();
}
