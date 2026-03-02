import { describe, expect, test } from "bun:test";

import { createKeypressParser, type ParsedKeypressEvent } from "../src/cli/tui";

describe("cli tui keys", () => {
  test("normalizes explicit arrow escape sequences", () => {
    const parser = createKeypressParser();

    expect(parser.handle("\x1b", { name: "escape" })).toEqual({ kind: "incomplete" });
    expect(parser.handle("[", { sequence: "[" })).toEqual({ kind: "incomplete" });
    expect(parser.handle("C", { sequence: "C" })).toEqual({
      kind: "arrow",
      direction: "right",
    } satisfies ParsedKeypressEvent);
  });

  test("passes through ordinary keypresses", () => {
    const parser = createKeypressParser();

    expect(parser.handle("a", { name: "a" })).toEqual({
      kind: "keypress",
      str: "a",
      key: { name: "a" },
    } satisfies ParsedKeypressEvent);
  });

  test("normalizes direct arrow key names without requiring escape-buffer state", () => {
    const parser = createKeypressParser();

    expect(parser.handle("", { name: "down" })).toEqual({
      kind: "arrow",
      direction: "down",
    } satisfies ParsedKeypressEvent);
  });

  test("invokes escape abort callback for a bare escape key", async () => {
    let aborted = 0;
    const parser = createKeypressParser({
      escapeAbortDelayMs: 1,
      onEscapeAbort: () => {
        aborted += 1;
      },
    });

    expect(parser.handle("\x1b", { name: "escape" })).toEqual({ kind: "incomplete" });

    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(aborted).toBe(1);
  });

  test("dispose clears a pending escape abort", async () => {
    let aborted = 0;
    const parser = createKeypressParser({
      escapeAbortDelayMs: 5,
      onEscapeAbort: () => {
        aborted += 1;
      },
    });

    parser.handle("\x1b", { name: "escape" });
    parser.dispose();

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(aborted).toBe(0);
  });
});
