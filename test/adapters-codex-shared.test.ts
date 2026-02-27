import { describe, expect, test } from "bun:test";

import {
  chunkItems,
  executeBatchesWithRetries,
  normalizeTitle,
  parseFilenameTitleSuggestions,
  summarizeBatchErrors,
} from "../src/adapters/codex/shared";

describe("codex shared adapter helpers", () => {
  test("normalizeTitle strips punctuation and collapses whitespace", () => {
    expect(normalizeTitle('  "Quarterly: Revenue & Growth!"  ')).toBe("Quarterly Revenue Growth");
  });

  test("chunkItems groups arrays by chunk size", () => {
    expect(chunkItems([1, 2, 3, 4, 5], 2)).toEqual([
      [1, 2],
      [3, 4],
      [5],
    ]);
    expect(chunkItems([1, 2, 3], 0)).toEqual([[1, 2, 3]]);
  });

  test("parseFilenameTitleSuggestions normalizes titles and keeps latest duplicate filename", () => {
    const response = JSON.stringify({
      suggestions: [
        { filename: " report.pdf ", title: ' "Q4: Results!" ' },
        { filename: "image.png", title: "  " },
        { filename: "report.pdf", title: "Q4 Summary" },
        { filename: "", title: "ignored" },
      ],
    });

    const map = parseFilenameTitleSuggestions(response);
    expect([...map.entries()]).toEqual([["report.pdf", "Q4 Summary"]]);
  });

  test("summarizeBatchErrors returns consistent summary text", () => {
    expect(summarizeBatchErrors([], false)).toBeUndefined();
    expect(summarizeBatchErrors(["timeout"], false)).toBe("Codex title generation failed. timeout");
    expect(summarizeBatchErrors(["timeout", "timeout", "rate limit"], true)).toBe(
      "Partial Codex suggestions. timeout (+1 more error variant(s))",
    );
  });

  test("executeBatchesWithRetries aggregates suggestions and per-batch errors", async () => {
    let calls = 0;
    const result = await executeBatchesWithRetries({
      batches: ["a", "b"],
      retries: 0,
      runBatch: async (batch) => {
        calls += 1;
        if (batch === "a") {
          return {
            suggestions: [{ batch, title: "alpha" }],
            errorMessage: "partial error",
          };
        }
        return { suggestions: [{ batch, title: "beta" }] };
      },
    });

    expect(calls).toBe(2);
    expect(result.suggestions).toEqual([
      { batch: "a", title: "alpha" },
      { batch: "b", title: "beta" },
    ]);
    expect(result.batchErrors).toEqual(["partial error"]);
  });

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
    expect(result.batchErrors).toEqual([]);
  });
});
