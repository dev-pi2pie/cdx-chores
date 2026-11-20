// Required only by the fixture CLI. The parent test observes its actual exit.
const { appendFileSync } = require("node:fs");
const { join } = require("node:path");
const kill = process.kill;
process.kill = function (pid, signal) {
  if (pid < 0 && (signal === "SIGTERM" || signal === "SIGKILL")) {
    appendFileSync(
      join(process.env.CODEX_HOME, "signals.jsonl"),
      JSON.stringify({ pid, signal, at: Date.now() }) + "\n",
    );
    if (signal === "SIGKILL") {
      if (process.env.FIXTURE_ESCALATION === "denied") {
        throw Object.assign(new Error("Fixture denied app-server SIGKILL."), { code: "EPERM" });
      }
      if (process.env.FIXTURE_ESCALATION === "undelivered") return true;
    }
  }
  return kill.call(this, pid, signal);
};
