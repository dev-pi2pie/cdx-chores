import { describe, expect, test } from "bun:test";
import { Command } from "commander";

import { actionDataQueryCodex } from "../../../src/cli/actions/data-query-codex";
import { registerDataQueryCommands } from "../../../src/cli/commands/data/query";
import { draftDataQueryWithCodex } from "../../../src/cli/data-query/runner";
import type { CodexExecutionOptions } from "../../../src/utils/codex-execution";
import { createCapturedRuntime } from "../../helpers/cli-test-utils";

const response = JSON.stringify({ sql: "select id from file", reasoning_summary: "Select IDs." });
const introspection = {
  columns: [{ name: "id", type: "BIGINT" }],
  sampleRows: [{ id: "1" }],
  truncated: false,
};

describe("data query execution policy", () => {
  for (const custom of [false, true]) {
    test(`command forwards ${custom ? "custom" : "default"} settings through action to runner`, async () => {
      const { runtime, stdout } = createCapturedRuntime();
      const program = new Command().exitOverride();
      let calls = 0;
      registerDataQueryCommands(program.command("data"), runtime, {
        actionDataQuery: async () => {
          throw new Error("Unexpected parent query action");
        },
        actionDataQueryCodex: (runtime, options) =>
          actionDataQueryCodex(runtime, {
            ...options,
            runner: async ({ codexExecution, timeoutMs, prompt }) => {
              calls++;
              expect(codexExecution).toEqual(
                custom
                  ? {
                      model: "example-model",
                      provider: "example-provider",
                      reasoningEffort: "high",
                    }
                  : { reasoningEffort: "low" },
              );
              expect(Object.isFrozen(codexExecution)).toBe(true);
              expect(timeoutMs).toBe(45_000);
              expect(prompt).toContain("User intent: list IDs");
              expect(prompt).not.toContain("example-provider");
              return response;
            },
          }),
      });
      await program.parseAsync([
        "node",
        "test",
        "data",
        "query",
        "codex",
        "test/data-sources/fixtures/basic.csv",
        "--intent",
        "list IDs",
        "--print-sql",
        "--codex-timeout",
        "45s",
        ...(custom
          ? [
              "--codex-model",
              " example-model ",
              "--codex-provider",
              " example-provider ",
              "--codex-reasoning-effort",
              "high",
            ]
          : []),
      ]);
      expect(calls).toBe(1);
      expect(stdout.text).toBe("select id from file\n");
    });
  }

  test("direct action rejects invalid settings before input access or runner invocation", async () => {
    const { runtime, stdout, stderr } = createCapturedRuntime();
    let calls = 0;
    await expect(
      actionDataQueryCodex(runtime, {
        input: "missing.csv",
        intent: "list rows",
        codexExecution: { model: " " },
        runner: async () => {
          calls++;
          return response;
        },
      }),
    ).rejects.toThrow("Codex model must be a non-empty string");
    expect(calls).toBe(0);
    expect(stdout.text + stderr.text).toBe("");
  });

  test("direct drafting validates before building a prompt or invoking its runner", async () => {
    let calls = 0;
    await expect(
      draftDataQueryWithCodex({
        format: "csv",
        intent: "list rows",
        introspection,
        workingDirectory: process.cwd(),
        codexExecution: { reasoningEffort: "invalid" } as unknown as CodexExecutionOptions,
        runner: async () => {
          calls++;
          return response;
        },
      }),
    ).rejects.toThrow("Codex reasoning effort must be one of");
    expect(calls).toBe(0);
  });

  test("provider rejection stays visible and does not retry with different settings", async () => {
    const { runtime } = createCapturedRuntime();
    let calls = 0;
    await expect(
      actionDataQueryCodex(runtime, {
        input: "test/data-sources/fixtures/basic.csv",
        intent: "list rows",
        codexExecution: { reasoningEffort: "high", provider: "example-provider" },
        runner: async ({ codexExecution }) => {
          calls++;
          expect(codexExecution).toEqual({ reasoningEffort: "high", provider: "example-provider" });
          throw new Error("invalid_request_error: reasoning effort high is unsupported");
        },
      }),
    ).rejects.toThrow("reasoning effort high is unsupported");
    expect(calls).toBe(1);
  });
});
