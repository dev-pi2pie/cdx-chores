import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { startOwnedProcess, type OwnedProcessResult } from "./process.ts";

/** Explicit Phase 1 verification entry point; not discovered by bare bun test. */
const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const scratchParent = join(repoRoot, "examples/playground/.tmp-tests");
const codex = join(repoRoot, "node_modules/.bin/codex");
const fixture = join(repoRoot, "test/test-runner/fixtures/codex-lifecycle.ts");
const limits = { timeoutMs: 30_000, graceMs: 1000, cleanupMs: 3000 };
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--attempts" || !/^[1-5]$/.test(args[1]!)) {
  throw new Error("Usage: node scripts/testing/verify-codex-lifecycle.ts --attempts <1-5>");
}
const attempts = Number(args[1]);
const abort = new AbortController();
const cancel = () => abort.abort();
process.on("SIGINT", cancel);
process.on("SIGTERM", cancel);

function diagnostics(result: OwnedProcessResult) {
  return {
    ok: result.ok,
    reason: result.reason,
    exitCode: result.exitCode,
    signal: result.signal,
    elapsedMs: result.elapsedMs,
    drainMs: result.drainMs,
    stopped: result.stopped,
    groupId: result.groupId,
    escalated: result.escalated,
    issues: result.issues,
    signals: result.signals,
    maximumGroupMembers: Math.max(0, ...result.observations.map((sample) => sample.members.length)),
    executables: [
      ...new Set(
        result.observations.flatMap((sample) => sample.members.map((member) => member.executable)),
      ),
    ].sort(),
    observedStates: [
      ...new Set(
        result.observations.flatMap((sample) => sample.members.map((member) => member.state)),
      ),
    ].sort(),
  };
}

try {
  await mkdir(scratchParent, { recursive: true });
  for (let attempt = 1; attempt <= attempts && !abort.signal.aborted; attempt++) {
    for (const mode of ["protocol", "transport"] as const) {
      if (abort.signal.aborted) break;
      const root = await mkdtemp(join(scratchParent, "codex-lifecycle-"));
      let stopped = true;
      try {
        for (const directory of ["home", "tmp", "project", "config", "cache", "data"]) {
          await mkdir(join(root, directory));
        }
        await mkdir(join(root, "home/.codex"));
        const env = {
          PATH: process.env.PATH,
          HOME: join(root, "home"),
          CODEX_HOME: join(root, "home/.codex"),
          TMPDIR: join(root, "tmp"),
          XDG_CONFIG_HOME: join(root, "config"),
          XDG_CACHE_HOME: join(root, "cache"),
          XDG_DATA_HOME: join(root, "data"),
          GIT_CEILING_DIRECTORIES: root,
        };
        const version = await startOwnedProcess({
          ...limits,
          timeoutMs: 5000,
          executable: process.execPath,
          args: [codex, "--version"],
          cwd: root,
          env,
          signal: abort.signal,
        }).completion;
        stopped = version.stopped;
        if (!version.ok || !/^codex-cli \d+\.\d+\.\d+\s*$/.test(version.stdout)) {
          process.stdout.write(
            JSON.stringify({ attempt, mode, stage: "version", ...diagnostics(version) }) + "\n",
          );
          process.exitCode = 1;
          if (!stopped) returnFromUnverified(root);
          continue;
        }
        const result = await startOwnedProcess({
          ...limits,
          executable: process.execPath,
          args: [fixture, mode, codex, root],
          cwd: root,
          env,
          signal: abort.signal,
        }).completion;
        stopped = result.stopped;
        const observedNativeChild = result.observations.some((sample) =>
          sample.members.some(
            (member) => member.executable === "codex" && member.pid !== result.pid,
          ),
        );
        const checkedRequests =
          result.stdout.trim() === JSON.stringify({ mode, checkedRequests: 3 });
        const verified = result.ok && observedNativeChild && checkedRequests;
        process.stdout.write(
          JSON.stringify({
            attempt,
            mode,
            terminal: Boolean(process.stdout.isTTY),
            node: process.version,
            codex: version.stdout.trim(),
            limits,
            observedNativeChild,
            checkedRequests,
            verified,
            ...(result.ok
              ? {}
              : {
                  diagnostic: result.stderr
                    .slice(0, 4096)
                    .replaceAll(root, "<fixture>")
                    .replaceAll(repoRoot, "<repo>"),
                }),
            ...diagnostics(result),
          }) + "\n",
        );
        if (!verified) process.exitCode = 1;
        if (!stopped) returnFromUnverified(root);
      } finally {
        if (stopped) await rm(root, { recursive: true, force: true });
      }
    }
  }
} finally {
  process.off("SIGINT", cancel);
  process.off("SIGTERM", cancel);
  if (abort.signal.aborted) process.exitCode = 1;
}

function returnFromUnverified(root: string): never {
  throw new Error(`Process completion unverified; retained ${relative(repoRoot, root)}`);
}
