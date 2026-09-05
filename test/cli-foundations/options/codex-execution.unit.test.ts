import { describe, expect, test } from "bun:test";

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
