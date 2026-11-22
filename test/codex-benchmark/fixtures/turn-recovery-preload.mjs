// Loaded only in the isolated caller. Allow full startup time for the fixture process.
import { mock } from "bun:test";
import { EventEmitter } from "node:events";
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { TurnStartEvidence } from "../../../src/adapters/codex/app-server-identity.ts";
import {
  CodexAppServer,
  CodexRequestTimeoutError,
} from "../../../src/adapters/codex/app-server.ts";
import { readSavedTurn } from "../../../src/adapters/codex/benchmark/rollout.ts";
import * as retention from "../../../src/adapters/codex/session-retention.ts";
import "./short-rollout-preload.mjs";

const gate = process.env.FIXTURE_LIFECYCLE_GATE;
const needsFullStartDeadline = gate === "readback-conflict" || gate === "late-reply";
const request = CodexAppServer.prototype.request;
CodexAppServer.prototype.request = function (method, params, options) {
  if (method === "turn/start" && !needsFullStartDeadline) options = { ...options, timeoutMs: 200 };
  return request.call(this, method, params, options);
};

const timeout = AbortSignal.timeout.bind(AbortSignal);
const home = process.env.CODEX_HOME;
const fixtureTrace = join(home, "events.jsonl");
const traceLifecycle = (method, params) =>
  appendFileSync(fixtureTrace, JSON.stringify({ method, params }) + "\n");
let currentDeadline;
AbortSignal.timeout = (ms) => {
  if (ms === 15_000 && gate === "start-deadline-race") {
    currentDeadline = new AbortController();
    return currentDeadline.signal;
  }
  if (ms === 15_000 && !needsFullStartDeadline && existsSync(fixtureTrace)) return timeout(200);
  if (ms === 120_000 && gate === "reply-conflict") return timeout(ms);
  return timeout(ms === 120_000 || ms === 2_000 ? 200 : ms);
};

if (gate === "start-deadline-race") {
  const emit = EventEmitter.prototype.emit;
  EventEmitter.prototype.emit = function (event, ...args) {
    const delivered = emit.call(this, event, ...args);
    if (event === "announced-terminal:thread-1") currentDeadline.abort();
    return delivered;
  };
}

if (gate === "start-deadline" || gate === "start-deadline-race") {
  const trackReply = TurnStartEvidence.prototype.trackReply;
  TurnStartEvidence.prototype.trackReply = function (response) {
    return trackReply.call(
      this,
      response.catch((error) => {
        if (error instanceof CodexRequestTimeoutError)
          traceLifecycle("fixture/turn-start-deadline", { turnId: this.turnId });
        throw error;
      }),
    );
  };
}

if (gate === "cancel" || gate === "readback-conflict") {
  const recordStart = TurnStartEvidence.prototype.recordStart;
  TurnStartEvidence.prototype.recordStart = function (id) {
    recordStart.call(this, id);
    if (gate === "cancel" && this.turnId === "turn-thread-1") {
      writeFileSync(join(home, "caller-turn-observed"), this.turnId);
    }
    if (gate === "readback-conflict" && this.conflicting) {
      writeFileSync(join(home, "caller-observed-conflict"), "");
    }
  };
}

if (gate === "reply-conflict") {
  const recordReply = TurnStartEvidence.prototype.recordReply;
  TurnStartEvidence.prototype.recordReply = function (result) {
    const id = recordReply.call(this, result);
    if (id === "turn-thread-1") writeFileSync(join(home, "caller-turn-reply"), id);
    return id;
  };
}

if (["deadline", "readback-conflict", "late-reply", "start-deadline"].includes(gate)) {
  const read = readSavedTurn;
  mock.module("../../../src/adapters/codex/benchmark/rollout.ts", () => ({
    async readSavedTurn(options) {
      if (options.turnId !== "turn-thread-1") return read(options);
      const deadlineMs = gate === "deadline" ? 150 : 2_000;
      const result = await read({
        ...options,
        deadlineMs,
        async onRolloutRead() {
          traceLifecycle("fixture/rollout-read", { turnId: options.turnId });
          if (gate !== "readback-conflict") return;
          writeFileSync(join(home, "caller-rollout-read"), "");
          const deadline = performance.now() + 1_000;
          while (!existsSync(join(home, "caller-observed-conflict"))) {
            if (performance.now() >= deadline) throw new Error("Caller did not observe conflict.");
            await delay(10);
          }
        },
      });
      if (!result.terminal && performance.now() >= options.receivedAt + deadlineMs) {
        traceLifecycle("fixture/rollout-deadline", { turnId: options.turnId });
      }
      if (gate === "late-reply") {
        traceLifecycle("fixture/rollout-finished", { turnId: options.turnId });
        writeFileSync(join(home, "caller-rollout-finished"), "");
      }
      return result;
    },
  }));
}

if (process.env.FIXTURE_LATE_TURN === "1") {
  const apply = retention.applyCodexSessionRetention;
  mock.module("../../../src/adapters/codex/session-retention.ts", () => ({
    async applyCodexSessionRetention(options) {
      const result = await apply(options);
      if (result.status === "skipped") {
        // The caller has recorded unconfirmed completion. Deliver the ID and wait
        // for the following RPC reply while the transport can still process both.
        await options.request("fixture/announce-late-turn", { threadId: options.threadId });
        process.stderr.write("fixture received reply after late announcement\n");
      }
      return result;
    },
  }));
}
