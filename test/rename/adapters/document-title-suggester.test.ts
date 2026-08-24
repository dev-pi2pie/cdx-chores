import { describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  __testOnlySuggestDocumentRenameTitlesWithBatch,
  __testOnlySuggestDocumentRenameTitlesWithThread,
} from "../../../src/adapters/codex/document-rename-titles";
import { createTempFixtureDir } from "../../helpers/cli-test-utils";
import { withCapturedTimeoutSignals } from "./title-suggester-support";

describe("Codex rename adapter timeout summaries", () => {
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
