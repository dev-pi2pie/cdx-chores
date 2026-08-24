import { describe, expect, test } from "bun:test";
import { Command } from "commander";

import {
  actionDataStack,
  actionDataStackReplay,
  type DataStackOptions,
  type DataStackReplayOptions,
} from "../../../src/cli/actions";
import { registerDataStackCommand } from "../../../src/cli/commands/data/stack";
import { createCapturedRuntime, runCli } from "../../helpers/cli-test-utils";

interface DataStackCodexTimeoutCommandHarness {
  parse: (args: string[]) => Promise<unknown>;
  replayCalls: DataStackReplayOptions[];
  stackCalls: DataStackOptions[];
  stderr: { text: string };
}

function createDataStackCodexTimeoutCommandHarness(): DataStackCodexTimeoutCommandHarness {
  const { runtime, stdout, stderr } = createCapturedRuntime({ colorEnabled: false });
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
    replayCalls,
    stackCalls,
    stderr,
  };
}

async function expectParseFailure(
  harness: DataStackCodexTimeoutCommandHarness,
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

function expectNoActionCalls(harness: DataStackCodexTimeoutCommandHarness): void {
  expect(harness.stackCalls).toEqual([]);
  expect(harness.replayCalls).toEqual([]);
}

describe("direct data Codex timeout command routing", () => {
  test("normalizes data stack timeout without enabling Codex assist", async () => {
    const harness = createDataStackCodexTimeoutCommandHarness();

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
    const harness = createDataStackCodexTimeoutCommandHarness();

    await harness.parse(["data", "stack", "replay", "stack-plan.json"]);

    expect(harness.stackCalls).toEqual([]);
    expect(harness.replayCalls).toHaveLength(1);
    expect(harness.replayCalls[0]).toMatchObject({ record: "stack-plan.json" });
  });
});

describe("direct data Codex timeout validation", () => {
  test("rejects invalid duration before work for data stack", async () => {
    const harness = createDataStackCodexTimeoutCommandHarness();

    await expectParseFailure(harness, [
      "data",
      "stack",
      "missing.csv",
      "--output",
      "merged.csv",
      "--codex-timeout",
      "30",
    ]);

    expectNoActionCalls(harness);
    expect(harness.stderr.text).toContain(
      "--codex-timeout must be a positive integer duration using ms, s, or m",
    );
  });

  test("rejects repeated duration before work for data stack", async () => {
    const harness = createDataStackCodexTimeoutCommandHarness();

    await expectParseFailure(harness, [
      "data",
      "stack",
      "missing.csv",
      "--output",
      "merged.csv",
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
  test("documents the per-request duration for data stack", () => {
    const result = runCli(["data", "stack", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toMatch(/--codex-timeout <duration>\s+Timeout for each Codex/u);
  });
});
