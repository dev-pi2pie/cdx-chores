import { describe, expect, test } from "bun:test";

import {
  classifyMarkdownPdfCodexProfileFailure,
  MarkdownPdfCodexProfileError,
  suggestMarkdownPdfProfileWithCodex,
} from "../../src/adapters/codex/markdown-pdf-profile";
import { requestBase } from "./fixtures";

describe("Markdown PDF Codex profile adapter", () => {
  test("supports conservative fallback and no usable profile decision modes", async () => {
    const fallback = await suggestMarkdownPdfProfileWithCodex({
      ...requestBase,
      runner: async () =>
        JSON.stringify({
          decision_mode: "conservative-fallback",
          selected_candidate_id: "default",
          accepted_patches: [],
          accepted_font_patches: [],
          reasoning: "Facts are weak.",
          warnings: ["Using default profile."],
          fallback_reason: "No strong layout signals.",
          unmatched_directions: [],
        }),
    });
    const noProfile = await suggestMarkdownPdfProfileWithCodex({
      ...requestBase,
      runner: async () =>
        JSON.stringify({
          decision_mode: "no-usable-profile",
          selected_candidate_id: "none",
          accepted_patches: [],
          accepted_font_patches: [],
          reasoning: "No profile should be written.",
          warnings: [],
          fallback_reason: " ",
          unmatched_directions: ["unsupported custom CSS"],
        }),
    });

    expect(fallback.profile).toBeDefined();
    expect(fallback.decision.fallbackReason).toBe("No strong layout signals.");
    expect(noProfile.profile).toBeUndefined();
    expect(noProfile.decision.fallbackReason).toBeUndefined();
    expect(noProfile.decision.unmatchedDirections).toEqual(["unsupported custom CSS"]);
  });

  test("classifies Codex unavailable and structured-output failures", () => {
    expect(classifyMarkdownPdfCodexProfileFailure(new Error("network unavailable"))).toBe(
      "unavailable",
    );
    expect(
      classifyMarkdownPdfCodexProfileFailure(new Error("invalid_json_schema response_format")),
    ).toBe("unavailable");
    expect(
      classifyMarkdownPdfCodexProfileFailure(
        new MarkdownPdfCodexProfileError("bad", "structured-output-schema"),
      ),
    ).toBe("structured-output-schema");
    expect(
      classifyMarkdownPdfCodexProfileFailure(
        new MarkdownPdfCodexProfileError("bad", "malformed-output"),
      ),
    ).toBe("malformed-output");
    expect(
      classifyMarkdownPdfCodexProfileFailure(
        new MarkdownPdfCodexProfileError("bad", "invalid-application"),
      ),
    ).toBe("invalid-application");
    expect(classifyMarkdownPdfCodexProfileFailure(new Error('{"unrelated":true}'))).toBe(
      "unavailable",
    );
  });

  test("fails closed for malformed structured output through the exported adapter", async () => {
    await expect(
      suggestMarkdownPdfProfileWithCodex({
        ...requestBase,
        runner: async () => "not json",
      }),
    ).rejects.toMatchObject({ kind: "malformed-output" });
    await expect(
      suggestMarkdownPdfProfileWithCodex({
        ...requestBase,
        runner: async () => {
          throw new Error("invalid_json_schema response_format");
        },
      }),
    ).rejects.toMatchObject({
      kind: "structured-output-schema",
      name: "MarkdownPdfCodexProfileError",
    });
    await expect(
      suggestMarkdownPdfProfileWithCodex({
        ...requestBase,
        runner: async () =>
          JSON.stringify({
            decision_mode: "adapted",
            selected_candidate_id: "default",
            accepted_patches: [],
            accepted_font_patches: [],
            reasoning: "missing arrays",
          }),
      }),
    ).rejects.toThrow("must be an array");
    await expect(
      suggestMarkdownPdfProfileWithCodex({
        ...requestBase,
        runner: async () =>
          JSON.stringify({
            decision_mode: "adapted",
            selected_candidate_id: "default",
            accepted_patches: [],
            accepted_font_patches: [],
            reasoning: "bad warnings",
            warnings: "nope",
            unmatched_directions: [],
          }),
      }),
    ).rejects.toThrow("warnings must be an array");
    await expect(
      suggestMarkdownPdfProfileWithCodex({
        ...requestBase,
        runner: async () =>
          JSON.stringify({
            decision_mode: "adapted",
            selected_candidate_id: "default",
            accepted_patches: [],
            accepted_font_patches: [],
            reasoning: "blank warning",
            warnings: [" "],
            unmatched_directions: [],
          }),
      }),
    ).rejects.toThrow("warnings[0] must not be empty");
    await expect(
      suggestMarkdownPdfProfileWithCodex({
        ...requestBase,
        runner: async () =>
          JSON.stringify({
            decision_mode: "other",
            selected_candidate_id: "default",
            accepted_patches: [],
            accepted_font_patches: [],
            reasoning: "bad mode",
            warnings: [],
            unmatched_directions: [],
          }),
      }),
    ).rejects.toThrow("decision_mode must be one of");
    await expect(
      suggestMarkdownPdfProfileWithCodex({
        ...requestBase,
        runner: async () =>
          JSON.stringify({
            decision_mode: "no-usable-profile",
            reasoning: "No profile should be written.",
            warnings: [],
            unmatched_directions: [],
          }),
      }),
    ).rejects.toThrow("selected_candidate_id must be a non-empty string");
    await expect(
      suggestMarkdownPdfProfileWithCodex({
        ...requestBase,
        runner: async () =>
          JSON.stringify({
            decision_mode: "no-usable-profile",
            selected_candidate_id: "none",
            accepted_patches: [{ op: "replace", path: "/toc/enabled", value: true }],
            accepted_font_patches: [],
            reasoning: "No profile should be written.",
            warnings: [],
            unmatched_directions: [],
          }),
      }),
    ).rejects.toThrow("accepted_patches must be empty for no-usable-profile");
    await expect(
      suggestMarkdownPdfProfileWithCodex({
        ...requestBase,
        runner: async () =>
          JSON.stringify({
            decision_mode: "adapted",
            selected_candidate_id: "missing",
            accepted_patches: [],
            accepted_font_patches: [],
            reasoning: "bad candidate",
            warnings: [],
            unmatched_directions: [],
          }),
      }),
    ).rejects.toMatchObject({ kind: "invalid-application" });
  });
});
