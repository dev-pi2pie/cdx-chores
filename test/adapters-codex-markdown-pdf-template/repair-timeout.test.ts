import { afterEach, describe, expect, mock, test } from "bun:test";

import {
  MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA,
  MARKDOWN_PDF_TEMPLATE_CODEX_TIMEOUT_MS,
  suggestMarkdownPdfTemplateWithCodex,
} from "../../src/adapters/codex/markdown-pdf-template";

import {
  requestBase,
  responseFromDecision,
} from "../markdown-pdf/adapters/template-codex-fixtures";

describe("Markdown PDF template Codex adapter: repair timeout", () => {
  afterEach(() => {
    mock.restore();
  });

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
                finalResponse: responseFromDecision({
                  coverEnabled: false,
                  templateFamily: "document-layered",
                }),
              };
            },
          };
        }
      },
    }));

    let result: Awaited<ReturnType<typeof suggestMarkdownPdfTemplateWithCodex>>;
    try {
      result = await suggestMarkdownPdfTemplateWithCodex(requestBase());
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
    expect(runOptions.outputSchema).toBe(MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA);
    expect(runOptions.signal).toBeInstanceOf(AbortSignal);
    expect(timeoutCalls).toEqual([MARKDOWN_PDF_TEMPLATE_CODEX_TIMEOUT_MS]);
  });

  test("repairs schema-valid responses that fail local application once", async () => {
    const prompts: string[] = [];
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase(),
      runner: async ({ prompt }) => {
        prompts.push(prompt);
        return prompts.length === 1
          ? responseFromDecision({
              coverEnabled: false,
              managedAssets: [
                {
                  bundle_path: "/workspace/client/private-cover.png",
                  source_label: "cover.png",
                },
              ],
              templateFamily: "document-layered",
            })
          : responseFromDecision({
              coverEnabled: false,
              fontDecisions: [
                {
                  family: "Source Serif 4",
                  key: "default",
                  role: "body",
                  source: "font-hint",
                  template_level: false,
                },
              ],
              templateFamily: "document-layered",
            });
      },
    });

    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("Correction request:");
    expect(prompts[1]).toContain("not in the output plan");
    expect(prompts[1]).toContain("[local-path]");
    expect(prompts[1]).not.toContain("/workspace/client");
    expect(prompts[1]).not.toContain("private-cover.png");
    expect(result.decision.decisionMode).toBe("adapted");
    expect(result.decision.fontDecisions).toEqual([
      expect.objectContaining({
        family: "Source Serif 4",
        key: "default",
        role: "body",
      }),
    ]);
  });

  test("stops after one application repair attempt", async () => {
    let callCount = 0;
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase(),
      runner: async () => {
        callCount += 1;
        return responseFromDecision({
          coverEnabled: false,
          managedAssets: [
            {
              bundle_path: "/workspace/client/private-cover.png",
              source_label: "cover.png",
            },
          ],
          templateFamily: "document-layered",
        });
      },
    });

    expect(callCount).toBe(2);
    expect(result.decision.decisionMode).toBe("no-usable-template");
    expect(result.decision.fallbackReason).toBe(
      "Codex template decision failed: invalid-application.",
    );
  });

  test("reuses one configured timeout for the initial and application-repair requests", async () => {
    const timeoutCalls: Array<number | undefined> = [];
    let callCount = 0;
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase(),
      timeoutMs: 120_000,
      runner: async ({ timeoutMs }) => {
        timeoutCalls.push(timeoutMs);
        callCount += 1;
        return callCount === 1
          ? responseFromDecision({
              coverEnabled: false,
              managedAssets: [
                {
                  bundle_path: "/workspace/client/private-cover.png",
                  source_label: "cover.png",
                },
              ],
              templateFamily: "document-layered",
            })
          : responseFromDecision({
              coverEnabled: false,
              templateFamily: "document-layered",
            });
      },
    });

    expect(result.decision.decisionMode).toBe("adapted");
    expect(timeoutCalls).toEqual([120_000, 120_000]);
  });

  test("formats only structurally preserved template timeouts as timeout failures", async () => {
    const timeoutError = new Error("private transport details");
    timeoutError.name = "TimeoutError";
    const timeoutResult = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase(),
      timeoutMs: 120_000,
      runner: async () => {
        throw timeoutError;
      },
    });
    const genericResult = await suggestMarkdownPdfTemplateWithCodex({
      ...requestBase(),
      timeoutMs: 120_000,
      runner: async () => {
        throw new Error("request timed out after two minutes");
      },
    });

    expect(timeoutResult.decision.fallbackReason).toBe(
      "Codex Markdown PDF template request timed out after the 2m per-attempt limit.",
    );
    expect(timeoutResult.decision.fallbackReason).not.toContain("private transport details");
    expect(genericResult.decision.fallbackReason).toBe(
      "Codex template decision failed: unavailable.",
    );
  });
});
