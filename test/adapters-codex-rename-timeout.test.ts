import { describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { __testOnlySuggestDocumentRenameTitlesWithBatch } from "../src/adapters/codex/document-rename-titles";
import { __testOnlySuggestImageRenameTitlesWithBatch } from "../src/adapters/codex/image-rename-titles";
import { createTempFixtureDir } from "./helpers/cli-test-utils";

describe("Codex rename adapter timeout summaries", () => {
  test("image batches retain partial suggestions and reuse one timeout through retries", async () => {
    const imageA = "/fixtures/a.png";
    const imageB = "/fixtures/b.png";
    const calls: Array<{ imagePaths: string[]; timeoutMs?: number }> = [];

    const result = await __testOnlySuggestImageRenameTitlesWithBatch(
      {
        imagePaths: [imageA, imageB],
        workingDirectory: "/fixtures",
        timeoutMs: 120_000,
        retries: 1,
        batchSize: 1,
      },
      async (options) => {
        calls.push({ imagePaths: options.imagePaths, timeoutMs: options.timeoutMs });
        if (options.imagePaths[0] === imageA) {
          return { suggestions: [{ path: imageA, title: "cover photo" }] };
        }
        throw new DOMException("request deadline reached", "TimeoutError");
      },
    );

    expect(calls).toEqual([
      { imagePaths: [imageA], timeoutMs: 120_000 },
      { imagePaths: [imageB], timeoutMs: 120_000 },
      { imagePaths: [imageB], timeoutMs: 120_000 },
    ]);
    expect(result.suggestions).toEqual([{ path: imageA, title: "cover photo" }]);
    expect(result.errorMessage).toBe(
      "Partial Codex suggestions. Codex image-title request timed out after the 2m per-attempt limit; 2 attempts were exhausted.",
    );
  });

  test("image adapter preserves the generic summary for unknown failures", async () => {
    const result = await __testOnlySuggestImageRenameTitlesWithBatch(
      {
        imagePaths: ["/fixtures/a.png"],
        workingDirectory: "/fixtures",
      },
      async () => ({ suggestions: [], errorMessage: "SDK unavailable" }),
    );

    expect(result).toEqual({
      suggestions: [],
      errorMessage: "Codex title generation failed. SDK unavailable",
    });
  });

  test("document adapter uses the shared default and recognizes a wrapped timeout", async () => {
    const fixtureDir = await createTempFixtureDir("codex-timeout");
    try {
      const dirPath = join(fixtureDir, "document-adapter");
      await mkdir(dirPath, { recursive: true });
      const docPath = join(dirPath, "notes.md");
      await writeFile(docPath, "# Project Notes\n\nCurrent decisions.\n", "utf8");

      const timeouts: Array<number | undefined> = [];
      const result = await __testOnlySuggestDocumentRenameTitlesWithBatch(
        {
          documentPaths: [docPath],
          workingDirectory: dirPath,
        },
        async (options) => {
          timeouts.push(options.timeoutMs);
          const wrapped = new Error("SDK request failed") as Error & { cause?: unknown };
          wrapped.cause = new DOMException("request deadline reached", "TimeoutError");
          throw wrapped;
        },
      );

      expect(timeouts).toEqual([30_000]);
      expect(result.suggestions).toEqual([]);
      expect(result.errorMessage).toBe(
        "Codex title generation failed. Codex document-title request timed out after the 30s per-attempt limit.",
      );
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
