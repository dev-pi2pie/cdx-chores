#!/usr/bin/env node
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";

const threadId = "owned-fixture-thread";
function record(event) {
  appendFileSync(
    process.env.CDX_RETENTION_EVENTS,
    JSON.stringify({ event, home: process.env.CODEX_HOME, cwd: process.cwd() }) + "\n",
  );
}

function resistShutdown() {
  process.on("SIGTERM", () => {});
  setTimeout(() => process.exit(0), 7_000);
  const release = join(process.env.CODEX_HOME, "release-shutdown");
  setInterval(() => {
    if (existsSync(release)) process.exit(0);
  }, 20).unref();
}

if (process.argv[2] === "retention-worker") {
  resistShutdown();
  writeFileSync(
    join(process.env.CODEX_HOME, "worker.pid"),
    JSON.stringify({ pid: process.pid, groupId: process.ppid }),
  );
} else if (process.argv[2] === "app-server") {
  record("app-server-started");
  writeFileSync(join(process.env.CODEX_HOME, "leader.pid"), String(process.pid));
  if (process.env.CDX_RETENTION_WORKER === "1") {
    if (process.env.FIXTURE_ESCALATION === "undelivered") resistShutdown();
    spawn(process.execPath, [process.argv[1], "retention-worker"], { stdio: "ignore" }).unref();
    const ready = join(process.env.CODEX_HOME, "worker.pid");
    for (let i = 0; i < 100 && !existsSync(ready); i++) await delay(10);
    if (!existsSync(ready)) throw new Error("Retention worker did not start.");
  }
  createInterface({ input: process.stdin }).on("line", (line) => {
    const request = JSON.parse(line);
    if (request.method === "initialized") return;
    if (request.method === "initialize") {
      console.log(
        JSON.stringify({ id: request.id, result: { codexHome: process.env.CODEX_HOME } }),
      );
      return;
    }
    record(`${request.method}:${request.params.threadId}`);
    if (process.env.CDX_RETENTION_RPC === "stall") return;
    if (
      process.env.CDX_RETENTION_RPC === "success" ||
      process.env.FIXTURE_ESCALATION === "deny-term"
    ) {
      console.log(JSON.stringify({ id: request.id, result: {} }));
      return;
    }
    console.log(
      JSON.stringify({
        id: request.id,
        error: { code: -32601, message: "Fixture binary does not support retention." },
      }),
    );
  });
} else {
  process.stdin.resume();
  process.stdin.on("end", () => {
    record("exec-started");
    console.log(JSON.stringify({ type: "thread.started", thread_id: threadId }));
    console.log(
      JSON.stringify({
        type: "item.completed",
        item: { id: "fixture", type: "agent_message", text: "fixture-answer" },
      }),
    );
    if (process.env.CDX_RETENTION_CANCEL === "1") {
      setInterval(() => {}, 1000);
      return;
    }
    console.log(
      JSON.stringify({
        type: "turn.completed",
        usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1 },
      }),
    );
  });
  process.on("exit", () => record("exec-exited"));
}
