import { afterEach, describe, expect, mock, test } from "bun:test";

import {
  MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA,
  MARKDOWN_PDF_PROJECT_PROFILE_OUTPUT_SCHEMA,
  MARKDOWN_PDF_CODEX_PROFILE_TIMEOUT_MS,
  suggestMarkdownPdfProfileWithCodex,
} from "../../../../src/adapters/codex/markdown-pdf-profile";
import { requestBase } from "./fixtures";

afterEach(() => {
  mock.restore();
});

describe("Markdown PDF Codex profile adapter", () => {
  test.each([false, true])("starts the default runner with Project schema=%s", async (project) => {
    const requestEvents: string[] = [];
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
          requestEvents.push("start-thread");
          capturedThreadOptions = options;
          return {
            run: async (messages: unknown, options: unknown) => {
              requestEvents.push("run");
              capturedRunMessages = messages;
              capturedRunOptions = options;
              return {
                finalResponse: JSON.stringify({
                  ...(project ? { project_cover_intent: "unspecified" } : {}),
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
      result = await suggestMarkdownPdfProfileWithCodex({
        ...requestBase,
        ...(project ? { projectCoverImageAvailable: false } : {}),
        onModelRequestAttempt: () => requestEvents.push("attempt"),
      });
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
    expect(runOptions.outputSchema).toBe(
      project
        ? MARKDOWN_PDF_PROJECT_PROFILE_OUTPUT_SCHEMA
        : MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA,
    );
    expect(runOptions.signal).toBeInstanceOf(AbortSignal);
    expect(timeoutCalls).toEqual([MARKDOWN_PDF_CODEX_PROFILE_TIMEOUT_MS]);
    expect(requestEvents).toEqual(["start-thread", "attempt", "run"]);
  });

  test("passes the request working directory to explicit profile runners", async () => {
    let capturedWorkingDirectory = "";
    const requestEvents: string[] = [];

    await suggestMarkdownPdfProfileWithCodex({
      ...requestBase,
      onModelRequestAttempt: () => requestEvents.push("attempt"),
      runner: async (options) => {
        requestEvents.push("run");
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
    expect(requestEvents).toEqual(["attempt", "run"]);
  });

  test("does not mark a request when the default thread cannot start", async () => {
    let attempts = 0;
    mock.module("@openai/codex-sdk", () => ({
      Codex: class {
        startThread(): never {
          throw new Error("thread setup failed");
        }
      },
    }));

    await expect(
      suggestMarkdownPdfProfileWithCodex({
        ...requestBase,
        onModelRequestAttempt: () => {
          attempts += 1;
        },
      }),
    ).rejects.toThrow("thread setup failed");
    expect(attempts).toBe(0);
  });

  test("marks a failed injected runner invocation", async () => {
    let attempts = 0;
    await expect(
      suggestMarkdownPdfProfileWithCodex({
        ...requestBase,
        onModelRequestAttempt: () => {
          attempts += 1;
        },
        runner: async () => {
          throw new Error("request failed");
        },
      }),
    ).rejects.toThrow("request failed");
    expect(attempts).toBe(1);
  });
});
