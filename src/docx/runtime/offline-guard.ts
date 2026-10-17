import childProcess from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
import net from "node:net";
import tls from "node:tls";

/** Interception is an offline regression check, not an OS security sandbox. */
export function installOfflineGuard(): { assertNoAttempts(): void } {
  const counts = new Map<string, number>();
  const controls: (() => void)[] = [];
  const marker = "docx_offline_guard_intercepted";
  const sentinel = "/docx-baseline-synthetic-never-load.png";
  function trap(
    owner: object,
    key: string,
    label: string,
    controlArguments: unknown[],
    predicate: (value: unknown) => boolean = () => true,
  ): void {
    const mutable = owner as Record<string, (...args: unknown[]) => unknown>;
    const original = mutable[key];
    if (typeof original !== "function") throw new Error("docx_offline_guard_failed");
    mutable[key] = function (...args: unknown[]) {
      if (!predicate(args[0])) return original.apply(this, args);
      counts.set(label, (counts.get(label) ?? 0) + 1);
      throw new Error(marker);
    };
    controls.push(() => {
      let intercepted = false;
      try {
        mutable[key]!(...controlArguments);
      } catch (error) {
        intercepted = error instanceof Error && error.message === marker;
      }
      if (!intercepted) throw new Error("docx_offline_guard_failed");
    });
  }
  trap(globalThis, "fetch", "fetch", ["https://example.invalid/positive-control"]);
  for (const [scheme, owner] of [
    ["http", http],
    ["https", https],
  ] as const) {
    for (const key of ["request", "get"])
      trap(owner, key, `${scheme}.${key}`, [`${scheme}://example.invalid/positive-control`]);
  }
  for (const key of ["connect", "createConnection"]) trap(net, key, `net.${key}`, [{ port: 1 }]);
  trap(tls, "connect", "tls.connect", [{ port: 1 }]);
  for (const key of ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"])
    trap(childProcess, key, `child_process.${key}`, ["docx-positive-control"]);
  const isSentinel = (value: unknown) =>
    String(value).includes("docx-baseline-synthetic-never-load.png");
  for (const key of ["readFile", "readFileSync", "createReadStream"])
    trap(fs, key, `fs.${key}`, [sentinel], isSentinel);
  trap(fs.promises, "readFile", "fs.promises.readFile", [sentinel], isSentinel);
  syncBuiltinESMExports();
  for (const control of controls) control();
  if (counts.size !== controls.length || [...counts.values()].some((value) => value !== 1))
    throw new Error("docx_offline_guard_failed");
  counts.clear();
  return {
    assertNoAttempts() {
      if (counts.size !== 0) throw new Error("docx_offline_guard_failed");
    },
  };
}
