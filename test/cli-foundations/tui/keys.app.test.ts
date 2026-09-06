import { describe, expect, test } from "bun:test";

import { createKeypressParser } from "../../../src/cli/tui";

describe("cli tui keys", () => {
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
