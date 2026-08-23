import { describe, expect, test } from "bun:test";
import { Command } from "commander";

import {
  actionDataQuery,
  actionDataQueryCodex,
  type DataQueryCodexOptions,
  type DataQueryOptions,
} from "../../../src/cli/actions";
import { registerDataQueryCommands } from "../../../src/cli/commands/data/query";
import { createCapturedRuntime, runCli } from "../../helpers/cli-test-utils";

interface DataQueryCodexTimeoutCommandHarness {
  parse: (args: string[]) => Promise<unknown>;
  queryCalls: DataQueryOptions[];
  queryCodexCalls: DataQueryCodexOptions[];
  stderr: { text: string };
}

function createDataQueryCodexTimeoutCommandHarness(): DataQueryCodexTimeoutCommandHarness {
  const { runtime, stdout, stderr } = createCapturedRuntime({ colorEnabled: false });
  const queryCalls: DataQueryOptions[] = [];
  const queryCodexCalls: DataQueryCodexOptions[] = [];
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

  return {
    parse: (args) => program.parseAsync(["node", "test", ...args]),
    queryCalls,
    queryCodexCalls,
    stderr,
  };
}

async function expectParseFailure(
  harness: DataQueryCodexTimeoutCommandHarness,
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

function expectNoActionCalls(harness: DataQueryCodexTimeoutCommandHarness): void {
  expect(harness.queryCalls).toEqual([]);
  expect(harness.queryCodexCalls).toEqual([]);
}

describe("direct data Codex timeout command routing", () => {
  test("normalizes data query codex timeout before action invocation", async () => {
    const harness = createDataQueryCodexTimeoutCommandHarness();

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
});

describe("direct data Codex timeout validation", () => {
  test("rejects invalid duration before work for data query codex", async () => {
    const harness = createDataQueryCodexTimeoutCommandHarness();

    await expectParseFailure(harness, [
      "data",
      "query",
      "codex",
      "missing.csv",
      "--intent",
      "list rows",
      "--codex-timeout",
      "30",
    ]);

    expectNoActionCalls(harness);
    expect(harness.stderr.text).toContain(
      "--codex-timeout must be a positive integer duration using ms, s, or m",
    );
  });

  test("rejects repeated duration before work for data query codex", async () => {
    const harness = createDataQueryCodexTimeoutCommandHarness();

    await expectParseFailure(harness, [
      "data",
      "query",
      "codex",
      "missing.csv",
      "--intent",
      "list rows",
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
  test("documents the per-request duration for data query codex", () => {
    const result = runCli(["data", "query", "codex", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toMatch(/--codex-timeout <duration>\s+Timeout for each Codex/u);
  });
});
