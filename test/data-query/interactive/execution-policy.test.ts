import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "../../cli-foundations/interactive-harness";
import type { CodexExecutionOptions } from "../../../src/utils/codex-execution";

describe("interactive data execution policy", () => {
  test("new query sessions do not retain another session's overrides", () => {
    const run = (codexExecution?: CodexExecutionOptions) =>
      runInteractiveHarness({
        mode: "run",
        codexExecution,
        captureCodexExecution: true,
        selectQueue: ["data", "data:query", "Codex Assistant", "json"],
        requiredPathQueue: ["fixtures/query.csv"],
        confirmQueue: [true, false, false, true, false],
        inputQueue: ["count rows"],
        dataQueryDetectedFormat: "csv",
        dataQueryCodexDraft: { sql: "select count(*) from file", reasoningSummary: "Count rows." },
      });
    const custom = { model: "model-a", provider: "provider-a", reasoningEffort: "high" as const };
    const first = run(custom);
    const second = run();
    expect(
      first.actionCalls.find((call) => call.name === "data:query:codex-draft")?.options
        .codexExecution,
    ).toEqual(custom);
    expect(
      second.actionCalls.find((call) => call.name === "data:query:codex-draft")?.options
        .codexExecution,
    ).toEqual({ reasoningEffort: "low" });
    for (const result of [first, second]) {
      expect(
        result.promptCalls.some((call) => /model|provider|reasoning effort/i.test(call.message)),
      ).toBe(false);
      expect(
        result.actionCalls.find((call) => call.name === "data:query")?.options,
      ).not.toHaveProperty("codexExecution");
    }
  });

  test("extract header review receives the session policy without persisting it in extraction options", () => {
    const codexExecution = {
      model: "model-a",
      provider: "provider-a",
      reasoningEffort: "medium" as const,
    };
    const result = runInteractiveHarness({
      mode: "run",
      codexExecution,
      selectQueue: ["data", "data:extract", "accept", "json"],
      requiredPathQueue: ["fixtures/query.csv"],
      optionalPathQueue: [undefined],
      confirmQueue: [true, true, true, true, true],
      dataQueryDetectedFormat: "csv",
      dataQueryHeaderSuggestions: [
        { from: "column_1", to: "id", sample: "1", inferredType: "BIGINT" },
      ],
      dataQueryIntrospectionQueue: [
        {
          columns: [{ name: "column_1", type: "BIGINT" }],
          sampleRows: [{ column_1: "1" }],
          truncated: false,
        },
        { columns: [{ name: "id", type: "BIGINT" }], sampleRows: [{ id: "1" }], truncated: false },
      ],
    });
    expect(
      result.actionCalls.find((call) => call.name === "data:query:header-suggest")?.options
        .codexExecution,
    ).toEqual(codexExecution);
    const extraction = result.actionCalls.find((call) => call.name === "data:extract");
    expect(extraction).toBeDefined();
    expect(extraction?.options).not.toHaveProperty("codexExecution");
  });
});
