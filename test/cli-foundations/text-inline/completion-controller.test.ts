import { describe, expect, test } from "bun:test";

import { FakePromptReadStream, FakePromptWriteStream, nextRenderTick } from "./prompt-fixtures";

const textInlineModuleId = "../../../src/cli/prompts/text-inline?cli-foundations-completion";
const { promptTextInlineGhost } = (await import(
  textInlineModuleId
)) as typeof import("../../../src/cli/prompts/text-inline");

describe("text inline completion controller", () => {
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

  test("Markdown PDF page-label completion cycles through logical and physical tokens in registry order", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    const prompt = promptTextInlineGhost({
      message: "Page-number label",
      ghostText: "Page {page} of {pages}",
      completionKind: "markdown-pdf-page-label",
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => (value === "{pdfPages}" ? true : "Select {pdfPages}"),
    });

    await nextRenderTick();
    stdin.emit("keypress", "{", { name: "{" });
    stdin.emit("keypress", "p", { name: "p" });
    await nextRenderTick();
    expect(stdout.text).toContain("\x1b[2mage}\x1b[22m");

    stdin.emit("keypress", "", { name: "down" });
    await nextRenderTick();
    expect(stdout.text).toContain("\x1b[2mages}\x1b[22m");

    stdin.emit("keypress", "", { name: "down" });
    await nextRenderTick();
    expect(stdout.text).toContain("\x1b[2mdfPage}\x1b[22m");

    stdin.emit("keypress", "", { name: "down" });
    await nextRenderTick();
    expect(stdout.text).toContain("\x1b[2mdfPages}\x1b[22m");

    stdin.emit("keypress", "", { name: "down" });
    await nextRenderTick();
    expect(stdout.text).toContain("\x1b[2mage}\x1b[22m");

    stdin.emit("keypress", "", { name: "up" });
    await nextRenderTick();
    expect(stdout.text).toContain("\x1b[2mdfPages}\x1b[22m");

    stdin.emit("keypress", "\t", { name: "tab" });
    stdin.emit("keypress", "\r", { name: "return" });
    await expect(prompt).resolves.toBe("{pdfPages}");
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
});
