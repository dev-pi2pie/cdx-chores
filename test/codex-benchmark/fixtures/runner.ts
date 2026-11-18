import { expect } from "bun:test";
import { chmod, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { startFixtureProcess } from "../../../scripts/testing/fixtures/fixture-process.ts";
import type { BenchmarkOptions } from "../../../src/adapters/codex/benchmark/types";
import { REPO_ROOT, withTempFixtureDir } from "../../helpers/cli-test-utils";

interface Scenario {
  phase?: string | null;
  delayed?: boolean;
  fallback?: boolean;
  tool?: boolean;
  rerouted?: boolean;
  interrupt?: "confirmed" | "unconfirmed";
  withholdStartReply?: boolean;
  failFirst?: boolean;
  rejectFast?: boolean;
  retentionError?: boolean;
  usageSnapshots?: Array<Record<string, number> | null>;
  resistantWorker?: boolean;
  streamText?: "matching" | "unrelated";
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
    options: BenchmarkOptions;
    trace: () => Promise<BenchmarkProtocolEvent[]>;
  }) => Promise<T>,
): Promise<T> {
  return withTempFixtureDir("codex-benchmark-runner", async (root) => {
    const home = join(root, "codex-home");
    const executable = join(root, "codex-fixture.cjs");
    const tracePath = join(home, "events.jsonl");
    await mkdir(home);
    await copyFile(
      join(REPO_ROOT, "test/codex-benchmark/fixtures/benchmark-app-server.cjs"),
      executable,
    );
    await chmod(executable, 0o755);
    await writeFile(join(home, "scenario.json"), JSON.stringify(scenario));
    await writeFile(join(home, "unrelated.jsonl"), "unrelated\n");
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
      trace: async () => {
        const text = await readFile(tracePath, "utf8").catch((error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return "";
          throw error;
        });
        return text
          .split("\n")
          .slice(0, -1)
          .map((line) => JSON.parse(line) as BenchmarkProtocolEvent);
      },
    });
    expect(await readFile(join(home, "unrelated.jsonl"), "utf8")).toBe("unrelated\n");
    return result;
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
