import { afterEach, describe, expect, mock, test } from "bun:test";

import {
  MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA,
  MARKDOWN_PDF_CODEX_PROFILE_TIMEOUT_MS,
  suggestMarkdownPdfProfileWithCodex,
} from "../../src/adapters/codex/markdown-pdf-profile";
import { requestBase } from "./fixtures";

afterEach(() => {
  mock.restore();
});

describe("Markdown PDF Codex profile adapter", () => {
  test("starts the default Codex runner in the request working directory", async () => {
    let capturedThreadOptions: unknown;
    let capturedRunMessages: unknown;
    let capturedRunOptions: unknown;
    const originalTimeoutDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, "timeout");
    const timeoutCalls: number[] = [];
    if (!originalTimeoutDescriptor || typeof originalTimeoutDescriptor.value !== "function") {
      throw new Error("AbortSignal.timeout is not available");
    }
    const originalTimeout = originalTimeoutDescriptor.value as typeof AbortSignal.timeout;
    Object.defineProperty(AbortSignal, "timeout", {
      ...originalTimeoutDescriptor,
      value: (milliseconds: number) => {
        timeoutCalls.push(milliseconds);
        return originalTimeout.call(AbortSignal, milliseconds);
      },
    });

    mock.module("@openai/codex-sdk", () => ({
      Codex: class {
        startThread(options: unknown) {
          capturedThreadOptions = options;
          return {
            run: async (messages: unknown, options: unknown) => {
              capturedRunMessages = messages;
              capturedRunOptions = options;
              return {
                finalResponse: JSON.stringify({
                  decision_mode: "adapted",
                  selected_candidate_id: "wide-table",
                  accepted_patches: [],
                  accepted_font_patches: [],
                  reasoning: "Wide table candidate matches the table facts.",
                  warnings: [],
                  fallback_reason: "",
                  unmatched_directions: [],
                }),
              };
            },
          };
        }
      },
    }));

    let result: Awaited<ReturnType<typeof suggestMarkdownPdfProfileWithCodex>>;
    try {
      result = await suggestMarkdownPdfProfileWithCodex(requestBase);
    } finally {
      Object.defineProperty(AbortSignal, "timeout", originalTimeoutDescriptor);
    }

    const threadOptions = capturedThreadOptions as {
      approvalPolicy: string;
      modelReasoningEffort: string;
      networkAccessEnabled: boolean;
      sandboxMode: string;
      webSearchMode: string;
      workingDirectory: string;
    };
    const runMessages = capturedRunMessages as Array<{ text: string; type: string }>;
    const runOptions = capturedRunOptions as { outputSchema: unknown; signal: AbortSignal };
    expect(result.decision.decisionMode).toBe("adapted");
    expect(threadOptions).toMatchObject({
      approvalPolicy: "never",
      modelReasoningEffort: "low",
      networkAccessEnabled: true,
      sandboxMode: "read-only",
      webSearchMode: "disabled",
    });
    expect(threadOptions.workingDirectory).toBe("/repo");
    expect(runMessages).toEqual([
      expect.objectContaining({
        text: expect.stringContaining("Deterministic facts:"),
        type: "text",
      }),
    ]);
    expect(runOptions.outputSchema).toBe(MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA);
    expect(runOptions.signal).toBeInstanceOf(AbortSignal);
    expect(timeoutCalls).toEqual([MARKDOWN_PDF_CODEX_PROFILE_TIMEOUT_MS]);
  });

  test("passes the request working directory to explicit profile runners", async () => {
    let capturedWorkingDirectory = "";

    await suggestMarkdownPdfProfileWithCodex({
      ...requestBase,
      runner: async (options) => {
        capturedWorkingDirectory = options.workingDirectory;
        return JSON.stringify({
          decision_mode: "adapted",
          selected_candidate_id: "wide-table",
          accepted_patches: [],
          accepted_font_patches: [],
          reasoning: "Wide table candidate matches the table facts.",
          warnings: [],
          fallback_reason: "",
          unmatched_directions: [],
        });
      },
    });

    expect(capturedWorkingDirectory).toBe("/repo");
  });
});
