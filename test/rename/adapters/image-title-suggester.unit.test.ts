import { describe, expect, test } from "bun:test";

import {
  __testOnlySuggestImageRenameTitlesWithBatch,
  __testOnlySuggestImageRenameTitlesWithThread,
} from "../../../src/adapters/codex/image-rename-titles";
import { withCapturedTimeoutSignals } from "./title-suggester-support";

describe("Codex rename adapter timeout summaries", () => {
  test("wraps returned image adapter errors in the generic title-generation summary", async () => {
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
});
