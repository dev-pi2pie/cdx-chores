import { describe, expect, test } from "bun:test";
import { Command } from "commander";

import {
  actionDataQuery,
  actionDataQueryCodex,
  actionDataStack,
  actionDataStackReplay,
  type DataQueryCodexOptions,
  type DataQueryOptions,
  type DataStackOptions,
  type DataStackReplayOptions,
} from "../src/cli/actions";
import { registerDataQueryCommands } from "../src/cli/commands/data/query";
import { registerDataStackCommand } from "../src/cli/commands/data/stack";
import { createCapturedRuntime, runCli } from "./helpers/cli-test-utils";

interface DataCodexTimeoutCommandHarness {
  parse: (args: string[]) => Promise<unknown>;
  queryCalls: DataQueryOptions[];
  queryCodexCalls: DataQueryCodexOptions[];
  replayCalls: DataStackReplayOptions[];
  stackCalls: DataStackOptions[];
  stderr: { text: string };
}

function createDataCodexTimeoutCommandHarness(): DataCodexTimeoutCommandHarness {
  const { runtime, stdout, stderr } = createCapturedRuntime({ colorEnabled: false });
  const queryCalls: DataQueryOptions[] = [];
  const queryCodexCalls: DataQueryCodexOptions[] = [];
  const stackCalls: DataStackOptions[] = [];
  const replayCalls: DataStackReplayOptions[] = [];
  const program = new Command();
  program
    .name("cdx-chores")
    .showHelpAfterError()
    .exitOverride()
    .configureOutput({
      writeOut: (value) => stdout.write(value),
      writeErr: (value) => stderr.write(value),
    });
  const dataCommand = program.command("data");
  registerDataQueryCommands(dataCommand, runtime, {
    actionDataQuery: (async (_runtime, options) => {
      queryCalls.push(options);
    }) satisfies typeof actionDataQuery,
    actionDataQueryCodex: (async (_runtime, options) => {
      queryCodexCalls.push(options);
    }) satisfies typeof actionDataQueryCodex,
  });
  registerDataStackCommand(dataCommand, runtime, {
    actionDataStack: (async (_runtime, options) => {
      stackCalls.push(options);
    }) satisfies typeof actionDataStack,
    actionDataStackReplay: (async (_runtime, options) => {
      replayCalls.push(options);
    }) satisfies typeof actionDataStackReplay,
  });

  return {
    parse: (args) => program.parseAsync(["node", "test", ...args]),
    queryCalls,
    queryCodexCalls,
    replayCalls,
    stackCalls,
    stderr,
  };
}

async function expectParseFailure(
  harness: DataCodexTimeoutCommandHarness,
  args: string[],
): Promise<void> {
  try {
    await harness.parse(args);
  } catch (error) {
    expect(error).toHaveProperty("exitCode", 1);
    return;
  }
  throw new Error("Expected Commander parsing to fail");
}

function expectNoActionCalls(harness: DataCodexTimeoutCommandHarness): void {
  expect(harness.queryCalls).toEqual([]);
  expect(harness.queryCodexCalls).toEqual([]);
  expect(harness.stackCalls).toEqual([]);
  expect(harness.replayCalls).toEqual([]);
}

describe("direct data Codex timeout command routing", () => {
  test("normalizes data query codex timeout before action invocation", async () => {
    const harness = createDataCodexTimeoutCommandHarness();

    await harness.parse([
      "data",
      "query",
      "codex",
      "missing.csv",
      "--intent",
      "list rows",
      "--codex-timeout",
      "2m",
    ]);

    expect(harness.queryCodexCalls).toHaveLength(1);
    expect(harness.queryCodexCalls[0]).toMatchObject({
      input: "missing.csv",
      intent: "list rows",
      timeoutMs: 120_000,
    });
  });

  test("normalizes data stack timeout without enabling Codex assist", async () => {
    const harness = createDataCodexTimeoutCommandHarness();

    await harness.parse([
      "data",
      "stack",
      "missing.csv",
      "--output",
      "merged.csv",
      "--codex-timeout",
      "45s",
    ]);

    expect(harness.stackCalls).toHaveLength(1);
    expect(harness.stackCalls[0]).toMatchObject({
      codexTimeoutMs: 45_000,
      output: "merged.csv",
      sources: ["missing.csv"],
    });
    expect(harness.stackCalls[0]?.codexAssist).not.toBe(true);
  });

  test("keeps data stack replay routed only to the replay action", async () => {
    const harness = createDataCodexTimeoutCommandHarness();

    await harness.parse(["data", "stack", "replay", "stack-plan.json"]);

    expect(harness.stackCalls).toEqual([]);
    expect(harness.replayCalls).toHaveLength(1);
    expect(harness.replayCalls[0]).toMatchObject({ record: "stack-plan.json" });
  });
});

describe("direct data Codex timeout validation", () => {
  test.each([
    ["data query codex", ["data", "query", "codex", "missing.csv", "--intent", "list rows"]],
    ["data stack", ["data", "stack", "missing.csv", "--output", "merged.csv"]],
  ] as const)("rejects invalid duration before work for %s", async (_label, args) => {
    const harness = createDataCodexTimeoutCommandHarness();

    await expectParseFailure(harness, [...args, "--codex-timeout", "30"]);

    expectNoActionCalls(harness);
    expect(harness.stderr.text).toContain(
      "--codex-timeout must be a positive integer duration using ms, s, or m",
    );
  });

  test.each([
    ["data query codex", ["data", "query", "codex", "missing.csv", "--intent", "list rows"]],
    ["data stack", ["data", "stack", "missing.csv", "--output", "merged.csv"]],
  ] as const)("rejects repeated duration before work for %s", async (_label, args) => {
    const harness = createDataCodexTimeoutCommandHarness();

    await expectParseFailure(harness, [
      ...args,
      "--codex-timeout",
      "30s",
      "--codex-timeout",
      "45s",
    ]);

    expectNoActionCalls(harness);
    expect(harness.stderr.text).toContain("--codex-timeout may only be specified once");
  });
});

describe("direct data Codex timeout help", () => {
  test.each([
    ["data query codex", ["data", "query", "codex", "--help"]],
    ["data stack", ["data", "stack", "--help"]],
  ] as const)("documents the per-request duration for %s", (_label, args) => {
    const result = runCli([...args]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toMatch(/--codex-timeout <duration>\s+Timeout for each Codex/u);
  });
});
