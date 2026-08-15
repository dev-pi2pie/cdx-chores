import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";

import { promptTextInlineGhost, promptTextWithGhost } from "../src/cli/prompts/text-inline";
import { VirtualTerminal, wrapAscii } from "./helpers/virtual-terminal";

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
  columns = 80;
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
  test("template completion starts only after an opening brace is typed", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    const prompt = promptTextInlineGhost({
      message: "Template",
      ghostText: "{timestamp}-{stem}",
      completionKind: "rename-template",
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => (value.trim().length > 0 ? true : "Required"),
    });

    await nextRenderTick();
    expect(stdout.text).toContain("Template ");
    expect(stdout.text).not.toContain("\x1b[2m{timestamp}-{stem}\x1b[22m");

    stdin.emit("keypress", "t", { name: "t" });
    await nextRenderTick();
    expect(stdout.text).toContain("Template t");
    expect(stdout.text).not.toContain("\x1b[2mimestamp");

    stdin.emit("keypress", "{", { name: "{" });
    stdin.emit("keypress", "t", { name: "t" });
    await nextRenderTick();
    expect(stdout.text).toContain("Template t{t");
    expect(stdout.text).toContain("\x1b[2mimestamp}\x1b[22m");

    stdin.emit("keypress", "\r", { name: "return" });
    await expect(prompt).resolves.toBe("t{t");
  });

  test("template completion accepts the current trailing token with right arrow and tab", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    const prompt = promptTextInlineGhost({
      message: "Template",
      ghostText: "{timestamp}-{stem}",
      completionKind: "rename-template",
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => (value.trim().length > 0 ? true : "Required"),
    });

    await nextRenderTick();
    for (const [str, name] of [
      ["{", "{"],
      ["t", "t"],
      ["i", "i"],
      ["m", "m"],
    ] as const) {
      stdin.emit("keypress", str, { name });
    }
    await nextRenderTick();
    stdin.emit("keypress", "", { name: "right" });
    await nextRenderTick();
    expect(stdout.text).toContain("Template {timestamp}");

    stdin.emit("keypress", "-", { name: "-" });
    stdin.emit("keypress", "{", { name: "{" });
    stdin.emit("keypress", "s", { name: "s" });
    stdin.emit("keypress", "t", { name: "t" });
    await nextRenderTick();
    stdin.emit("keypress", "\t", { name: "tab" });
    stdin.emit("keypress", "\r", { name: "return" });

    await expect(prompt).resolves.toBe("{timestamp}-{stem}");
  });

  test("template completion cycles sibling candidates within narrowed families", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    const prompt = promptTextInlineGhost({
      message: "Template",
      ghostText: "{timestamp}-{stem}",
      completionKind: "rename-template",
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => (value.trim().length > 0 ? true : "Required"),
    });

    await nextRenderTick();
    for (const [str, name] of [
      ["{", "{"],
      ["t", "t"],
      ["i", "i"],
      ["m", "m"],
      ["e", "e"],
      ["s", "s"],
      ["t", "t"],
      ["a", "a"],
      ["m", "m"],
      ["p", "p"],
      ["_", "_"],
    ] as const) {
      stdin.emit("keypress", str, { name });
    }
    await nextRenderTick();
    stdin.emit("keypress", "", { name: "down" });
    await nextRenderTick();
    stdin.emit("keypress", "\t", { name: "tab" });
    stdin.emit("keypress", "\r", { name: "return" });

    await expect(prompt).resolves.toBe("{timestamp_utc}");
    expect(stdout.text).toContain("Template {timestamp_");
    expect(stdout.text).toContain("\x1b[2mutc}\x1b[22m");
  });

  test("template completion narrows into the date family after the prefix is typed", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    const prompt = promptTextInlineGhost({
      message: "Template",
      ghostText: "{timestamp}-{stem}",
      completionKind: "rename-template",
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => (value.trim().length > 0 ? true : "Required"),
    });

    await nextRenderTick();
    for (const [str, name] of [
      ["{", "{"],
      ["d", "d"],
      ["a", "a"],
      ["t", "t"],
      ["e", "e"],
      ["_", "_"],
    ] as const) {
      stdin.emit("keypress", str, { name });
    }
    await nextRenderTick();
    stdin.emit("keypress", "", { name: "down" });
    await nextRenderTick();
    stdin.emit("keypress", "", { name: "right" });
    stdin.emit("keypress", "\r", { name: "return" });

    await expect(prompt).resolves.toBe("{date_utc}");
    expect(stdout.text).toContain("\x1b[2mutc}\x1b[22m");
  });

  test("Markdown PDF completion starts with the full ghost then completes typed fragments", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    const prompt = promptTextInlineGhost({
      message: "Page-number label",
      ghostHintLabel: "Page-number label suggestion",
      ghostText: "Page {page} of {pages}",
      completionKind: "markdown-pdf-page-label",
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => (value.includes("{page}") ? true : "Include {page}"),
    });

    await nextRenderTick();
    expect(stdout.text).toContain("\x1b[2mPage {page} of {pages}\x1b[22m");

    stdin.emit("keypress", "{", { name: "{" });
    stdin.emit("keypress", "p", { name: "p" });
    await nextRenderTick();
    expect(stdout.text).toContain("Page-number label {p");
    expect(stdout.text).toContain("\x1b[2mage}\x1b[22m");

    stdin.emit("keypress", "", { name: "right" });
    stdin.emit("keypress", "\r", { name: "return" });
    await expect(prompt).resolves.toBe("{page}");
  });

  test("Markdown PDF completion cycles only within its active context", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    const prompt = promptTextInlineGhost({
      message: "Repeating content",
      ghostText: "{title}",
      completionKind: "markdown-pdf-repeating-content",
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => (value.length > 0 ? true : "Required"),
    });

    await nextRenderTick();
    stdin.emit("keypress", "{", { name: "{" });
    await nextRenderTick();
    stdin.emit("keypress", "", { name: "down" });
    await nextRenderTick();
    expect(stdout.text).toContain("\x1b[2mcompany}\x1b[22m");

    stdin.emit("keypress", "\t", { name: "tab" });
    stdin.emit("keypress", "\r", { name: "return" });
    await expect(prompt).resolves.toBe("{company}");
  });

  test("restoring the fresh full ghost resets the fragment candidate cycle", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    const prompt = promptTextInlineGhost({
      message: "Page-number label",
      ghostText: "Page {page} of {pages}",
      completionKind: "markdown-pdf-page-label",
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => (value.includes("{page}") ? true : "Include {page}"),
    });

    await nextRenderTick();
    stdin.emit("keypress", "{", { name: "{" });
    stdin.emit("keypress", "", { name: "down" });
    await nextRenderTick();
    expect(stdout.text).toContain("\x1b[2mpages}\x1b[22m");

    stdin.emit("keypress", "", { ctrl: true, name: "u" });
    await nextRenderTick();
    const writesAfterReset = stdout.writes.length;
    stdin.emit("keypress", "{", { name: "{" });
    await nextRenderTick();
    expect(stdout.writes.slice(writesAfterReset).join("")).toContain("\x1b[2mpage}\x1b[22m");

    stdin.emit("keypress", "", { name: "right" });
    stdin.emit("keypress", "\r", { name: "return" });
    await expect(prompt).resolves.toBe("{page}");
  });

  test("initial values are editable and suppress the full static ghost", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    const prompt = promptTextInlineGhost({
      message: "Page-number label",
      ghostHintLabel: "Page-number label suggestion",
      ghostText: "Page {page} of {pages}",
      initialValue: "Page {page}",
      completionKind: "markdown-pdf-page-label",
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => (value.includes("{page}") ? true : "Include {page}"),
    });

    await nextRenderTick();
    expect(stdout.text).toContain("Page-number label Page {page}");
    expect(stdout.text).not.toContain("\x1b[2mPage {page} of {pages}\x1b[22m");
    expect(stdout.text).not.toContain("Page-number label suggestion");

    stdin.emit("keypress", "\b", { name: "backspace" });
    stdin.emit("keypress", "\b", { name: "backspace" });
    await nextRenderTick();
    expect(stdout.text).toContain("\x1b[2me}\x1b[22m");

    stdin.emit("keypress", "", { name: "right" });
    stdin.emit("keypress", "!", { name: "!" });
    stdin.emit("keypress", "\r", { name: "return" });
    await expect(prompt).resolves.toBe("Page {page}!");
  });

  test("visible Markdown PDF ghost remains a suggestion until it is accepted", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    const validatedValues: string[] = [];
    const prompt = promptTextInlineGhost({
      message: "Page-number label",
      ghostText: "Page {page}",
      completionKind: "markdown-pdf-page-label",
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => {
        validatedValues.push(value);
        return value.length > 0 ? true : "Required";
      },
    });

    await nextRenderTick();
    stdin.emit("keypress", "\r", { name: "return" });
    await nextRenderTick();
    expect(validatedValues).toEqual([""]);

    stdin.emit("keypress", "", { name: "right" });
    stdin.emit("keypress", "\r", { name: "return" });
    await expect(prompt).resolves.toBe("Page {page}");
    expect(validatedValues).toEqual(["", "Page {page}"]);
  });

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

  test("promptTextInlineGhost treats q as literal input after existing text", async () => {
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
    stdin.emit("keypress", "a", { name: "a" });
    await nextRenderTick();
    stdin.emit("keypress", "q", { name: "q" });
    await nextRenderTick();
    stdin.emit("keypress", "\r", { name: "return" });

    await expect(prompt).resolves.toBe("aq");
    expect(stdout.text).toContain("Template aq");
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

  test("promptTextInlineGhost cancels and restores raw mode with an initial value", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    const prompt = promptTextInlineGhost({
      message: "Page-number label",
      ghostText: "Page {page} of {pages}",
      initialValue: "Page {page}",
      completionKind: "markdown-pdf-page-label",
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => (value.includes("{page}") ? true : "Include {page}"),
    });

    await nextRenderTick();
    stdin.emit("keypress", "\x03", { ctrl: true, name: "c" });

    await expect(prompt).rejects.toMatchObject({
      name: "ExitPromptError",
      message: "User aborted prompt",
    });
    expect(stdin.rawModeCalls).toEqual([true, false]);
    expect(stdin.pauseCalls).toBe(1);
    expect(stdout.text).toContain("\x1b[?25h");
  });

  test("promptTextInlineGhost uses display width for non-ASCII ghost cursor positioning", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    const prompt = promptTextInlineGhost({
      message: "Template",
      ghostText: "資料😀.csv",
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => (value.trim().length > 0 ? true : "Required"),
    });

    await nextRenderTick();
    expect(stdout.text).toContain("\x1b7");
    expect(stdout.text).toContain("\x1b8");
    expect(stdout.text).toContain("\x1b[2m資料😀.csv\x1b[22m");

    stdin.emit("keypress", "\x1b", { name: "escape" });
    await expect(prompt).rejects.toMatchObject({
      name: "ExitPromptError",
      message: "User aborted prompt",
    });
  });

  test("promptTextInlineGhost clears wrapped rows on Esc", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    stdout.columns = 20;
    const prompt = promptTextInlineGhost({
      message: "Template",
      ghostText: "{timestamp}-{stem}-{uid}-very-long-placeholder",
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

    const terminal = new VirtualTerminal(stdout.columns);
    terminal.write(stdout.text);
    expect(terminal.getVisibleLines()).toEqual([]);
  });

  test("promptTextInlineGhost clears wrapped rows while shrinking with backspace", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    stdout.columns = 20;
    const prompt = promptTextInlineGhost({
      message: "Template",
      ghostText: "",
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => (value.trim().length > 0 ? true : "Required"),
    });
    const longInput = "very-long-template-name-with-many-segments";
    const submitted = "very-long";

    await nextRenderTick();
    for (const character of longInput) {
      stdin.emit("keypress", character, { name: character });
    }
    await nextRenderTick();
    const backspaceCount = longInput.length - submitted.length;
    for (let index = 0; index < backspaceCount; index += 1) {
      stdin.emit("keypress", "\b", { name: "backspace" });
    }
    await nextRenderTick();
    stdin.emit("keypress", "\r", { name: "return" });

    await expect(prompt).resolves.toBe(submitted);

    const terminal = new VirtualTerminal(stdout.columns);
    terminal.write(stdout.text);
    expect(terminal.getVisibleLines()).toEqual(wrapAscii(`Template ${submitted}`, stdout.columns));
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
    expect(stdout.text).toContain(
      "Template suggestion (Right arrow to accept): {timestamp}-{stem}",
    );
  });

  test("promptTextWithGhost preserves the revision value when advanced input falls back", async () => {
    let advancedCalls = 0;
    let receivedDefault: unknown;
    const stdout = new FakePromptWriteStream();
    const result = await promptTextWithGhost({
      message: "Page-number label",
      ghostHintLabel: "Page-number label suggestion",
      ghostText: "Page {page} of {pages}",
      initialValue: "Page {page}",
      completionKind: "markdown-pdf-page-label",
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
      validate: (value) => (value.includes("{page}") ? true : "Include {page}"),
      promptImpls: {
        advancedInline: async () => {
          advancedCalls += 1;
          throw new Error("boom");
        },
        simpleInput: async (options) => {
          receivedDefault = options.default;
          return String(options.default);
        },
      },
    });

    expect(advancedCalls).toBe(1);
    expect(receivedDefault).toBe("Page {page}");
    expect(result).toBe("Page {page}");
  });

  test("promptTextWithGhost passes the initial value to simple input as its default", async () => {
    let receivedDefault: unknown;
    const stdout = new FakePromptWriteStream();
    const result = await promptTextWithGhost({
      message: "Page-number label",
      helpLines: ["{page}: current logical page number"],
      ghostHintLabel: "Page-number label suggestion",
      ghostText: "Page {page} of {pages}",
      initialValue: "Page {page}",
      completionKind: "markdown-pdf-page-label",
      runtimeConfig: {
        mode: "simple",
        autocomplete: {
          enabled: true,
          minChars: 1,
          maxSuggestions: 12,
          includeHidden: false,
        },
      },
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => (value.includes("{page}") ? true : "Include {page}"),
      promptImpls: {
        simpleInput: async (options) => {
          receivedDefault = options.default;
          return String(options.default);
        },
      },
    });

    expect(result).toBe("Page {page}");
    expect(receivedDefault).toBe("Page {page}");
    expect(stdout.text).toContain("{page}: current logical page number");
    expect(stdout.text).not.toContain("Page-number label suggestion");
  });

  test("promptTextWithGhost prints the fresh Markdown PDF suggestion in simple mode", async () => {
    const stdout = new FakePromptWriteStream();
    const result = await promptTextWithGhost({
      message: "Page-number label",
      helpLines: ["{page}: current logical page number"],
      ghostHintLabel: "Page-number label suggestion",
      ghostText: "Page {page} of {pages}",
      completionKind: "markdown-pdf-page-label",
      runtimeConfig: {
        mode: "simple",
        autocomplete: {
          enabled: true,
          minChars: 1,
          maxSuggestions: 12,
          includeHidden: false,
        },
      },
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => (value.includes("{page}") ? true : "Include {page}"),
      promptImpls: {
        simpleInput: async (options) => {
          expect(options.default).toBeUndefined();
          return "Page {page}";
        },
      },
    });

    expect(result).toBe("Page {page}");
    expect(stdout.text).toContain("{page}: current logical page number");
    expect(stdout.text).toContain("Page-number label suggestion: Page {page} of {pages}");
  });
});
