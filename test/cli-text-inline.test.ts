import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";

import { promptTextInlineGhost, promptTextWithGhost } from "../src/cli/prompts/text-inline";

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

describe("text inline prompt controller", () => {
  test("promptTextInlineGhost prints help lines once while rerendering only the input line", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    const prompt = promptTextInlineGhost({
      message: "Template",
      helpLines: [
        "Custom filename template",
        "Main placeholders: {prefix}, {timestamp}, {date}, {stem}, {uid}, {serial}",
      ],
      ghostHintLabel: "Template suggestion (Right arrow to accept)",
      ghostText: "{timestamp}-{stem}",
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => (value.trim().length > 0 ? true : "Required"),
    });

    await nextRenderTick();
    stdin.emit("keypress", "a", { name: "a" });
    await nextRenderTick();
    stdin.emit("keypress", "b", { name: "b" });
    await nextRenderTick();
    stdin.emit("keypress", "\r", { name: "return" });

    await expect(prompt).resolves.toBe("ab");
    expect(stdout.text.match(/Custom filename template/g)?.length).toBe(1);
    expect(
      stdout.text.match(
        /Main placeholders: \{prefix\}, \{timestamp\}, \{date\}, \{stem\}, \{uid\}, \{serial\}/g,
      )?.length,
    ).toBe(1);
    expect(
      stdout.text.match(/Template suggestion \(Right arrow to accept\): \{timestamp\}-\{stem\}/g)
        ?.length,
    ).toBe(1);
    expect(stdout.text).toContain("Template a");
    expect(stdout.text).toContain("Template ab");
  });

  test("promptTextInlineGhost renders a dimmed ghost placeholder until typing starts", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    const prompt = promptTextInlineGhost({
      message: "Template",
      ghostText: "{timestamp}-{stem}",
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => (value.trim().length > 0 ? true : "Required"),
    });

    await nextRenderTick();
    expect(stdout.text).toContain("Template ");
    expect(stdout.text).toContain("\x1b[2m{timestamp}-{stem}\x1b[22m");

    stdin.emit("keypress", "a", { name: "a" });
    await nextRenderTick();
    expect(stdout.text).toContain("Template a");

    stdin.emit("keypress", "\r", { name: "return" });
    await expect(prompt).resolves.toBe("a");
  });

  test("promptTextInlineGhost accepts the full ghost placeholder with right arrow", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    const prompt = promptTextInlineGhost({
      message: "Template",
      ghostText: "{timestamp}-{stem}",
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => (value.trim().length > 0 ? true : "Required"),
    });

    await nextRenderTick();
    stdin.emit("keypress", "", { name: "right" });
    stdin.emit("keypress", "\r", { name: "return" });

    await expect(prompt).resolves.toBe("{timestamp}-{stem}");
    expect(stdout.text).toContain("Template {timestamp}-{stem}");
  });

  test("promptTextInlineGhost rejects on Esc and restores the raw session", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    const prompt = promptTextInlineGhost({
      message: "Template",
      ghostText: "{timestamp}-{stem}",
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => (value.trim().length > 0 ? true : "Required"),
    });

    await nextRenderTick();
    stdin.emit("keypress", "\x1b", { name: "escape" });

    await expect(prompt).rejects.toMatchObject({
      name: "ExitPromptError",
      message: "User aborted prompt",
    });
    expect(stdin.rawModeCalls).toEqual([true, false]);
    expect(stdout.text).toContain("\x1b[?25h");
  });

  test("promptTextWithGhost falls back to simple input when advanced prompt fails", async () => {
    const calls: string[] = [];
    const stdout = new FakePromptWriteStream();
    const result = await promptTextWithGhost({
      message: "Template",
      helpLines: ["Custom filename template"],
      ghostHintLabel: "Template suggestion (Right arrow to accept)",
      ghostText: "{timestamp}-{stem}",
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
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => (value.trim().length > 0 ? true : "Required"),
      promptImpls: {
        advancedInline: async () => {
          throw new Error("boom");
        },
        simpleInput: async (options) => {
          calls.push(String(options.message));
          return "{date}-{stem}";
        },
      },
    });

    expect(result).toBe("{date}-{stem}");
    expect(calls).toEqual(["Template"]);
    expect(stdout.text).toContain("Custom filename template\n");
    expect(stdout.text).toContain("Template suggestion (Right arrow to accept): {timestamp}-{stem}");
  });
});
