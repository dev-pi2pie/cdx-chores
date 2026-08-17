import { describe, expect, test } from "bun:test";
import { Command } from "commander";

import { actionDoctor } from "../src/cli/actions";
import { registerCliCommands } from "../src/cli/commands";
import type { DoctorOptions } from "../src/cli/actions/doctor";
import { createActionTestRuntime } from "./helpers/cli-action-test-utils";
import { runCli } from "./helpers/cli-test-utils";
import { createDoctorFixture } from "./helpers/doctor-test-fixtures";

function createProgram(
  options: {
    actionDoctorImpl?: typeof actionDoctor;
  } = {},
): {
  parse: (args: string[]) => Promise<unknown>;
  stderr: { text: string };
} {
  const { runtime, stdout, stderr } = createActionTestRuntime({ colorEnabled: false });
  const program = new Command();
  program
    .name("cdx-chores")
    .showHelpAfterError()
    .exitOverride()
    .configureOutput({
      writeOut: (value) => stdout.write(value),
      writeErr: (value) => stderr.write(value),
    });
  registerCliCommands(program, runtime, options);
  return {
    parse: (args) => program.parseAsync(["node", "test", ...args]),
    stderr,
  };
}

describe("doctor command routing", () => {
  test.each([
    [[], { details: false, json: false }],
    [["--details"], { details: true, json: false }],
    [["--json"], { details: false, json: true }],
  ] as const)("routes %j to one selected view", async (args, expected) => {
    const calls: DoctorOptions[] = [];
    const program = createProgram({
      actionDoctorImpl: async (_runtime, options) => {
        calls.push(options ?? {});
      },
    });

    await program.parse(["doctor", ...args]);

    expect(calls).toEqual([expected]);
    expect(program.stderr.text).toBe("");
  });

  test.each([
    ["--details", "--json"],
    ["--json", "--details"],
  ] as const)("rejects conflicting view flags in order %s then %s", async (first, second) => {
    const fixture = createDoctorFixture();
    let actionCalls = 0;
    const program = createProgram({
      actionDoctorImpl: async (runtime, options) => {
        actionCalls += 1;
        await actionDoctor(runtime, { ...options, inspectors: fixture.inspectors });
      },
    });

    let exitCode: number | undefined;
    try {
      await program.parse(["doctor", first, second]);
    } catch (error) {
      exitCode = (error as { exitCode?: number }).exitCode;
    }

    expect(exitCode).toBe(1);
    expect(program.stderr.text).toContain(
      "error: option '--details' cannot be used with option '--json'",
    );
    expect(program.stderr.text).toContain("Usage: cdx-chores doctor [options]");
    expect(actionCalls).toBe(0);
    expect(fixture.calls).toEqual({ commands: [], query: 0, codex: 0 });
  });

  test("exposes accepted help text and built-CLI conflict behavior", () => {
    const help = runCli(["doctor", "--help"]);
    const conflict = runCli(["doctor", "--details", "--json"]);

    expect(help.exitCode).toBe(0);
    expect(help.stderr).toBe("");
    expect(help.stdout).toMatch(/--details\s+Output detailed human-readable evidence/u);
    expect(conflict.exitCode).toBe(1);
    expect(conflict.stdout).toBe("");
    expect(conflict.stderr).toContain(
      "error: option '--details' cannot be used with option '--json'",
    );
    expect(conflict.stderr).toContain("Usage: cdx-chores doctor [options]");
  });

  test("routes all three views through the built CLI", () => {
    const compact = runCli(["doctor"]);
    const details = runCli(["doctor", "--details"]);
    const json = runCli(["doctor", "--json"]);

    expect(compact.exitCode).toBe(0);
    expect(compact.stderr).toBe("");
    expect(compact.stdout).toContain("Workflows:");
    expect(compact.stdout).not.toContain("Platform:");
    expect(details.exitCode).toBe(0);
    expect(details.stderr).toBe("");
    expect(details.stdout).toContain("Platform:");
    expect(details.stdout).toContain("Markdown PDF renderer capabilities:");
    expect(json.exitCode).toBe(0);
    expect(json.stderr).toBe("");
    expect(JSON.parse(json.stdout)).toHaveProperty("capabilities");
  });
});
