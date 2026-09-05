import { describe, expect, test } from "bun:test";

import {
  __testOnlySuggestImageRenameTitlesWithBatch,
  __testOnlySuggestImageRenameTitlesWithThread,
} from "../../../src/adapters/codex/image-rename-titles";
import type { CodexExecutionOptions } from "../../../src/utils/codex-execution";

const execution = { model: "Model-A", provider: "Provider-A", reasoningEffort: "high" } as const;

describe("Codex rename execution configuration", () => {
  test("image thread receives settings separately from unchanged image attachments", async () => {
    const policies: Array<CodexExecutionOptions | undefined> = [];
    const result = await __testOnlySuggestImageRenameTitlesWithThread(
      { imagePaths: ["/fixtures/a.png"], workingDirectory: "/fixtures", codexExecution: execution },
      async (cwd, options) => {
        expect(cwd).toBe("/fixtures");
        policies.push(options?.codexExecution);
        return {
          run: async (input) => {
            expect(input).toContainEqual({ type: "local_image", path: "/fixtures/a.png" });
            expect(JSON.stringify(input)).not.toContain("Provider-A");
            return {
              items: [],
              finalResponse: '{"suggestions":[{"filename":"a.png","title":"Landscape"}]}',
              usage: null,
            };
          },
        };
      },
    );
    expect(policies).toEqual([execution]);
    expect(result.suggestions).toHaveLength(1);
  });

  test("image omission requests low with no model or provider", async () => {
    await __testOnlySuggestImageRenameTitlesWithThread(
      { imagePaths: ["/fixtures/a.png"], workingDirectory: "/fixtures" },
      async (_cwd, options) => {
        expect(options?.codexExecution).toEqual({ reasoningEffort: "low" });
        return {
          run: async () => ({ items: [], finalResponse: '{"suggestions":[]}', usage: null }),
        };
      },
    );
  });

  test("invalid image settings reject before input access or runner startup", async () => {
    let accessed = false;
    let invoked = false;
    await expect(
      __testOnlySuggestImageRenameTitlesWithBatch(
        {
          get imagePaths(): string[] {
            accessed = true;
            throw new Error("Input accessed");
          },
          workingDirectory: "/fixtures",
          codexExecution: { reasoningEffort: "unsupported" } as unknown as CodexExecutionOptions,
        },
        async () => {
          invoked = true;
          return { suggestions: [] };
        },
      ),
    ).rejects.toThrow("reasoning effort");
    expect(accessed).toBe(false);
    expect(invoked).toBe(false);
  });
});
