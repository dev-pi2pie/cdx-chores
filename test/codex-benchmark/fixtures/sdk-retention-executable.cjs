#!/usr/bin/env node
const { appendFileSync } = require("node:fs");
const readline = require("node:readline");

const threadId = "owned-fixture-thread";
function record(event) {
  appendFileSync(
    process.env.CDX_RETENTION_EVENTS,
    JSON.stringify({ event, home: process.env.CODEX_HOME, cwd: process.cwd() }) + "\n",
  );
}

if (process.argv[2] === "app-server") {
  readline.createInterface({ input: process.stdin }).on("line", (line) => {
    const request = JSON.parse(line);
    if (request.method === "initialized") return;
    if (request.method === "initialize") {
      console.log(
        JSON.stringify({ id: request.id, result: { codexHome: process.env.CODEX_HOME } }),
      );
      return;
    }
    record(`${request.method}:${request.params.threadId}`);
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
