// Required only by the fixture CLI. The parent test observes its actual exit.
const { appendFileSync, existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const kill = process.kill;
const leaderPath = join(process.env.CODEX_HOME, "leader.pid");
process.kill = function (pid, signal) {
  if (
    (signal === "SIGTERM" || signal === "SIGKILL") &&
    existsSync(leaderPath) &&
    Math.abs(pid) === Number(readFileSync(leaderPath, "utf8"))
  ) {
    appendFileSync(
      join(process.env.CODEX_HOME, "signals.jsonl"),
      JSON.stringify({ pid, signal, at: Date.now() }) + "\n",
    );
    if (signal === "SIGTERM" && process.env.FIXTURE_ESCALATION === "deny-term") {
      throw Object.assign(new Error("Fixture denied app-server SIGTERM."), { code: "EPERM" });
    }
    if (signal === "SIGKILL") {
      if (process.env.FIXTURE_ESCALATION === "denied") {
        throw Object.assign(new Error("Fixture denied app-server SIGKILL."), { code: "EPERM" });
      }
      if (process.env.FIXTURE_ESCALATION === "undelivered") return true;
    }
  }
  return kill.call(this, pid, signal);
};
