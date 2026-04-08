import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";

import { selectInteractiveMenuChoice } from "../src/cli/interactive/menu-prompt";

class FakePromptReadStream extends EventEmitter {
  isTTY = true;
}

class FakePromptWriteStream {
  isTTY = true;
  writes: string[] = [];

  write(chunk: string | Uint8Array): boolean {
    this.writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
    return true;
  }
}

function createAbortPromptError(): Error {
  const error = new Error("Prompt was aborted");
  error.name = "AbortPromptError";
  return error;
}

describe("interactive command menu prompt helper", () => {
  test("returns the prompt selection when no exit key is pressed", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();

    const result = await selectInteractiveMenuChoice({
      message: "Choose a command",
      choices: [
        { name: "doctor", value: "doctor" },
        { name: "cancel", value: "cancel" },
      ] as const,
      exitValue: "cancel",
      input: stdin as unknown as NodeJS.ReadStream,
      output: stdout as unknown as NodeJS.WritableStream,
      selectImpl: async () => "doctor",
    });

    expect(result).toBe("doctor");
  });

  test("returns the exit value when Escape aborts the root command menu", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    const prompt = selectInteractiveMenuChoice({
      message: "Choose a command",
      choices: [
        { name: "doctor", value: "doctor" },
        { name: "cancel", value: "cancel" },
      ] as const,
      exitValue: "cancel",
      input: stdin as unknown as NodeJS.ReadStream,
      output: stdout as unknown as NodeJS.WritableStream,
      selectImpl: async (_options, context) =>
        await new Promise<"doctor" | "cancel">((_resolve, reject) => {
          context?.signal?.addEventListener("abort", () => {
            reject(createAbortPromptError());
          });
        }),
    });

    stdin.emit("keypress", "\x1b", { name: "escape" });

    await expect(prompt).resolves.toBe("cancel");
  });

  test("returns the exit value when q aborts the root command menu", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    const prompt = selectInteractiveMenuChoice({
      message: "Choose a command",
      choices: [
        { name: "doctor", value: "doctor" },
        { name: "cancel", value: "cancel" },
      ] as const,
      exitValue: "cancel",
      input: stdin as unknown as NodeJS.ReadStream,
      output: stdout as unknown as NodeJS.WritableStream,
      selectImpl: async (_options, context) =>
        await new Promise<"doctor" | "cancel">((_resolve, reject) => {
          context?.signal?.addEventListener("abort", () => {
            reject(createAbortPromptError());
          });
        }),
    });

    stdin.emit("keypress", "q", { name: "q" });

    await expect(prompt).resolves.toBe("cancel");
  });

  test("returns the exit value when Escape aborts the submenu command menu", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    const prompt = selectInteractiveMenuChoice({
      message: "Choose a data command",
      choices: [
        { name: "preview", value: "data:preview" },
        { name: "cancel", value: "cancel" },
      ] as const,
      exitValue: "cancel",
      input: stdin as unknown as NodeJS.ReadStream,
      output: stdout as unknown as NodeJS.WritableStream,
      selectImpl: async (_options, context) =>
        await new Promise<"data:preview" | "cancel">((_resolve, reject) => {
          context?.signal?.addEventListener("abort", () => {
            reject(createAbortPromptError());
          });
        }),
    });

    stdin.emit("keypress", "\x1b", { name: "escape" });

    await expect(prompt).resolves.toBe("cancel");
  });

  test("returns the exit value when q aborts the submenu command menu", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    const prompt = selectInteractiveMenuChoice({
      message: "Choose a data command",
      choices: [
        { name: "preview", value: "data:preview" },
        { name: "cancel", value: "cancel" },
      ] as const,
      exitValue: "cancel",
      input: stdin as unknown as NodeJS.ReadStream,
      output: stdout as unknown as NodeJS.WritableStream,
      selectImpl: async (_options, context) =>
        await new Promise<"data:preview" | "cancel">((_resolve, reject) => {
          context?.signal?.addEventListener("abort", () => {
            reject(createAbortPromptError());
          });
        }),
    });

    stdin.emit("keypress", "q", { name: "q" });

    await expect(prompt).resolves.toBe("cancel");
  });
});
