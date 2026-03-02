import { describe, expect, test } from "bun:test";

import { promptPath } from "../src/cli/prompts/path";

describe("path prompt routing", () => {
  test("promptPath uses simple fallback when advanced mode is unavailable", async () => {
    let advancedCalled = 0;
    let simpleCalled = 0;

    const value = await promptPath({
      message: "Path",
      runtimeConfig: {
        mode: "auto",
        autocomplete: {
          enabled: true,
          minChars: 1,
          maxSuggestions: 12,
          includeHidden: false,
        },
      },
      // No TTY streams/cwd, so advanced mode should not be used.
      promptImpls: {
        advancedInline: async () => {
          advancedCalled += 1;
          return "advanced";
        },
        simpleInput: async () => {
          simpleCalled += 1;
          return "simple";
        },
      },
    });

    expect(value).toBe("simple");
    expect(advancedCalled).toBe(0);
    expect(simpleCalled).toBe(1);
  });
});
