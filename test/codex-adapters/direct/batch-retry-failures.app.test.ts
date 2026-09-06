import { describe, expect, test } from "bun:test";

import {
  executeBatchesWithRetries,
  summarizeCodexBatchFailures,
} from "../../../src/adapters/codex/shared";

describe("Codex batch retries and failure summaries", () => {
  test("executeBatchesWithRetries retries thrown errors and succeeds", async () => {
    let calls = 0;
    const result = await executeBatchesWithRetries({
      batches: ["retry-once"],
      retries: 1,
      runBatch: async () => {
        calls += 1;
        if (calls === 1) {
          throw new Error("transient failure");
        }
        return { suggestions: [{ ok: true }] };
      },
    });

    expect(calls).toBe(2);
    expect(result.suggestions).toEqual([{ ok: true }]);
    expect(result.batchFailures).toEqual([]);
  });

  test("records attempt exhaustion after multiple timeout retries", async () => {
    let calls = 0;
    const result = await executeBatchesWithRetries({
      batches: ["timeout"],
      retries: 2,
      runBatch: async () => {
        calls += 1;
        throw new DOMException("request deadline reached", "TimeoutError");
      },
    });

    expect(calls).toBe(3);
    expect(result.batchFailures).toEqual([
      { kind: "timeout", message: "request deadline reached", attemptsUsed: 3 },
    ]);
    expect(
      summarizeCodexBatchFailures({
        batchFailures: result.batchFailures,
        hasSuggestions: false,
        requestLabel: "Codex document-title request",
        timeoutMs: 120_000,
      }),
    ).toBe(
      "Codex title generation failed. Codex document-title request timed out after the 2m per-attempt limit; 3 attempts were exhausted.",
    );
  });
});
