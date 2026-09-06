import { describe, expect, test } from "bun:test";

import { actionDataStack } from "../../../src/cli/actions/data-stack/run";

import {
  classifyDataStackCodexAssistFailure,
  formatDataStackCodexAssistFailure,
  suggestDataStackWithCodex,
  type SuggestDataStackWithCodexOptions,
} from "../../../src/cli/data-stack/codex-assist";
import { createCapturedRuntime } from "../../helpers/cli-test-utils";

describe("data stack execution policy", () => {
  test("invalid direct settings fail before preparation with assist disabled", async () => {
    const { runtime, stdout, stderr } = createCapturedRuntime();
    await expect(
      actionDataStack(runtime, {
        sources: ["missing.csv"],
        output: "merged.csv",
        codexExecution: { provider: " " },
      }),
    ).rejects.toThrow("Codex provider must be a non-empty string");
    expect(stdout.text + stderr.text).toBe("");
  });

  test("direct suggestions validate before reading plan data or invoking a runner", async () => {
    let calls = 0;
    await expect(
      suggestDataStackWithCodex({
        codexExecution: { model: " " },
        runner: async () => {
          calls++;
          return "";
        },
      } as unknown as SuggestDataStackWithCodexOptions),
    ).rejects.toThrow("Codex model must be a non-empty string");
    expect(calls).toBe(0);
  });

  for (const message of [
    '{"error":{"type":"invalid_request_error","message":"Unknown model"}}',
    "invalid_request_error: provider is unknown",
    "invalid_request_error: reasoning effort high is unsupported",
  ]) {
    test(`configuration failure is not classified as a schema failure: ${message}`, () => {
      expect(classifyDataStackCodexAssistFailure(new Error(message))).toBe("unavailable");
      expect(formatDataStackCodexAssistFailure(new Error(message))).not.toContain("schema");
    });
  }

  for (const message of [
    '{"error":{"type":"invalid_request_error","code":"invalid_json_schema"}}',
    "Invalid schema for response_format",
    "Rejected structured recommendation schema",
  ]) {
    test(`explicit schema failure retains its classification: ${message}`, () => {
      expect(classifyDataStackCodexAssistFailure(new Error(message))).toBe(
        "structured-output-schema",
      );
      expect(formatDataStackCodexAssistFailure(new Error(message))).toContain(
        "structured recommendation schema",
      );
    });
  }
});
