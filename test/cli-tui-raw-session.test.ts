import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";

import { startRawSession, supportsRawSessionIO, type RawSessionKeypressInfo } from "../src/cli/tui";

class FakeReadStream extends EventEmitter {
  isTTY = true;
  rawModeCalls: boolean[] = [];
  resumeCalls = 0;
  pauseCalls = 0;

  setRawMode(flag: boolean): void {
    this.rawModeCalls.push(flag);
  }

  resume(): void {
    this.resumeCalls += 1;
  }

  pause(): void {
    this.pauseCalls += 1;
  }
}

class FakeWriteStream {
  isTTY = true;
  writes: string[] = [];

  write(chunk: string): boolean {
    this.writes.push(chunk);
    return true;
  }
}

describe("cli tui raw-session", () => {
  test("supportsRawSessionIO requires TTY stdout and raw-mode stdin support", () => {
    const stdin = new FakeReadStream() as unknown as NodeJS.ReadStream;
    const stdout = new FakeWriteStream() as unknown as NodeJS.WritableStream;

    expect(supportsRawSessionIO(stdin, stdout)).toBe(true);
    expect(
      supportsRawSessionIO(
        stdin,
        { write: () => true, isTTY: false } as unknown as NodeJS.WritableStream,
      ),
    ).toBe(false);
    expect(
      supportsRawSessionIO(
        { isTTY: true } as NodeJS.ReadStream,
        stdout,
      ),
    ).toBe(false);
  });

  test("startRawSession manages raw mode, keypress listeners, and teardown", () => {
    const stdin = new FakeReadStream();
    const stdout = new FakeWriteStream();
    let teardownCount = 0;
    const events: string[] = [];

    const session = startRawSession({
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WritableStream,
      onTeardown: () => {
        teardownCount += 1;
      },
    });

    const handler = (str: string, key: RawSessionKeypressInfo): void => {
      events.push(`${str}:${key.name ?? ""}`);
    };

    session.addKeypressListener(handler);
    stdin.emit("keypress", "a", { name: "a" } satisfies RawSessionKeypressInfo);

    session.close();
    stdin.emit("keypress", "b", { name: "b" } satisfies RawSessionKeypressInfo);
    session.close();

    expect(events).toEqual(["a:a"]);
    expect(teardownCount).toBe(1);
    expect(stdin.resumeCalls).toBe(1);
    expect(stdin.pauseCalls).toBe(1);
    expect(stdin.rawModeCalls).toEqual([true, false]);
    expect(stdout.writes).toEqual(["\x1b[?25l", "\x1b[?25h"]);
  });
});
