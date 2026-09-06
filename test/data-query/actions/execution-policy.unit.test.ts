import { describe, expect, test } from "bun:test";

import { actionDataQueryCodex } from "../../../src/cli/actions/data-query-codex";

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
});
