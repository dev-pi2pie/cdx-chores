import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { HarnessError, safeLabel } from "./errors.mjs";
import { createProgressDecoder } from "./protocol.mjs";

function cleanupFailure(stage, id) {
  const error = new HarnessError("cleanup", stage, id);
  error.cleanupUnconfirmed = true;
  return error;
}

function groupState(pid, stage, id) {
  try {
    process.kill(-pid, 0);
    return "present";
  } catch (error) {
    if (error.code === "ESRCH") return "absent";
    if (error.code === "EPERM") return "unknown";
    throw cleanupFailure(stage, id);
  }
}

/** Unknown observations may settle; only ESRCH confirms the group is absent. */
async function waitForProcessGroupSettlement(pid, stage, id, deadline) {
  while (performance.now() < deadline) {
    if (groupState(pid, stage, id) === "absent") return;
    await delay(Math.min(25, Math.max(0, deadline - performance.now())));
  }
  throw cleanupFailure(stage, id);
}

async function terminateWindowsTree(pid, stage, id) {
  const root = process.env.SystemRoot ?? process.env.SYSTEMROOT;
  if (!root || !isAbsolute(root)) throw cleanupFailure(stage, id);
  const child = spawn(join(root, "System32", "taskkill.exe"), ["/PID", String(pid), "/T", "/F"], {
    stdio: "ignore",
    windowsHide: true,
  });
  let timer;
  try {
    await new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        child.kill();
        reject(cleanupFailure(stage, id));
      }, 1_000);
      child.once("error", () => reject(cleanupFailure(stage, id)));
      child.once("close", (code) => (code === 0 ? resolve() : reject(cleanupFailure(stage, id))));
    });
  } finally {
    clearTimeout(timer);
    child.unref();
  }
}

/** One bounded command, owning its descendants and both output pipes. */
export async function runOwnedCommand(path, args, options) {
  const label = safeLabel(options.label);
  const category = options.stage ?? "runner";
  if (!isAbsolute(path) || (options.posixOnly && process.platform === "win32"))
    throw new HarnessError("startup", label);
  if (options.signal?.aborted) throw new HarnessError("cancellation", label);
  let child;
  try {
    child = spawn(path, args, {
      cwd: options.cwd,
      env: options.env,
      detached: process.platform !== "win32",
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new HarnessError("startup", label);
  }
  const pid = child.pid;
  const decoder = createProgressDecoder(options.onProgress ?? (() => {}));
  let issue;
  let spawnFailed = false;
  let settled = false;
  let killTimer;
  let settlementTimer;
  let settlementEnd;
  let windowsTermination;
  let resolveDeadline;
  const deadline = new Promise((resolve) => {
    resolveDeadline = resolve;
  });
  const beginSettlement = () => {
    if (settlementEnd !== undefined) return;
    settlementEnd = performance.now() + 1_500;
    settlementTimer = setTimeout(
      () => resolveDeadline(false),
      Math.max(0, settlementEnd - performance.now()),
    );
  };
  const kill = (signal) => {
    if (!pid) return;
    try {
      process.kill(-pid, signal);
    } catch (error) {
      if (error.code !== "ESRCH") issue = cleanupFailure(label, decoder.current);
    }
  };
  const stop = (error) => {
    if (issue) return;
    issue = error;
    beginSettlement();
    if (process.platform === "win32" && pid) {
      windowsTermination = terminateWindowsTree(pid, label, decoder.current).catch((failure) => {
        issue = failure;
      });
    } else {
      kill("SIGTERM");
      killTimer = setTimeout(() => kill("SIGKILL"), 250);
    }
  };
  const abort = () =>
    stop(
      new HarnessError(
        options.signal.reason?.category === "output" ? "output" : "cancellation",
        label,
        decoder.current,
      ),
    );
  options.signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(
    () => stop(new HarnessError("timeout", label, decoder.current)),
    options.timeout ?? 120_000,
  );
  let resolveExit;
  const exited = new Promise((resolve) => {
    resolveExit = resolve;
  });
  const done = new Promise((resolve) => {
    child.once("error", () => {
      spawnFailed = true;
      beginSettlement();
      resolveExit({ code: -1 });
    });
    child.once("exit", (code, signal) => {
      beginSettlement();
      resolveExit({ code, signal });
    });
    child.once("close", (code, signal) => {
      settled = true;
      resolve({ code, signal });
    });
  });
  const stdout = [];
  const log = [];
  let bytes = 0;
  const consume = async (stream, isStdout) => {
    try {
      for await (const chunk of stream) {
        bytes += chunk.length;
        if (bytes > 4 * 1024 * 1024) {
          stop(new HarnessError("output", label, decoder.current));
          continue;
        }
        if (options.log) log.push(chunk);
        if (isStdout) stdout.push(chunk);
        else if (options.progress) await decoder.push(chunk);
      }
    } catch (error) {
      stop(
        new HarnessError(error.category === "output" ? "output" : category, label, decoder.current),
      );
    }
  };
  const streams = Promise.all([consume(child.stdout, true), consume(child.stderr, false)]);
  try {
    const outcome = await Promise.race([exited, deadline]);
    if (outcome === false) throw cleanupFailure(label, decoder.current);
    if (process.platform === "win32" && pid) {
      // taskkill is best effort only: after the entrypoint exits it cannot prove
      // that ignored-stdio descendants have settled. Keep artifacts owned.
      await windowsTermination;
    }
    if (process.platform === "win32" && pid) throw cleanupFailure(label, decoder.current);
    // A descendant may keep inherited pipes open after the entrypoint exits.
    if (pid) {
      const state = groupState(pid, label, decoder.current);
      if (state === "present") kill("SIGKILL");
      if (state !== "absent")
        await waitForProcessGroupSettlement(pid, label, decoder.current, settlementEnd);
    }
    await windowsTermination;
    if ((await Promise.race([Promise.all([done, streams]).then(() => true), deadline])) === false)
      throw cleanupFailure(label, decoder.current);
    if (options.log) await writeFile(options.log, Buffer.concat(log));
    if (spawnFailed) throw new HarnessError("startup", label, decoder.current);
    if (issue) throw issue;
    if (outcome.code !== 0 || outcome.signal)
      throw new HarnessError(category, label, decoder.current);
    if (options.progress) {
      try {
        decoder.finish();
      } catch {
        throw new HarnessError("output", label, decoder.current);
      }
    }
    return Buffer.concat(stdout).toString("utf8");
  } catch (error) {
    if (error instanceof HarnessError) throw error;
    throw new HarnessError(category, label, decoder.current);
  } finally {
    clearTimeout(timeout);
    // Keep escalation owned after an unconfirmed return; do not strand a child.
    if (settled) clearTimeout(killTimer);
    clearTimeout(settlementTimer);
    options.signal?.removeEventListener("abort", abort);
    if (!settled) {
      child.stdout.destroy();
      child.stderr.destroy();
      child.unref();
    }
  }
}
