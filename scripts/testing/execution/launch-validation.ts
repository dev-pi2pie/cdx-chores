import childProcess from "node:child_process";
import { accessSync, constants as fsConstants, statSync } from "node:fs";
import { constants } from "node:os";
import { getSystemErrorMessage, inspect } from "node:util";

import { requireProcessCapabilities } from "./process-capabilities.ts";
import type { OwnedProcessOptions } from "./process.ts";

/** The requested process was rejected before its spawn attempt. */
export class ProcessLaunchRejectedError extends Error {
  declare readonly code?: string;

  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    if (cause instanceof Error && "code" in cause && typeof cause.code === "string") {
      this.code = cause.code;
    }
  }
}

function invalidSpawnValue(
  field: string,
  requirement: string,
  value: string,
  kind: "argument" | "property" = "argument",
): TypeError {
  return Object.assign(
    new TypeError(`The ${kind} '${field}' ${requirement}. Received ${inspect(value)}`),
    { code: "ERR_INVALID_ARG_VALUE" },
  );
}

function pathRejectionCode(code: string | undefined) {
  if (code === "ENOTDIR" || code === "ELOOP" || code === "ENAMETOOLONG") return code;
  return undefined;
}

function statErrorCode(path: string) {
  try {
    statSync(path);
    return undefined;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code;
  }
}

function relativeStatRejectionCode(cwd: string, executable: string) {
  // Resolve the name after chdir without changing the runner's working directory.
  // The helper receives paths as data and only stats the requested executable.
  const inspectPath = `
    const fs = require("node:fs");
    const [parent, cwd, executable] = JSON.parse(fs.readFileSync(0, "utf8"));
    if (parent) process.chdir(parent);
    process.chdir(cwd);
    try { fs.statSync(executable); }
    catch (error) { process.stdout.write(error.code); }
  `;
  try {
    const parent = cwd.startsWith("/") ? null : process.cwd();
    const probe = childProcess.spawnSync(process.execPath, ["-e", inspectPath], {
      cwd: "/",
      env: { HOME: "/" },
      input: JSON.stringify([parent, cwd, executable]),
      encoding: "utf8",
      maxBuffer: 1024,
      timeout: 1_000,
      killSignal: "SIGKILL",
    });
    return !probe.error && probe.status === 0 ? pathRejectionCode(probe.stdout) : undefined;
  } catch {
    return undefined;
  }
}

function launchPathRejectionCode(cwd: string, executable: string) {
  try {
    if (!statSync(cwd).isDirectory()) return "ENOTDIR";
  } catch (error) {
    return pathRejectionCode((error as NodeJS.ErrnoException).code);
  }
  // Leave PATH searches and missing files to the runtime.
  if (!executable.includes("/")) return undefined;
  try {
    accessSync(cwd, fsConstants.X_OK);
  } catch {
    return undefined;
  }
  // Preserve path components such as file/../tool for the filesystem to resolve.
  if (executable.startsWith("/")) return pathRejectionCode(statErrorCode(executable));
  // The combined lookup can hit a length or symlink limit that exec would not.
  if (pathRejectionCode(statErrorCode(`${cwd}/${executable}`))) {
    return relativeStatRejectionCode(cwd, executable);
  }
  return undefined;
}

function pathSpawnError(executable: string, code: "ENOTDIR" | "ELOOP" | "ENAMETOOLONG"): Error {
  // Match the runtime's synchronous diagnostic without entering public spawn().
  const bun = process.versions.bun !== undefined;
  const errno = -constants.errno[code];
  return Object.assign(
    new Error(
      bun
        ? `${code}: ${getSystemErrorMessage(errno)}, posix_spawn '${executable}'`
        : `spawn ${code}`,
    ),
    {
      errno,
      code,
      syscall: "spawn",
      ...(bun ? { path: executable } : {}),
    },
  );
}

export function checkLaunch(options: OwnedProcessOptions) {
  try {
    requireProcessCapabilities();
    for (const value of [options.timeoutMs, options.graceMs, options.cleanupMs]) {
      if (!Number.isSafeInteger(value) || value <= 0) throw new Error("Invalid process deadline.");
    }
    if (options.cleanupMs <= options.graceMs) {
      throw new Error("Cleanup allowance must exceed the graceful shutdown allowance.");
    }
    const maximum = options.maxOutputBytes ?? 1024 * 1024;
    if (!Number.isSafeInteger(maximum) || maximum <= 0) throw new Error("Invalid output limit.");
    if (options.signal?.aborted) throw new Error("Process launch was cancelled before allocation.");
    if (options.output?.signal.aborted)
      throw new Error("Process launch output delivery was already unavailable.");
    const executable = options.executable;
    if (executable === "") throw invalidSpawnValue("file", "cannot be empty", executable);
    const nullByteRequirement = "must be a string without null bytes";
    if (typeof executable === "string" && executable.includes("\0")) {
      throw invalidSpawnValue("file", nullByteRequirement, executable);
    }
    const args = [...options.args];
    for (const [index, arg] of args.entries()) {
      if (typeof arg === "string" && arg.includes("\0")) {
        throw invalidSpawnValue(`args[${index}]`, nullByteRequirement, arg);
      }
    }
    const cwd = options.cwd;
    if (typeof cwd === "string" && cwd.includes("\0")) {
      throw invalidSpawnValue(
        "options.cwd",
        "must be a string or Uint8Array without null bytes",
        cwd,
        "property",
      );
    }
    const env = { ...options.env };
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) continue; // spawn omits undefined entries.
      const candidate = key.includes("\0") ? key : value;
      if (typeof candidate === "string" && candidate.includes("\0")) {
        throw invalidSpawnValue(
          `options.env['${key}']`,
          nullByteRequirement,
          candidate,
          "property",
        );
      }
    }
    if (typeof cwd === "string" && typeof executable === "string") {
      const code = launchPathRejectionCode(cwd, executable);
      if (code) throw pathSpawnError(executable, code);
    }
    return { maximum, executable, args, cwd, env };
  } catch (error) {
    throw new ProcessLaunchRejectedError(error);
  }
}
