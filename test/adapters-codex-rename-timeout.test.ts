import { describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  __testOnlySuggestDocumentRenameTitlesWithBatch,
  __testOnlySuggestDocumentRenameTitlesWithThread,
} from "../src/adapters/codex/document-rename-titles";
import {
  __testOnlySuggestImageRenameTitlesWithBatch,
  __testOnlySuggestImageRenameTitlesWithThread,
} from "../src/adapters/codex/image-rename-titles";
import { createTempFixtureDir } from "./helpers/cli-test-utils";

describe("Codex rename adapter timeout summaries", () => {
  async function withCapturedTimeoutSignals<T>(
    run: (timeouts: number[], signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const originalTimeout = AbortSignal.timeout;
    const timeouts: number[] = [];
    const signal = new AbortController().signal;
    AbortSignal.timeout = ((delay: number) => {
      timeouts.push(delay);
      return signal;
    }) as typeof AbortSignal.timeout;

    try {
      return await run(timeouts, signal);
    } finally {
      AbortSignal.timeout = originalTimeout;
    }
  }

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

  test("image production batch builds the SDK request and parses its response", async () => {
    await withCapturedTimeoutSignals(async (timeouts, signal) => {
      const imagePath = "/fixtures/cover.png";
      let capturedWorkingDirectory = "";
      const result = await __testOnlySuggestImageRenameTitlesWithThread(
        {
          imagePaths: [imagePath],
          workingDirectory: "/fixtures",
          timeoutMs: 45_000,
        },
        async (workingDirectory) => {
          capturedWorkingDirectory = workingDirectory;
          return {
            run: async (input, options) => {
              expect(Array.isArray(input)).toBe(true);
              if (!Array.isArray(input)) {
                throw new Error("Expected structured image input");
              }
              expect(input[0]).toHaveProperty("type", "text");
              expect(input[1]).toEqual({ type: "local_image", path: imagePath });
              expect(options?.outputSchema).toBeDefined();
              expect(options?.signal).toBe(signal);
              return {
                items: [],
                finalResponse: JSON.stringify({
                  suggestions: [{ filename: "cover.png", title: "Cover: Photo!" }],
                }),
                usage: null,
              };
            },
          };
        },
      );

      expect(capturedWorkingDirectory).toBe("/fixtures");
      expect(timeouts).toEqual([45_000]);
      expect(result).toEqual({ suggestions: [{ path: imagePath, title: "Cover Photo" }] });
    });
  });

  test("image production retries create a fresh timeout signal for each attempt", async () => {
    const originalTimeout = AbortSignal.timeout;
    const timeoutDelays: number[] = [];
    const createdSignals: AbortSignal[] = [];
    const receivedSignals: AbortSignal[] = [];

    AbortSignal.timeout = ((delay: number) => {
      timeoutDelays.push(delay);
      const signal = new AbortController().signal;
      createdSignals.push(signal);
      return signal;
    }) as typeof AbortSignal.timeout;

    try {
      let attempt = 0;
      const result = await __testOnlySuggestImageRenameTitlesWithThread(
        {
          imagePaths: ["/fixtures/cover.png"],
          workingDirectory: "/fixtures",
          timeoutMs: 45_000,
          retries: 1,
        },
        async () => ({
          run: async (_input, options) => {
            attempt += 1;
            if (options?.signal) {
              receivedSignals.push(options.signal);
            }
            if (attempt === 1) {
              throw new DOMException("request deadline reached", "TimeoutError");
            }
            return {
              items: [],
              finalResponse: JSON.stringify({
                suggestions: [{ filename: "cover.png", title: "Cover Photo" }],
              }),
              usage: null,
            };
          },
        }),
      );

      expect(timeoutDelays).toEqual([45_000, 45_000]);
      expect(createdSignals).toHaveLength(2);
      expect(createdSignals[0]).not.toBe(createdSignals[1]);
      expect(receivedSignals).toEqual(createdSignals);
      expect(result).toEqual({
        suggestions: [{ path: "/fixtures/cover.png", title: "Cover Photo" }],
      });
    } finally {
      AbortSignal.timeout = originalTimeout;
    }
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

  test("document production batch builds the SDK request and classifies its timeout", async () => {
    const fixtureDir = await createTempFixtureDir("codex-timeout");
    try {
      const dirPath = join(fixtureDir, "document-thread");
      await mkdir(dirPath, { recursive: true });
      const docPath = join(dirPath, "notes.md");
      await writeFile(docPath, "# Project Notes\n\nCurrent decisions.\n", "utf8");

      await withCapturedTimeoutSignals(async (timeouts, signal) => {
        const result = await __testOnlySuggestDocumentRenameTitlesWithThread(
          {
            documentPaths: [docPath],
            workingDirectory: dirPath,
            timeoutMs: 60_000,
          },
          async (workingDirectory) => ({
            run: async (input, options) => {
              expect(workingDirectory).toBe(dirPath);
              expect(Array.isArray(input)).toBe(true);
              if (!Array.isArray(input) || input[0]?.type !== "text") {
                throw new Error("Expected structured document input");
              }
              expect(input[0].text).toContain("Project Notes");
              expect(options?.outputSchema).toBeDefined();
              expect(options?.signal).toBe(signal);
              const wrapped = new Error("SDK request failed") as Error & { cause?: unknown };
              wrapped.cause = new DOMException("request deadline reached", "TimeoutError");
              throw wrapped;
            },
          }),
        );

        expect(timeouts).toEqual([60_000]);
        expect(result.errorMessage).toBe(
          "Codex title generation failed. Codex document-title request timed out after the 1m per-attempt limit.",
        );
      });
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
