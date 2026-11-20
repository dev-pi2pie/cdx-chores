import { expect } from "bun:test";
import { chmod, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import {
  isLiveProcess,
  requireProcessObservation,
} from "../../../scripts/testing/execution/process-table";
import { startFixtureProcess } from "../../../scripts/testing/fixtures/fixture-process.ts";
import type { BenchmarkOptions } from "../../../src/adapters/codex/benchmark/types";
import { REPO_ROOT, withTempFixtureDir } from "../../helpers/cli-test-utils";

interface Scenario {
  appServerUserAgent?: string | null;
  initializeError?: boolean;
  stallInitialization?: boolean;
  withholdThreadStartReply?: boolean;
  stallTierLookup?: "model/list" | "config/read";
  rejectFirstLookup?: "model/list" | "config/read";
  configuredModel?: string | null;
  exitDuringReadbackThread?: number;
  endStdoutDuringThread?: number;
  endStdoutAfterThread?: number;
  phase?: string | null;
  delayed?: boolean;
  fallback?: boolean;
  tool?: boolean;
  rerouted?: boolean;
  interrupt?: "confirmed" | "unconfirmed";
  withholdStartReply?: boolean;
  withholdInterruptReply?: boolean;
  withholdStartReplyThread?: number;
  omitTurnStart?: boolean;
  traceLifecycle?: boolean;
  mismatchedCompletion?: "thread" | "turn";
  holdTurnStart?: boolean;
  waitForInterruptThread?: number;
  failThread?: number;
  serverInterrupt?: { thread: number; message: string | null };
  rejectFast?: string;
  rejectStart?: "thread/start" | "turn/start";
  rejectThreadStartAt?: number;
  rejectTurnStartThread?: number;
  threadStartReply?: { at: number; result: unknown };
  turnStartReply?: { at: number; result: unknown; announce?: boolean; complete?: boolean };
  turnStartRefusal?: {
    at: number;
    error: { code: number; message: string; data?: unknown };
    evidence?: "started" | "terminal" | "pair" | "item" | "other-thread";
    errorFirst?: boolean;
  };
  conflictingStart?: "after-reply" | "during-readback" | "during-retention";
  unfinishedRolloutThread?: number;
  closeStdinOnThreadStart?: number;
  retentionError?: boolean;
  usageSnapshots?: Array<Record<string, number> | null>;
  resistantWorker?: boolean;
  resistantLeader?: boolean;
  streamText?: "matching" | "unrelated";
  threadSettings?: Array<{ serviceTier?: string | null; reasoningEffort?: string | null }>;
}

export interface BenchmarkProtocolEvent {
  method: string;
  params?: Record<string, unknown>;
}

export function traceMethod(events: BenchmarkProtocolEvent[], method: string) {
  return events.filter((event) => event.method === method);
}

export async function withRunnerFixture<T>(
  scenario: Scenario,
  exercise: (fixture: {
    home: string;
    options: Extract<BenchmarkOptions, { models: readonly string[] }>;
    trace: () => Promise<BenchmarkProtocolEvent[]>;
  }) => Promise<T>,
): Promise<T> {
  return withTempFixtureDir("codex-benchmark-runner", async (root) => {
    const home = join(root, "codex-home");
    const executable = join(root, "codex-fixture.mjs");
    const tracePath = join(home, "events.jsonl");
    await mkdir(home);
    await copyFile(
      join(REPO_ROOT, "test/codex-benchmark/fixtures/benchmark-app-server.mjs"),
      executable,
    );
    await chmod(executable, 0o755);
    await writeFile(join(home, "scenario.json"), JSON.stringify(scenario));
    await writeFile(join(home, "unrelated.jsonl"), "unrelated\n");
    const trace = async () => {
      const text = await readFile(tracePath, "utf8").catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return "";
        throw error;
      });
      return text
        .split("\n")
        .slice(0, -1)
        .map((line) => JSON.parse(line) as BenchmarkProtocolEvent);
    };
    try {
      const result = await exercise({
        home,
        options: {
          cwd: root,
          env: {
            PATH: process.env.PATH,
            HOME: root,
            CODEX_HOME: home,
            CDX_CHORES_CODEX_PATH: executable,
          },
          models: [],
          speeds: [],
          runs: 1,
          prompt: "fixture prompt",
        },
        trace,
      });
      expect(await readFile(join(home, "unrelated.jsonl"), "utf8")).toBe("unrelated\n");
      return result;
    } finally {
      if (scenario.closeStdinOnThreadStart !== undefined) {
        const pid = traceMethod(await trace(), "stdin-closed")[0]?.params?.pid;
        if (typeof pid === "number") {
          await writeFile(join(home, "release-shutdown"), "");
          const live = () =>
            requireProcessObservation().some((entry) => entry.pid === pid && isLiveProcess(entry));
          const deadline = performance.now() + 1_000;
          while (live() && performance.now() < deadline) await delay(20);
          expect(live()).toBe(false);
        }
      }
    }
  });
}

export function startCliBenchmark(options: BenchmarkOptions, args: string[], preload?: string) {
  return startFixtureProcess({
    executable: process.execPath,
    args: [
      ...(preload ? ["--preload", preload] : []),
      join(REPO_ROOT, "src/bin.ts"),
      "codex-bench",
      "--runs",
      String(options.runs),
      ...args,
    ],
    cwd: options.cwd,
    env: options.env ?? process.env,
    timeoutMs: 10_000,
    graceMs: 600,
    cleanupMs: 1_500,
  });
}

export async function withStderrTtyPreload(cwd: string, writeTrace?: string): Promise<string> {
  const path = join(cwd, "stderr-tty.cjs");
  const traceScript = writeTrace
    ? `
const { appendFileSync } = require("node:fs");
for (const name of ["stdout", "stderr"]) {
  const stream = process[name];
  const write = stream.write;
  stream.write = function (chunk, ...args) {
    appendFileSync(${JSON.stringify(writeTrace)}, JSON.stringify({ name, text: String(chunk) }) + "\\n");
    return write.call(this, chunk, ...args);
  };
}
`
    : "";
  await writeFile(
    path,
    "Object.defineProperties(process.stderr, { isTTY: { value: true }, columns: { value: 110 } });" +
      traceScript,
  );
  return path;
}
