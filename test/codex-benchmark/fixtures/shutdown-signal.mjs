// Preloaded only by the fixture caller. The parent test observes its actual exit.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { join } from "node:path";

const kill = process.kill;
const servers = [{ home: process.env.CODEX_HOME, executable: process.env.CDX_CHORES_CODEX_PATH }];
if (process.env.FIXTURE_SECOND_HOME) {
  servers.push({
    home: process.env.FIXTURE_SECOND_HOME,
    executable: process.env.FIXTURE_SECOND_EXECUTABLE,
  });
}

if (process.env.FIXTURE_HOLD_AFTER_CLOSE === "1") {
  const before = process.listenerCount("SIGHUP");
  process.once("beforeExit", () => {
    writeFileSync(
      join(process.env.CODEX_HOME, "caller-idle"),
      JSON.stringify({ before, after: process.listenerCount("SIGHUP") }),
    );
    setTimeout(() => {}, 5_000);
  });
}

if (process.env.FIXTURE_CALLER_SIGNAL) {
  process.once(process.env.FIXTURE_CALLER_SIGNAL, () => {
    process.exitCode = 42;
  });
}

if (process.env.FIXTURE_RECORD_APP_SERVER === "1") {
  // Bun's named spawn import sees the patch when the built-in is loaded through require.
  const childProcess = createRequire(import.meta.url)("node:child_process");
  const spawn = childProcess.spawn;
  childProcess.spawn = (executable, args, options) => {
    const owner = servers.find(
      (server) => executable === server.executable || executable === server.executable?.trim(),
    );
    if (!owner || args?.[0] !== "app-server") return spawn(executable, args, options);
    const receipt = join(owner.home, "app-server-spawn");
    writeFileSync(receipt, "starting", { flag: "wx" });
    const child = spawn(executable, args, options);
    // A partial write may contain a shorter, valid-looking PID.
    writeFileSync(receipt, `${child.pid ?? "not-started"}\n`);
    return child;
  };
  syncBuiltinESMExports();
}

process.kill = function (pid, signal) {
  if (signal !== "SIGTERM" && signal !== "SIGKILL") return kill.call(this, pid, signal);
  const owner = servers.find(({ home }) => {
    const path = join(home, "leader.pid");
    return existsSync(path) && Math.abs(pid) === Number(readFileSync(path, "utf8"));
  });
  if (owner) {
    appendFileSync(
      join(owner.home, "signals.jsonl"),
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
