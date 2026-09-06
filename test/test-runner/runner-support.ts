import { expect } from "bun:test";
import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Writable } from "node:stream";

import {
  runManagedTests,
  type RunnerDependencies,
  type RunnerOptions,
} from "../../scripts/testing/orchestration/runner.ts";
import {
  allocateRun,
  readFixtureContext,
  removeRun,
  type RunContext,
} from "../../scripts/testing/ownership/run-context.ts";
import type {
  OwnedProcessOptions,
  OwnedProcessResult,
} from "../../scripts/testing/execution/process.ts";
import { SUITES, UNIT_IGNORE_PATTERNS } from "../../scripts/testing/suites/selection.ts";
import { withTempFixtureDir } from "../helpers/cli-test-utils";

export function completed(overrides: Partial<OwnedProcessResult> = {}): OwnedProcessResult {
  return {
    ok: true,
    reason: "completed",
    groupId: 12345,
    pid: 12345,
    exitCode: 0,
    signal: null,
    stdout: "",
    stderr: "",
    elapsedMs: 1,
    drainMs: 0,
    stopped: true,
    escalated: false,
    issues: [],
    observations: [],
    signals: [],
    ...overrides,
  };
}

export function reportPath(options: OwnedProcessOptions): string {
  const flag = options.args.find((arg) => arg.startsWith("--reporter-outfile="));
  if (!flag) throw new Error("Runner did not designate a report.");
  return flag.slice("--reporter-outfile=".length);
}

export async function writeReport(
  options: OwnedProcessOptions,
  cases = '<testcase name="one" assertions="1"/>',
  file?: string,
): Promise<void> {
  const selected = options.args.find((arg) => arg.endsWith(".test.ts"));
  await writeFile(
    reportPath(options),
    `<testsuites><testsuite file="${file ?? selected}">${cases}</testsuite></testsuites>`,
    { flag: "wx" },
  );
}

export async function withRunner(
  run: (fixture: {
    repo: string;
    roots: RunContext[];
    events: string[];
    output: string[];
    invoke(args?: string[], overrides?: RunnerOptions): ReturnType<typeof runManagedTests>;
  }) => Promise<void>,
): Promise<void> {
  await withTempFixtureDir("runner-contract", async (owner) => {
    const repo = join(owner, "repo");
    await mkdir(join(repo, "test"), { recursive: true });
    await writeFile(
      join(repo, "bunfig.toml"),
      `[test]\nroot = "./test"\npathIgnorePatterns = ${JSON.stringify(UNIT_IGNORE_PATTERNS)}\n`,
    );
    for (const suite of SUITES) {
      await writeFile(
        join(repo, `test/example.${suite}.test.ts`),
        'import {expect,test} from "bun:test";test("one",()=>expect(1).toBe(1));',
      );
    }
    const roots: RunContext[] = [];
    const events: string[] = [];
    const output: string[] = [];
    const dependencies: Partial<RunnerDependencies> = {
      capabilities: () => {},
      allocate: async (...args) => {
        const context = await allocateRun(...args);
        roots.push(context);
        return context;
      },
      preflight: async ({ suite }) => {
        events.push(`preflight:${suite}`);
        return { process: completed() };
      },
      execute: async (options) => {
        const context = readFixtureContext(options.env, repo)!;
        events.push(`execute:${context.suite}`);
        expect(options.args.filter((arg) => arg.endsWith(".test.ts"))).toEqual([
          `./test/example.${context.suite}.test.ts`,
        ]);
        await writeReport(options);
        return completed();
      },
    };
    try {
      await run({
        repo,
        roots,
        events,
        output,
        invoke: (args = ["all"], overrides = {}) =>
          runManagedTests(repo, args, {
            sourceEnv: { PATH: process.env.PATH },
            streams: {
              stdout: new Writable({
                write(chunk, _encoding, callback) {
                  output.push(chunk.toString());
                  callback();
                },
              }),
              stderr: new Writable({
                write(chunk, _encoding, callback) {
                  output.push(chunk.toString());
                  callback();
                },
              }),
            },
            ...overrides,
            dependencies: { ...dependencies, ...overrides.dependencies },
          }),
      });
    } finally {
      // These seams never launch work. Retained fake-failure roots can therefore
      // be removed using their original identities after assertions finish.
      for (const context of roots) {
        try {
          await access(context.root);
        } catch {
          continue;
        }
        await removeRun(context);
      }
    }
  });
}
