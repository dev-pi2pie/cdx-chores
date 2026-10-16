import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, appendFile, readFile, realpath } from "node:fs/promises";
import { delimiter, dirname, isAbsolute, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

let cleanupUnconfirmed = false;

export function packageProcessCleanupUnconfirmed() {
  return cleanupUnconfirmed;
}

function unconfirmedCleanup() {
  cleanupUnconfirmed = true;
  return new Error("package process cleanup unconfirmed");
}

export async function executable(name) {
  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    if (!isAbsolute(directory)) continue;
    const path = join(directory, name);
    try {
      await access(path, constants.X_OK);
      return await realpath(path);
    } catch {
      // Continue only through the caller's configured executable search path.
    }
  }
  throw new Error("required executable unavailable");
}

/** Avoid shell/version-manager wrappers when invoking npm through the chosen Node. */
export async function npmCli() {
  for (const path of [
    join(dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"),
    await executable("npm"),
  ]) {
    try {
      if ((await readFile(path, "utf8")).startsWith("#!/usr/bin/env node"))
        return await realpath(path);
    } catch {
      // Continue to the executable's canonical JavaScript entry.
    }
  }
  throw new Error("npm JavaScript entry unavailable");
}

function groupExists(pid) {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw unconfirmedCleanup();
  }
}

/** Commands own their process group; cleanup never races a running installer. */
export async function runPackageCommand(path, args, options) {
  if (!isAbsolute(path) || process.platform === "win32")
    throw new Error("package checks require absolute POSIX executables");
  const child = spawn(path, args, {
    cwd: options.cwd,
    env: options.env,
    shell: false,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  let bytes = 0;
  let stopped = false;
  let spawnError;
  let killTimer;
  function kill(signal) {
    if (!child.pid) return;
    try {
      process.kill(-child.pid, signal);
    } catch (error) {
      if (error.code !== "ESRCH") spawnError ??= error;
    }
  }
  function stop() {
    if (stopped) return;
    stopped = true;
    kill("SIGTERM");
    killTimer = setTimeout(() => kill("SIGKILL"), 250);
  }
  const timeout = setTimeout(stop, options.timeout ?? 120_000);
  const chunks = [];
  for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", (chunk) => {
      bytes += chunk.byteLength;
      if (bytes > 4 * 1024 * 1024) return stop();
      chunks.push(chunk);
      if (stream === child.stdout) output += chunk.toString("utf8");
    });
    stream.on("error", (error) => {
      spawnError ??= error;
      stop();
    });
  }
  child.on("error", (error) => {
    spawnError ??= error;
  });
  const code = await new Promise((resolve) => child.once("close", resolve));
  clearTimeout(timeout);
  clearTimeout(killTimer);
  if (child.pid && groupExists(child.pid)) {
    kill("SIGKILL");
    for (let attempt = 0; attempt < 20 && groupExists(child.pid); attempt += 1) await delay(25);
    if (groupExists(child.pid)) throw unconfirmedCleanup();
  }
  await appendFile(options.log, Buffer.concat(chunks));
  if (spawnError || stopped || code !== 0) throw new Error("package command failed");
  return output;
}
