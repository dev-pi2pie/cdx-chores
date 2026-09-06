import { lstatSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import {
  startOwnedProcess,
  type OwnedProcess,
  type OwnedProcessOptions,
  type ProcessObserver,
} from "../execution/process.ts";
import {
  assertRunParent,
  assertRunPath,
  readFixtureContext,
  suitePath,
  type RunContext,
} from "../ownership/run-context.ts";
import type { Suite } from "../suites/selection.ts";

/** Detached nested groups must hand ownership back to the outer suite before Bun exits. */
export function startFixtureProcess(
  options: OwnedProcessOptions,
  observer?: ProcessObserver,
): OwnedProcess {
  const context = readFixtureContext(process.env, resolve(import.meta.dirname, "../../.."));
  if (!context) return startOwnedProcess(options, observer);
  const id = randomUUID();
  const directory = join(suitePath(context.run, context.suite, "scratch"), "processes");
  const write = (suffix: string, value: object) => {
    const path = join(directory, id + suffix + ".json");
    assertRunParent(context.run, path);
    writeFileSync(path, JSON.stringify({ version: 1, id, ...value }), { flag: "wx", mode: 0o600 });
  };
  // An incomplete pending receipt is intentionally unresolved, even before a PID was recorded.
  write(".pending", { state: "pending" });
  const cancellation = new AbortController();
  const cancel = () => cancellation.abort();
  const removeListeners = () => {
    process.off("SIGINT", cancel);
    process.off("SIGTERM", cancel);
    options.signal?.removeEventListener("abort", cancel);
  };
  // Bun owns the outer group; these detached children need its cancellation forwarded.
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) cancel();
  let owned: OwnedProcess;
  try {
    owned = startOwnedProcess({ ...options, signal: cancellation.signal }, observer);
  } catch (error) {
    removeListeners();
    write(".complete", { state: "complete", stopped: true, reason: "launch-rejected" });
    throw error;
  }
  try {
    write(".started", { state: "started", pid: owned.child.pid });
  } catch {
    owned.shutdown();
    // Keep pending unresolved if the handoff itself cannot be persisted.
    return {
      ...owned,
      completion: owned.completion
        .then((result) => ({
          ...result,
          ok: false,
          stopped: false,
          issues: [...result.issues, "Process start receipt could not be persisted."],
        }))
        .finally(removeListeners),
    };
  }
  return {
    ...owned,
    completion: owned.completion
      .then((result) => {
        try {
          write(".complete", {
            state: "complete",
            pid: result.pid,
            groupId: result.groupId,
            stopped: result.stopped,
            reason: result.reason,
          });
          return result;
        } catch {
          return {
            ...result,
            ok: false,
            stopped: false,
            issues: [...result.issues, "Process completion receipt could not be persisted."],
          };
        }
      })
      .finally(removeListeners),
  };
}

export function inspectFixtureProcesses(
  run: RunContext,
  suite: Suite,
): { stopped: boolean; issues: string[] } {
  const directory = join(suitePath(run, suite, "scratch"), "processes");
  const relativeDirectory = "scratch/" + suite + "/processes";
  const issues: string[] = [];
  try {
    assertRunPath(run, relativeDirectory);
    const names = readdirSync(directory);
    const pending = names.filter((name) => /^[a-f0-9-]{36}\.pending\.json$/.test(name));
    if (names.some((name) => !/^[a-f0-9-]{36}\.(pending|started|complete)\.json$/.test(name)))
      throw new Error("Unexpected receipt entry.");
    const read = (name: string): Record<string, unknown> => {
      assertRunPath(run, relativeDirectory + "/" + name);
      const path = join(directory, name);
      const stat = lstatSync(path);
      if (!stat.isFile() || stat.nlink !== 1 || stat.size > 4096)
        throw new Error("Invalid process receipt.");
      const value = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
      if (value.version !== 1 || value.id !== name.slice(0, 36))
        throw new Error("Invalid process receipt identity.");
      return value;
    };
    for (const name of names) {
      if (!names.includes(name.slice(0, 36) + ".pending.json"))
        throw new Error("Orphan process receipt.");
    }
    for (const name of pending) {
      if (read(name).state !== "pending") throw new Error("Invalid pending process receipt.");
      const completion = name.replace(".pending.", ".complete.");
      if (!names.includes(completion)) {
        issues.push("Nested fixture process completion is pending.");
        continue;
      }
      const value = read(completion);
      if (value.state !== "complete" || value.stopped !== true)
        issues.push("Nested fixture process shutdown is unverified.");
      const started = name.replace(".pending.", ".started.");
      if (names.includes(started)) {
        const start = read(started);
        if (
          start.state !== "started" ||
          start.pid !== value.pid ||
          (value.groupId !== undefined && value.groupId !== start.pid)
        )
          throw new Error("Inconsistent process receipt.");
      } else if (value.reason !== "launch-rejected")
        throw new Error("Missing process start receipt.");
    }
  } catch {
    issues.push("Fixture process ownership receipts could not be verified.");
  }
  return { stopped: issues.length === 0, issues };
}
