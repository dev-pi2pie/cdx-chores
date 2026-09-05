import { describe, expect, test } from "bun:test";
import { Command } from "commander";

import { registerCliCommands } from "../../src/cli/commands";
import type { CodexInfoOptions } from "../../src/cli/actions/codex-info";
import { createCapturedRuntime, runCli } from "../helpers/cli-test-utils";

function harness() {
  const { runtime, stdout, stderr } = createCapturedRuntime();
  const calls: CodexInfoOptions[] = [];
  const program = new Command().exitOverride().configureOutput({
    writeOut: (value) => stdout.write(value),
    writeErr: (value) => stderr.write(value),
  });
  registerCliCommands(program, runtime, {
    actionCodexInfoImpl: async (_runtime, options) => {
      calls.push(options ?? {});
    },
  });
  return {
    calls,
    stdout,
    stderr,
    parse: (args: string[]) => program.parseAsync(args, { from: "user" }),
  };
}

describe("Codex information command contract", () => {
  for (const view of ["summary", "models", "providers"] as const) {
    const command = view === "summary" ? ["codex-info"] : ["codex-info", view];
    for (const flag of [undefined, "--details", "--json"]) {
      test(`${command.join(" ")} ${flag ?? ""} routes once`, async () => {
        const h = harness();
        await h.parse([...command, ...(flag ? [flag] : [])]);
        expect(h.calls).toEqual([{ view, details: flag === "--details", json: flag === "--json" }]);
      });
    }
    test(`${command.join(" ")} rejects output conflicts before action`, async () => {
      const h = harness();
      await expect(h.parse([...command, "--details", "--json"])).rejects.toHaveProperty(
        "exitCode",
        1,
      );
      expect(h.calls).toEqual([]);
      expect(h.stdout.text).toBe("");
    });
    test(`${command.join(" ")} documents command-local output options`, () => {
      const result = runCli([...command, "--help"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("--details");
      expect(result.stdout).toContain("--json");
      expect(result.stdout).not.toContain("--codex-model");
      expect(result.stdout).not.toContain("--codex-timeout");
    });
  }
  for (const view of ["models", "providers"]) {
    for (const flag of ["--json", "--details"]) {
      test(`rejects parent ${flag} before ${view}`, async () => {
        const h = harness();
        await expect(h.parse(["codex-info", flag, view])).rejects.toHaveProperty("exitCode", 1);
        expect(h.calls).toEqual([]);
        expect(h.stderr.text).not.toBe("");
      });
    }
  }
  test.each([
    "--codex-model",
    "--codex-provider",
    "--codex-reasoning-effort",
    "--codex-home",
    "--profile",
  ])("rejects unsupported discovery option %s", async (flag) => {
    const h = harness();
    await expect(h.parse(["codex-info", "models", flag, "example"])).rejects.toHaveProperty(
      "exitCode",
      1,
    );
    expect(h.calls).toEqual([]);
  });
});
