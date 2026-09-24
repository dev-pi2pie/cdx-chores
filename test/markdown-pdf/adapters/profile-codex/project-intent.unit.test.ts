import { describe, expect, test } from "bun:test";
import { suggestMarkdownPdfProfileWithCodex } from "../../../../src/adapters/codex/markdown-pdf-profile";
import { requestBase } from "./fixtures";

const response = {
  decision_mode: "adapted",
  selected_candidate_id: "default",
  accepted_patches: [],
  accepted_font_patches: [],
  reasoning: "Use the supplied facts.",
  warnings: [],
  fallback_reason: "",
  unmatched_directions: [],
};

describe("Project Profile intent contract", () => {
  test.each([undefined, "unknown", true])(
    "rejects missing or invalid Project intent %p",
    async (value) => {
      await expect(
        suggestMarkdownPdfProfileWithCodex({
          ...requestBase,
          projectCoverImageAvailable: false,
          runner: async () => JSON.stringify({ ...response, project_cover_intent: value }),
        }),
      ).rejects.toMatchObject({ kind: "malformed-output" });
    },
  );
  test.each(["unspecified", "requested", "text-only", "image", "no-cover", "conflict"])(
    "carries validated Project intent %s",
    async (value) => {
      const result = await suggestMarkdownPdfProfileWithCodex({
        ...requestBase,
        projectCoverImageAvailable: false,
        runner: async ({ prompt }) => {
          expect(prompt).toContain("interpreted in its original language");
          return JSON.stringify({ ...response, project_cover_intent: value });
        },
      });
      expect(result.decision.projectCoverIntent).toBe(value);
    },
  );
  test("leaves standalone Profile responses unchanged", async () => {
    const result = await suggestMarkdownPdfProfileWithCodex({
      ...requestBase,
      runner: async ({ prompt }) => {
        expect(prompt).not.toContain("project_cover_intent");
        return JSON.stringify(response);
      },
    });
    expect(result.decision.projectCoverIntent).toBeUndefined();
  });
});
