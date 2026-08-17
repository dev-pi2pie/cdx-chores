import { describe, expect, test } from "bun:test";

import type { PrepareMarkdownPdfRenderInput } from "../../src/cli/actions/markdown/to-pdf-service";
import type { MarkdownPdfRenderPageNumberChoice } from "../../src/cli/interactive/markdown/render-page-numbers";
import { prepareMarkdownPdfRenderSource } from "../../src/cli/interactive/markdown/render-source";

describe("interactive Markdown PDF page-number preparation", () => {
  test.each([
    ["inherit", undefined],
    ["enable", true],
    ["disable", false],
  ] as const)(
    "passes explicit %s through exactly one authoritative preparation",
    async (choice, expected) => {
      const calls: PrepareMarkdownPdfRenderInput[] = [];
      const selected = {
        input: { input: "fixtures/report.md", profile: "fixtures/profile.yml" },
        kind: "selected" as const,
        source: "existing-profile" as const,
      };

      const result = await prepareMarkdownPdfRenderSource(
        {} as never,
        selected,
        "inherit",
        choice satisfies MarkdownPdfRenderPageNumberChoice,
        {
          prepareRender: async (_runtime, input) => {
            calls.push(input);
            return {} as never;
          },
        },
      );

      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({
        input: "fixtures/report.md",
        profile: "fixtures/profile.yml",
        ...(expected === undefined ? {} : { pageNumbers: expected }),
      });
      expect(result.pageNumbers).toBe(choice);
      expect(result.selected).toBe(selected);
    },
  );

  test("keeps omitted page-number state absent for legacy callers", async () => {
    const calls: PrepareMarkdownPdfRenderInput[] = [];
    const result = await prepareMarkdownPdfRenderSource(
      {} as never,
      {
        input: { input: "fixtures/report.md" },
        kind: "selected",
        source: "built-in",
      },
      "inherit",
      undefined,
      {
        prepareRender: async (_runtime, input) => {
          calls.push(input);
          return {} as never;
        },
      },
    );

    expect(calls).toEqual([{ input: "fixtures/report.md" }]);
    expect(result).not.toHaveProperty("pageNumbers");
  });
});
