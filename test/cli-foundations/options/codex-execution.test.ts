import { describe, expect, test } from "bun:test";
import { Command, InvalidArgumentError } from "commander";

import {
  applyCodexExecutionOptions,
  resolveCodexExecutionCommandOptions,
} from "../../../src/cli/options/codex-execution-option";
import {
  resolveCodexExecution,
  type CodexExecutionOptions,
} from "../../../src/utils/codex-execution";

const efforts = [
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "ultra",
  "persistent",
] as const;

function command(): Command {
  return applyCodexExecutionOptions(new Command("test"))
    .exitOverride()
    .configureOutput({ writeErr: () => {} });
}

describe("Codex execution resolution", () => {
  test("defaults to low and omits model and provider keys", () => {
    const resolved = resolveCodexExecution();
    expect(resolved).toEqual({ reasoningEffort: "low" });
    expect(Object.keys(resolved)).toEqual(["reasoningEffort"]);
    expect(Object.isFrozen(resolved)).toBe(true);
  });

  test("trims identifiers without changing case and preserves resolved values", () => {
    const resolved = resolveCodexExecution({
      model: " Model-A ",
      provider: " Provider-A ",
      reasoningEffort: "high",
    });
    expect(resolved).toEqual({ model: "Model-A", provider: "Provider-A", reasoningEffort: "high" });
    expect(resolveCodexExecution(resolved)).toEqual(resolved);
  });

  test.each([...efforts])("accepts exact effort %s", (reasoningEffort) => {
    expect(resolveCodexExecution({ reasoningEffort })).toEqual({ reasoningEffort });
  });

  test.each([null, false, "low", 1, [], new Date()].map((value) => [value]))(
    "rejects malformed options %j",
    (options) => {
      expect(() => resolveCodexExecution(options as CodexExecutionOptions)).toThrow(TypeError);
    },
  );

  for (const field of ["model", "provider"] as const) {
    test.each([null, "", " \t ", false, 12, [], {}].map((value) => [value]))(
      `rejects malformed ${field} %j`,
      (value) => {
        expect(() => resolveCodexExecution({ [field]: value } as CodexExecutionOptions)).toThrow(
          TypeError,
        );
      },
    );
  }

  test.each([null, "", " low", "low ", "LOW", "none", "inherit", "bogus", false, 1, {}])(
    "rejects invalid effort %j",
    (reasoningEffort) => {
      expect(() => resolveCodexExecution({ reasoningEffort } as CodexExecutionOptions)).toThrow(
        TypeError,
      );
    },
  );

  test("copies inputs and isolates independent invocations", () => {
    const input: CodexExecutionOptions = { model: "custom", reasoningEffort: "max" };
    const first = resolveCodexExecution(input);
    input.model = "changed";
    expect(first).toEqual({ model: "custom", reasoningEffort: "max" });
    expect(resolveCodexExecution()).toEqual({ reasoningEffort: "low" });
    expect(resolveCodexExecution({ provider: "custom-provider" })).toEqual({
      provider: "custom-provider",
      reasoningEffort: "low",
    });
  });
});

describe("Codex execution command options", () => {
  test("resolves omission without Commander defaults leaking into option parsing", () => {
    const parsed = command().parse([], { from: "user" }).opts();
    expect(parsed).toEqual({});
    expect(resolveCodexExecutionCommandOptions(parsed)).toEqual({ reasoningEffort: "low" });
  });

  test("parses combined options and normalizes identifiers", () => {
    const parsed = command()
      .parse(
        [
          "--codex-model",
          " Model-A ",
          "--codex-provider",
          " Provider-A ",
          "--codex-reasoning-effort",
          "high",
        ],
        { from: "user" },
      )
      .opts();
    expect(resolveCodexExecutionCommandOptions(parsed)).toEqual({
      model: "Model-A",
      provider: "Provider-A",
      reasoningEffort: "high",
    });
  });

  test.each([...efforts])("parses effort %s", (effort) => {
    expect(
      resolveCodexExecutionCommandOptions(
        command().parse(["--codex-reasoning-effort", effort], { from: "user" }).opts(),
      ),
    ).toEqual({ reasoningEffort: effort });
  });

  for (const [flag, first, other] of [
    ["--codex-model", "model", "another"],
    ["--codex-provider", "provider", "another"],
    ["--codex-reasoning-effort", "low", "high"],
  ] as const) {
    test.each([first, other])(`rejects duplicate ${flag} with second value %s`, (second) => {
      expect(() => command().parse([flag, first, flag, second], { from: "user" })).toThrow(
        `${flag} may only be specified once.`,
      );
    });
  }

  test.each(["", " low", "low ", "LOW", "inherit", "none", "unknown"])(
    "rejects effort %j before action work",
    (effort) => {
      let called = false;
      const parser = command().action(() => {
        called = true;
      });
      expect(() => parser.parse(["--codex-reasoning-effort", effort], { from: "user" })).toThrow();
      expect(called).toBe(false);
    },
  );

  test.each(["--codex-model", "--codex-provider"])(
    "rejects empty %s before action work",
    (flag) => {
      let called = false;
      const parser = command().action(() => {
        called = true;
      });
      expect(() => parser.parse([flag, "  "], { from: "user" })).toThrow();
      expect(called).toBe(false);
    },
  );

  test("validates programmatic command options through the shared policy", () => {
    expect(() => resolveCodexExecutionCommandOptions({ codexModel: " " })).toThrow(
      InvalidArgumentError,
    );
  });

  test("registers options only on the selected node", () => {
    const root = new Command("test").exitOverride().configureOutput({ writeErr: () => {} });
    const child = applyCodexExecutionOptions(root.command("child"));
    expect(root.helpInformation()).not.toContain("--codex-model");
    expect(child.helpInformation()).toContain("--codex-model");
    expect(() => root.parse(["--codex-model", "model"], { from: "user" })).toThrow(
      "unknown option",
    );
  });
});
