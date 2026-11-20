// Preloaded only by the fixture caller. The parent test observes its actual exit.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { join } from "node:path";

const kill = process.kill;
const leaderPath = join(process.env.CODEX_HOME, "leader.pid");

if (process.env.FIXTURE_RECORD_APP_SERVER === "1") {
  // Bun's named spawn import sees the patch when the built-in is loaded through require.
  const childProcess = createRequire(import.meta.url)("node:child_process");
  const spawn = childProcess.spawn;
  const receipt = join(process.env.CODEX_HOME, "app-server-spawn");
  const fixturePath = process.env.CDX_CHORES_CODEX_PATH;
  childProcess.spawn = (executable, args, options) => {
    if (
      (executable !== fixturePath && executable !== fixturePath?.trim()) ||
      args?.[0] !== "app-server"
    ) {
      return spawn(executable, args, options);
    }
    writeFileSync(receipt, "starting", { flag: "wx" });
    const child = spawn(executable, args, options);
    // A partial write may contain a shorter, valid-looking PID.
    writeFileSync(receipt, `${child.pid ?? "not-started"}\n`);
    return child;
  };
  syncBuiltinESMExports();
}

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
