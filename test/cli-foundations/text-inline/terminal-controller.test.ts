import { describe, expect, test } from "bun:test";

import { VirtualTerminal, wrapAscii } from "../inline-rendering/virtual-terminal";
import { FakePromptReadStream, FakePromptWriteStream, nextRenderTick } from "./prompt-fixtures";

const textInlineModuleId = "../../../src/cli/prompts/text-inline?cli-foundations-terminal";
const { promptTextInlineGhost } = (await import(
  textInlineModuleId
)) as typeof import("../../../src/cli/prompts/text-inline");

describe("text inline terminal controller", () => {
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
});
