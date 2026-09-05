import { describe, expect, test } from "bun:test";

import { shouldSuggestForPathInput } from "../../../src/cli/prompts/path-suggestions";

describe("path suggestion engine", () => {
  test("shouldSuggestForPathInput enforces min chars but allows explicit path prefixes", () => {
    expect(shouldSuggestForPathInput("", { minChars: 1 })).toBe(false);
    expect(shouldSuggestForPathInput("a", { minChars: 1 })).toBe(true);
    expect(shouldSuggestForPathInput("./", { minChars: 3 })).toBe(true);
    expect(shouldSuggestForPathInput("../", { minChars: 5 })).toBe(true);
    expect(shouldSuggestForPathInput("/", { minChars: 2 })).toBe(true);
  });
});
