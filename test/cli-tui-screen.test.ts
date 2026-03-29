import { describe, expect, test } from "bun:test";

import {
  beep,
  clearCurrentLine,
  dim,
  hideCursor,
  moveCursorDown,
  moveCursorLeft,
  moveCursorUp,
  showCursor,
} from "../src/cli/tui";

class CaptureWriteStream {
  writes: string[] = [];

  write(chunk: string | Uint8Array): boolean {
    this.writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
    return true;
  }

  get text(): string {
    return this.writes.join("");
  }
}

describe("cli tui screen", () => {
  test("dim wraps non-empty text and preserves empty text", () => {
    expect(dim("abc")).toBe("\x1b[2mabc\x1b[22m");
    expect(dim("")).toBe("");
  });

  test("screen helpers write the expected control sequences", () => {
    const stdout = new CaptureWriteStream();

    clearCurrentLine(stdout as unknown as NodeJS.WritableStream);
    moveCursorLeft(stdout as unknown as NodeJS.WritableStream, 3);
    moveCursorLeft(stdout as unknown as NodeJS.WritableStream, 0);
    moveCursorUp(stdout as unknown as NodeJS.WritableStream, 2);
    moveCursorUp(stdout as unknown as NodeJS.WritableStream, 0);
    moveCursorDown(stdout as unknown as NodeJS.WritableStream, 1);
    moveCursorDown(stdout as unknown as NodeJS.WritableStream, 0);
    beep(stdout as unknown as NodeJS.WritableStream);
    hideCursor(stdout as unknown as NodeJS.WritableStream);
    showCursor(stdout as unknown as NodeJS.WritableStream);

    expect(stdout.text).toBe("\r\x1b[2K\x1b[3D\x1b[2A\x1b[1B\x07\x1b[?25l\x1b[?25h");
  });
});
