import { describe, expect, test } from "bun:test";

import { getDisplayWidth } from "../src/cli/text-display-width";

describe("text display width", () => {
  test("treats standalone emoji as double-width graphemes", () => {
    expect(getDisplayWidth("😀")).toBe(2);
    expect(getDisplayWidth("😀😀")).toBe(4);
  });

  test("treats joined emoji sequences as one double-width grapheme", () => {
    expect(getDisplayWidth("👨‍👩‍👧‍👦")).toBe(2);
    expect(getDisplayWidth("1️⃣")).toBe(2);
    expect(getDisplayWidth("👀")).toBe(2);
  });
});
