import { describe, expect, test } from "bun:test";

import {
  compileMarkdownPdfRenderPageNumberChoice,
  promptMarkdownPdfRenderPageNumberChoice,
} from "../../../src/cli/interactive/markdown/render-page-numbers";

interface SelectOptions {
  choices: ReadonlyArray<{ name: string; value: string }>;
  default?: string;
  message: string;
}

describe("interactive Markdown PDF page-number choice", () => {
  test.each([
    ["inherit", undefined],
    ["enable", true],
    ["disable", false],
  ] as const)("compiles %s to the shared optional override", (choice, expected) => {
    expect(compileMarkdownPdfRenderPageNumberChoice(choice)).toBe(expected);
  });

  test.each(["back", "cancel"] as const)(
    "offers the exact choices with the retained default and returns %s unchanged",
    async (outcome) => {
      const selectCalls: SelectOptions[] = [];

      await expect(
        promptMarkdownPdfRenderPageNumberChoice("disable", {
          select: async (options) => {
            selectCalls.push(options as SelectOptions);
            return outcome;
          },
        }),
      ).resolves.toBe(outcome);
      expect(selectCalls).toEqual([
        {
          message: "Page numbers for this PDF",
          choices: [
            { name: "Keep recipe setting", value: "inherit" },
            { name: "Turn on for this PDF only", value: "enable" },
            { name: "Turn off for this PDF only", value: "disable" },
            { name: "Back", value: "back" },
            { name: "Cancel", value: "cancel" },
          ],
          default: "disable",
        },
      ]);
    },
  );

  test("defaults the prompt to Keep recipe setting", async () => {
    const selectCalls: SelectOptions[] = [];

    await expect(
      promptMarkdownPdfRenderPageNumberChoice(undefined, {
        select: async (options) => {
          selectCalls.push(options as SelectOptions);
          return "inherit";
        },
      }),
    ).resolves.toBe("inherit");
    expect(selectCalls[0]?.default).toBe("inherit");
  });
});
