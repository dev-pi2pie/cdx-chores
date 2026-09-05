import { describe, expect, test } from "bun:test";

import {
  suggestMarkdownPdfProfileWithCodex,
  classifyMarkdownPdfCodexProfileFailure,
} from "../../../src/adapters/codex/markdown-pdf-profile";
import { suggestMarkdownPdfTemplateWithCodex } from "../../../src/adapters/codex/markdown-pdf-template";
import { requestBase as profileRequest } from "../../adapters-codex-markdown-pdf-profile/fixtures";
import { requestBase as templateRequest, noUsableResponse } from "./template-codex-fixtures";

const codexExecution = {
  model: "Model-A",
  provider: "Provider-A",
  reasoningEffort: "high",
} as const;

describe("Markdown adapter execution policy", () => {
  test.each([undefined, codexExecution])(
    "profile runner receives independent policy %j",
    async (execution) => {
      let calls = 0;
      await suggestMarkdownPdfProfileWithCodex({
        ...profileRequest,
        codexExecution: execution,
        runner: async (options) => {
          calls += 1;
          expect(options.codexExecution).toEqual(execution ?? { reasoningEffort: "low" });
          expect(Object.isFrozen(options.codexExecution)).toBe(true);
          expect(options.prompt).not.toContain("Provider-A");
          return JSON.stringify({
            decision_mode: "adapted",
            selected_candidate_id: "wide-table",
            accepted_patches: [],
            accepted_font_patches: [],
            reasoning: "No suitable candidate",
            warnings: [],
            fallback_reason: "No suitable candidate",
            unmatched_directions: [],
          });
        },
      });
      expect(calls).toBe(1);
    },
  );

  test.each([undefined, codexExecution])(
    "template runner receives independent policy %j",
    async (execution) => {
      let calls = 0;
      const result = await suggestMarkdownPdfTemplateWithCodex({
        ...templateRequest(),
        codexExecution: execution,
        runner: async (options) => {
          calls += 1;
          expect(options.codexExecution).toEqual(execution ?? { reasoningEffort: "low" });
          expect(Object.isFrozen(options.codexExecution)).toBe(true);
          expect(options.prompt).not.toContain("Provider-A");
          return noUsableResponse();
        },
      });
      expect(calls).toBe(1);
      expect(JSON.stringify(result)).not.toContain("codexExecution");
    },
  );

  test.each([
    "invalid_request_error: model unavailable",
    "invalid_request_error: reasoning effort high unsupported",
    "Unknown provider",
    "Authentication unavailable",
  ])("configuration rejection stays unavailable with no extra request: %s", async (message) => {
    let profileCalls = 0;
    let templateCalls = 0;
    const failure = new Error(message);
    try {
      await suggestMarkdownPdfProfileWithCodex({
        ...profileRequest,
        codexExecution,
        runner: async (options) => {
          profileCalls += 1;
          expect(options.codexExecution).toEqual(codexExecution);
          throw failure;
        },
      });
      throw new Error("Expected request failure");
    } catch (error) {
      expect(error).toBe(failure);
      expect(classifyMarkdownPdfCodexProfileFailure(error)).toBe("unavailable");
    }
    const result = await suggestMarkdownPdfTemplateWithCodex({
      ...templateRequest(),
      codexExecution,
      runner: async (options) => {
        templateCalls += 1;
        expect(options.codexExecution).toEqual(codexExecution);
        throw failure;
      },
    });
    expect(profileCalls).toBe(1);
    expect(templateCalls).toBe(1);
    expect(result.decision.fallbackReason).toBe("Codex template decision failed: unavailable.");
  });

  test("adapters reject invalid policies before reading request evidence or invoking runners", async () => {
    let touched = false;
    let invoked = false;
    await expect(
      suggestMarkdownPdfProfileWithCodex({
        ...profileRequest,
        codexExecution: { model: " " },
        get candidates(): never {
          touched = true;
          throw new Error("Evidence accessed");
        },
        runner: async () => {
          invoked = true;
          return "";
        },
      }),
    ).rejects.toThrow("model");
    await expect(
      suggestMarkdownPdfTemplateWithCodex({
        ...templateRequest(),
        codexExecution: { provider: " " },
        get signals(): never {
          touched = true;
          throw new Error("Evidence accessed");
        },
        runner: async () => {
          invoked = true;
          return "";
        },
      }),
    ).rejects.toThrow("provider");
    expect(touched).toBe(false);
    expect(invoked).toBe(false);
  });
});
