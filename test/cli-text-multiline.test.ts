import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";

import {
  promptMultilineTextWithFallback,
  promptTextMultiline,
} from "../src/cli/prompts/text-multiline";

class FakePromptReadStream extends EventEmitter {
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

class FakePromptWriteStream {
  isTTY = true;
  writes: string[] = [];

  write(chunk: string | Uint8Array): boolean {
    this.writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
    return true;
  }

  get text(): string {
    return this.writes.join("");
  }
}

async function nextRenderTick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("multiline text prompt controller", () => {
  test("promptTextMultiline submits with Enter", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    const prompt = promptTextMultiline({
      message: "Describe intent",
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => (value.trim().length > 0 ? true : "Required"),
    });

    await nextRenderTick();
    stdin.emit("keypress", "s", { name: "s" });
    stdin.emit("keypress", "h", { name: "h" });
    stdin.emit("keypress", "o", { name: "o" });
    stdin.emit("keypress", "w", { name: "w" });
    stdin.emit("keypress", "\r", { name: "return" });

    await expect(prompt).resolves.toBe("show");
    expect(stdout.text).toContain("Describe intent");
    expect(stdout.text).toContain("Press enter to submit, shift+enter for a new line");
  });

  test("promptTextMultiline treats Shift+Enter as newline when the terminal exposes it", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    const prompt = promptTextMultiline({
      message: "Describe intent",
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => (value.trim().length > 0 ? true : "Required"),
    });

    await nextRenderTick();
    stdin.emit("keypress", "c", { name: "c" });
    stdin.emit("keypress", "o", { name: "o" });
    stdin.emit("keypress", "u", { name: "u" });
    stdin.emit("keypress", "n", { name: "n" });
    stdin.emit("keypress", "t", { name: "t" });
    stdin.emit("keypress", "\r", { name: "return", shift: true });
    stdin.emit("keypress", "r", { name: "r" });
    stdin.emit("keypress", "o", { name: "o" });
    stdin.emit("keypress", "w", { name: "w" });
    stdin.emit("keypress", "s", { name: "s" });
    stdin.emit("keypress", "\r", { name: "return" });

    await expect(prompt).resolves.toBe("count\nrows");
  });

  test("promptMultilineTextWithFallback uses single-line input when advanced mode is unavailable", async () => {
    const result = await promptMultilineTextWithFallback({
      message: "Describe intent",
      runtimeConfig: {
        mode: "simple",
        autocomplete: {
          enabled: true,
          minChars: 1,
          maxSuggestions: 12,
          includeHidden: false,
        },
      },
      stdin: { isTTY: true } as NodeJS.ReadStream,
      stdout: { isTTY: true } as unknown as NodeJS.WritableStream,
      validate: (value) => (value.trim().length > 0 ? true : "Required"),
      promptImpls: {
        simpleInput: async () => "count rows",
      },
    });

    expect(result).toEqual({
      mode: "single-line-fallback",
      value: "count rows",
    });
  });

  test("promptMultilineTextWithFallback does not silently downgrade after advanced prompt failure", async () => {
    await expect(
      promptMultilineTextWithFallback({
        message: "Describe intent",
        runtimeConfig: {
          mode: "auto",
          autocomplete: {
            enabled: true,
            minChars: 1,
            maxSuggestions: 12,
            includeHidden: false,
          },
        },
        stdin: { isTTY: true } as NodeJS.ReadStream,
        stdout: { isTTY: true } as unknown as NodeJS.WritableStream,
        validate: (value) => (value.trim().length > 0 ? true : "Required"),
        promptImpls: {
          advancedMultiline: async () => {
            throw new Error("boom");
          },
          simpleInput: async () => "count rows",
        },
      }),
    ).rejects.toThrow("boom");
  });

  test("promptTextMultiline writes raw key debug logs when debug is enabled", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    const debug = new FakePromptWriteStream();
    const prompt = promptTextMultiline({
      debug: true,
      debugStream: debug as unknown as NodeJS.WritableStream,
      message: "Describe intent",
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => (value.trim().length > 0 ? true : "Required"),
    });

    await nextRenderTick();
    stdin.emit("keypress", "a", { name: "a", sequence: "a" });
    stdin.emit("keypress", "\r", { name: "return", sequence: "\r" });

    await expect(prompt).resolves.toBe("a");
    expect(debug.text).toContain("[multiline-key]");
    expect(debug.text).toContain('"name":"a"');
    expect(debug.text).toContain('"sequence":"a"');
    expect(debug.text).toContain('"name":"return"');
  });

});
