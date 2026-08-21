import { describe, expect, test } from "bun:test";
import { readdir, writeFile } from "node:fs/promises";

import {
  chunkItems,
  executeBatchesWithRetries,
  normalizeTitle,
  parseFilenameTitleSuggestions,
  runCodexPromptOnly,
  summarizeBatchErrors,
  summarizeCodexBatchFailures,
} from "../src/adapters/codex/shared";

describe("codex shared adapter helpers", () => {
  test("normalizeTitle strips punctuation and collapses whitespace", () => {
    expect(normalizeTitle('  "Quarterly: Revenue & Growth!"  ')).toBe("Quarterly Revenue Growth");
  });

  test("chunkItems groups arrays by chunk size", () => {
    expect(chunkItems([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
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
    expect(result.batchFailures).toEqual([
      { kind: "other", message: "partial error", attemptsUsed: 1 },
    ]);
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
    expect(result.batchFailures).toEqual([]);
  });

  test("retains partial results with timeout-specific exhausted batch metadata", async () => {
    const result = await executeBatchesWithRetries({
      batches: ["success", "timeout"],
      retries: 0,
      runBatch: async (batch) => {
        if (batch === "success") {
          return { suggestions: [{ batch, title: "kept" }] };
        }
        throw new DOMException("request deadline reached", "TimeoutError");
      },
    });

    expect(result.suggestions).toEqual([{ batch: "success", title: "kept" }]);
    expect(result.batchErrors).toEqual(["request deadline reached"]);
    expect(result.batchFailures).toEqual([
      { kind: "timeout", message: "request deadline reached", attemptsUsed: 1 },
    ]);
    expect(
      summarizeCodexBatchFailures({
        batchErrors: result.batchErrors,
        batchFailures: result.batchFailures,
        hasSuggestions: true,
        requestLabel: "Codex image-title request",
        timeoutMs: 30_000,
      }),
    ).toBe(
      "Partial Codex suggestions. Codex image-title request timed out after the 30s per-attempt limit.",
    );
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
        batchErrors: result.batchErrors,
        batchFailures: result.batchFailures,
        hasSuggestions: false,
        requestLabel: "Codex document-title request",
        timeoutMs: 120_000,
      }),
    ).toBe(
      "Codex title generation failed. Codex document-title request timed out after the 2m per-attempt limit; 3 attempts were exhausted.",
    );
  });

  test("keeps ordinary abort failures on the generic summary path", async () => {
    const result = await executeBatchesWithRetries({
      batches: ["abort"],
      retries: 0,
      runBatch: async () => {
        throw new DOMException("request cancelled", "AbortError");
      },
    });

    expect(result.batchFailures).toEqual([
      { kind: "aborted", message: "request cancelled", attemptsUsed: 1 },
    ]);
    expect(
      summarizeCodexBatchFailures({
        batchErrors: result.batchErrors,
        batchFailures: result.batchFailures,
        hasSuggestions: false,
        requestLabel: "Codex image-title request",
        timeoutMs: 30_000,
      }),
    ).toBe("Codex title generation failed. request cancelled");
  });

  test("keeps an exhausted unknown failure on the unchanged generic summary path", async () => {
    const result = await executeBatchesWithRetries({
      batches: ["unknown"],
      retries: 0,
      runBatch: async () => {
        throw new Error("SDK unavailable");
      },
    });

    expect(result.batchFailures).toEqual([
      { kind: "other", message: "SDK unavailable", attemptsUsed: 1 },
    ]);
    expect(
      summarizeCodexBatchFailures({
        batchErrors: result.batchErrors,
        batchFailures: result.batchFailures,
        hasSuggestions: false,
        requestLabel: "Codex image-title request",
        timeoutMs: 30_000,
      }),
    ).toBe("Codex title generation failed. SDK unavailable");
  });

  test("reports additional non-timeout batches without overclassifying them", async () => {
    const result = await executeBatchesWithRetries({
      batches: ["timeout", "unknown"],
      retries: 0,
      runBatch: async (batch) => {
        if (batch === "timeout") {
          throw new DOMException("request deadline reached", "TimeoutError");
        }
        throw new Error("SDK unavailable");
      },
    });

    expect(result.batchFailures.map((failure) => failure.kind)).toEqual(["timeout", "other"]);
    expect(
      summarizeCodexBatchFailures({
        batchErrors: result.batchErrors,
        batchFailures: result.batchFailures,
        hasSuggestions: false,
        requestLabel: "Codex image-title request",
        timeoutMs: 30_000,
      }),
    ).toBe(
      "Codex title generation failed. Codex image-title request timed out after the 30s per-attempt limit. 1 additional non-timeout batch failure(s) occurred.",
    );
  });

  test("runCodexPromptOnly runs work in an empty disposable directory", async () => {
    let workingDirectory = "";
    const result = await runCodexPromptOnly({
      outputSchema: { type: "object" },
      prompt: "facts only",
      timeoutMs: 1_000,
      work: async (input) => {
        workingDirectory = input.workingDirectory;
        expect(await readdir(input.workingDirectory)).toEqual([]);
        expect(input.prompt).toBe("facts only");
        expect(input.outputSchema).toEqual({ type: "object" });
        await writeFile(`${input.workingDirectory}/scratch.txt`, "temporary", "utf8");
        return "ok";
      },
    });

    expect(result).toBe("ok");
    await expect(readdir(workingDirectory)).rejects.toThrow();
  });

  test("runCodexPromptOnly removes the disposable directory when work throws", async () => {
    let workingDirectory = "";

    await expect(
      runCodexPromptOnly({
        outputSchema: { type: "object" },
        prompt: "facts only",
        timeoutMs: 1_000,
        work: async (input) => {
          workingDirectory = input.workingDirectory;
          await writeFile(`${input.workingDirectory}/scratch.txt`, "temporary", "utf8");
          throw new Error("prompt failed");
        },
      }),
    ).rejects.toThrow("prompt failed");

    await expect(readdir(workingDirectory)).rejects.toThrow();
  });

  test("runCodexPromptOnly removes the disposable directory when the signal aborts", async () => {
    let workingDirectory = "";

    await expect(
      runCodexPromptOnly({
        outputSchema: { type: "object" },
        prompt: "facts only",
        timeoutMs: 1,
        work: async (input) => {
          workingDirectory = input.workingDirectory;
          await writeFile(`${input.workingDirectory}/scratch.txt`, "temporary", "utf8");
          return await new Promise((_resolve, reject) => {
            input.signal.addEventListener("abort", () => {
              reject(new Error("prompt aborted"));
            });
          });
        },
      }),
    ).rejects.toThrow("prompt aborted");

    await expect(readdir(workingDirectory)).rejects.toThrow();
  });
});
