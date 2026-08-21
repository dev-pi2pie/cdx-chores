import { describe, expect, test } from "bun:test";
import { Command } from "commander";

import { registerCliCommands } from "../src/cli/commands";
import type { InteractiveSessionOptions } from "../src/cli/interactive/session";
import { createInteractiveSession } from "../src/cli/interactive/session";
import { createCapturedRuntime, runCli } from "./helpers/cli-test-utils";

function createInteractiveTimeoutHarness() {
  const { runtime, stderr, stdout } = createCapturedRuntime({ colorEnabled: false });
  const sessionCalls: InteractiveSessionOptions[] = [];
  const program = new Command();
  program
    .name("cdx-chores")
    .showHelpAfterError()
    .exitOverride()
    .configureOutput({
      writeOut: (value) => stdout.write(value),
      writeErr: (value) => stderr.write(value),
    });
  registerCliCommands(program, runtime, {
    runInteractiveModeImpl: async (_runtime, _impls, sessionOptions) => {
      sessionCalls.push(sessionOptions ?? {});
    },
  });
  return {
    parse: (args: string[]) => program.parseAsync(["node", "test", ...args]),
    sessionCalls,
    stderr,
  };
}

async function expectParseFailure(
  harness: ReturnType<typeof createInteractiveTimeoutHarness>,
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

describe("Interactive Codex timeout command contract", () => {
  test("normalizes the explicit session timeout before Interactive entry", async () => {
    const harness = createInteractiveTimeoutHarness();

    await harness.parse(["interactive", "--codex-timeout", "2m"]);

    expect(harness.sessionCalls).toEqual([{ codexTimeoutMs: 120_000 }]);
  });

  test("keeps the command input optional and resolves the shared default in session state", async () => {
    const harness = createInteractiveTimeoutHarness();

    await harness.parse(["interactive"]);

    expect(harness.sessionCalls).toEqual([{ codexTimeoutMs: undefined }]);
    expect(createInteractiveSession()).toEqual({ codexTimeoutMs: 30_000 });
  });

  test.each(["30", "11m"])(
    "rejects invalid duration %s before Interactive entry",
    async (value) => {
      const harness = createInteractiveTimeoutHarness();

      await expectParseFailure(harness, ["interactive", "--codex-timeout", value]);

      expect(harness.sessionCalls).toEqual([]);
    },
  );

  test("rejects a repeated duration before Interactive entry", async () => {
    const harness = createInteractiveTimeoutHarness();

    await expectParseFailure(harness, [
      "interactive",
      "--codex-timeout",
      "30s",
      "--codex-timeout",
      "45s",
    ]);

    expect(harness.sessionCalls).toEqual([]);
  });

  test("documents the option only on explicit Interactive help", () => {
    const help = runCli(["interactive", "--help"]);
    const root = runCli(["--help"]);

    expect(help.exitCode).toBe(0);
    expect(help.stdout).toMatch(/--codex-timeout <duration>\s+Timeout for each Codex request/u);
    expect(root.stdout).not.toContain("--codex-timeout");
  });

  test("rejects the root-level spelling without starting Interactive mode", () => {
    const result = runCli(["--codex-timeout", "2m"]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("unknown option '--codex-timeout'");
    expect(result.stdout).not.toContain("Choose a command");
  });
});
