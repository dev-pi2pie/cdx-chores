import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";

import { promptPathInlineGhost } from "../src/cli/prompts/path-inline";
import { createTempFixtureDir } from "./helpers/cli-test-utils";

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

describe("path inline prompt controller", () => {
  test("promptPathInlineGhost renders a dimmed ghost suffix for the best completion", async () => {
    const fixtureDir = await createTempFixtureDir("path-inline");
    try {
      const docsDir = join(fixtureDir, "docs");
      await mkdir(docsDir, { recursive: true });

      const stdin = new FakePromptReadStream();
      const stdout = new FakePromptWriteStream();

      const prompt = promptPathInlineGhost({
        message: "Path",
        cwd: fixtureDir,
        runtimeConfig: {
          mode: "auto",
          autocomplete: {
            enabled: true,
            minChars: 1,
            maxSuggestions: 12,
            includeHidden: false,
          },
        },
        stdin: stdin as unknown as NodeJS.ReadStream,
        stdout: stdout as unknown as NodeJS.WritableStream,
        validate: (value) => (value.trim().length > 0 ? true : "Required"),
        suggestionFilter: { targetKind: "any" },
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
      stdin.emit("keypress", ".", { name: "." });
      stdin.emit("keypress", "/", { name: "/" });
      stdin.emit("keypress", "d", { name: "d" });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(stdout.text).toContain("Path ./d");
      expect(stdout.text).toContain("\x1b[2mocs/\x1b[22m");

      stdin.emit("keypress", "\r", { name: "return" });
      await expect(prompt).resolves.toBe("./d");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("promptPathInlineGhost accepts typed input, submits it, and restores the raw session", async () => {
    const fixtureDir = await createTempFixtureDir("path-inline");
    try {
      const stdin = new FakePromptReadStream();
      const stdout = new FakePromptWriteStream();

      const prompt = promptPathInlineGhost({
        message: "Path",
        cwd: fixtureDir,
        runtimeConfig: {
          mode: "auto",
          autocomplete: {
            enabled: true,
            minChars: 1,
            maxSuggestions: 12,
            includeHidden: false,
          },
        },
        stdin: stdin as unknown as NodeJS.ReadStream,
        stdout: stdout as unknown as NodeJS.WritableStream,
        validate: (value) => (value.trim().length > 0 ? true : "Required"),
        suggestionFilter: { targetKind: "any" },
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      stdin.emit("keypress", "a", { name: "a" });
      stdin.emit("keypress", "\r", { name: "return" });

      await expect(prompt).resolves.toBe("a");

      expect(stdin.resumeCalls).toBe(1);
      expect(stdin.pauseCalls).toBe(1);
      expect(stdin.rawModeCalls).toEqual([true, false]);
      expect(stdout.text).toContain("Path a");
      expect(stdout.text).toContain("\x1b[?25l");
      expect(stdout.text).toContain("\x1b[?25h");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("promptPathInlineGhost accepts ghost text from a direct right-arrow key event", async () => {
    const fixtureDir = await createTempFixtureDir("path-inline");
    try {
      const docsDir = join(fixtureDir, "docs");
      await mkdir(docsDir, { recursive: true });
      await writeFile(join(docsDir, "guide.md"), "# guide\n", "utf8");

      const stdin = new FakePromptReadStream();
      const stdout = new FakePromptWriteStream();

      const prompt = promptPathInlineGhost({
        message: "Path",
        cwd: fixtureDir,
        runtimeConfig: {
          mode: "auto",
          autocomplete: {
            enabled: true,
            minChars: 1,
            maxSuggestions: 12,
            includeHidden: false,
          },
        },
        stdin: stdin as unknown as NodeJS.ReadStream,
        stdout: stdout as unknown as NodeJS.WritableStream,
        validate: (value) => (value.trim().length > 0 ? true : "Required"),
        suggestionFilter: { targetKind: "any" },
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      stdin.emit("keypress", ".", { name: "." });
      stdin.emit("keypress", "/", { name: "/" });
      stdin.emit("keypress", "d", { name: "d" });
      await new Promise((resolve) => setTimeout(resolve, 0));
      stdin.emit("keypress", "", { name: "right" });
      stdin.emit("keypress", "\r", { name: "return" });

      await expect(prompt).resolves.toBe("./docs/");
      expect(stdout.text).toContain("Path ./docs/");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("promptPathInlineGhost keeps Tab completion and cycling behavior", async () => {
    const fixtureDir = await createTempFixtureDir("path-inline");
    try {
      await mkdir(join(fixtureDir, "docs"), { recursive: true });
      await mkdir(join(fixtureDir, "downloads"), { recursive: true });

      const stdin = new FakePromptReadStream();
      const stdout = new FakePromptWriteStream();

      const prompt = promptPathInlineGhost({
        message: "Path",
        cwd: fixtureDir,
        runtimeConfig: {
          mode: "auto",
          autocomplete: {
            enabled: true,
            minChars: 1,
            maxSuggestions: 12,
            includeHidden: false,
          },
        },
        stdin: stdin as unknown as NodeJS.ReadStream,
        stdout: stdout as unknown as NodeJS.WritableStream,
        validate: (value) => (value.trim().length > 0 ? true : "Required"),
        suggestionFilter: { targetKind: "any" },
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
      stdin.emit("keypress", ".", { name: "." });
      stdin.emit("keypress", "/", { name: "/" });
      stdin.emit("keypress", "d", { name: "d" });
      await new Promise((resolve) => setTimeout(resolve, 0));
      stdin.emit("keypress", "\t", { name: "tab" });
      await new Promise((resolve) => setTimeout(resolve, 0));
      stdin.emit("keypress", "\t", { name: "tab" });
      await new Promise((resolve) => setTimeout(resolve, 0));
      stdin.emit("keypress", "\r", { name: "return" });

      await expect(prompt).resolves.toBe("./downloads/");
      expect(stdout.text).toContain("Path ./downloads/");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("promptPathInlineGhost left arrow moves to the parent segment", async () => {
    const fixtureDir = await createTempFixtureDir("path-inline");
    try {
      const stdin = new FakePromptReadStream();
      const stdout = new FakePromptWriteStream();

      const prompt = promptPathInlineGhost({
        message: "Path",
        cwd: fixtureDir,
        runtimeConfig: {
          mode: "auto",
          autocomplete: {
            enabled: true,
            minChars: 1,
            maxSuggestions: 12,
            includeHidden: false,
          },
        },
        stdin: stdin as unknown as NodeJS.ReadStream,
        stdout: stdout as unknown as NodeJS.WritableStream,
        validate: (value) => (value.trim().length > 0 ? true : "Required"),
        suggestionFilter: { targetKind: "any" },
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
      for (const [str, name] of [
        [".", "."],
        ["/", "/"],
        ["d", "d"],
        ["o", "o"],
        ["c", "c"],
        ["s", "s"],
        ["/", "/"],
        ["g", "g"],
      ] as const) {
        stdin.emit("keypress", str, { name });
      }
      stdin.emit("keypress", "", { name: "left" });
      stdin.emit("keypress", "\r", { name: "return" });

      await expect(prompt).resolves.toBe("./docs/");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("promptPathInlineGhost supports sibling preview with arrow navigation", async () => {
    const fixtureDir = await createTempFixtureDir("path-inline");
    try {
      await mkdir(join(fixtureDir, "docs"), { recursive: true });
      await mkdir(join(fixtureDir, "downloads"), { recursive: true });

      const stdin = new FakePromptReadStream();
      const stdout = new FakePromptWriteStream();

      const prompt = promptPathInlineGhost({
        message: "Path",
        cwd: fixtureDir,
        runtimeConfig: {
          mode: "auto",
          autocomplete: {
            enabled: true,
            minChars: 1,
            maxSuggestions: 12,
            includeHidden: false,
          },
        },
        stdin: stdin as unknown as NodeJS.ReadStream,
        stdout: stdout as unknown as NodeJS.WritableStream,
        validate: (value) => (value.trim().length > 0 ? true : "Required"),
        suggestionFilter: { targetKind: "any" },
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
      stdin.emit("keypress", ".", { name: "." });
      stdin.emit("keypress", "/", { name: "/" });
      stdin.emit("keypress", "d", { name: "d" });
      await new Promise((resolve) => setTimeout(resolve, 0));
      stdin.emit("keypress", "", { name: "up" });
      await new Promise((resolve) => setTimeout(resolve, 0));
      stdin.emit("keypress", "", { name: "right" });
      await new Promise((resolve) => setTimeout(resolve, 0));
      stdin.emit("keypress", "\r", { name: "return" });

      await expect(prompt).resolves.toBe("./downloads/");
      expect(stdout.text).toContain("Path ./downloads/");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("promptPathInlineGhost supports Backspace, Ctrl+U, and Enter", async () => {
    const fixtureDir = await createTempFixtureDir("path-inline");
    try {
      const stdin = new FakePromptReadStream();
      const stdout = new FakePromptWriteStream();

      const prompt = promptPathInlineGhost({
        message: "Path",
        cwd: fixtureDir,
        runtimeConfig: {
          mode: "auto",
          autocomplete: {
            enabled: true,
            minChars: 1,
            maxSuggestions: 12,
            includeHidden: false,
          },
        },
        stdin: stdin as unknown as NodeJS.ReadStream,
        stdout: stdout as unknown as NodeJS.WritableStream,
        validate: (value) => (value.trim().length > 0 ? true : "Required"),
        suggestionFilter: { targetKind: "any" },
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
      stdin.emit("keypress", "a", { name: "a" });
      stdin.emit("keypress", "b", { name: "b" });
      stdin.emit("keypress", "\b", { name: "backspace" });
      stdin.emit("keypress", "", { name: "u", ctrl: true });
      stdin.emit("keypress", "c", { name: "c" });
      stdin.emit("keypress", "\r", { name: "return" });

      await expect(prompt).resolves.toBe("c");
      expect(stdout.text).toContain("Path c");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("promptPathInlineGhost rejects on Esc and restores the raw session", async () => {
    const fixtureDir = await createTempFixtureDir("path-inline");
    try {
      const stdin = new FakePromptReadStream();
      const stdout = new FakePromptWriteStream();

      const prompt = promptPathInlineGhost({
        message: "Path",
        cwd: fixtureDir,
        runtimeConfig: {
          mode: "auto",
          autocomplete: {
            enabled: true,
            minChars: 1,
            maxSuggestions: 12,
            includeHidden: false,
          },
        },
        stdin: stdin as unknown as NodeJS.ReadStream,
        stdout: stdout as unknown as NodeJS.WritableStream,
        validate: (value) => (value.trim().length > 0 ? true : "Required"),
        suggestionFilter: { targetKind: "any" },
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
      stdin.emit("keypress", "\x1b", { name: "escape" });

      await expect(prompt).rejects.toMatchObject({
        name: "ExitPromptError",
        message: "User aborted prompt",
      });
      expect(stdin.rawModeCalls).toEqual([true, false]);
      expect(stdout.text).toContain("\x1b[?25h");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("promptPathInlineGhost does not repaint after settling when a late async suggestion resolves", async () => {
    const fixtureDir = await createTempFixtureDir("path-inline");
    try {
      const stdin = new FakePromptReadStream();
      const stdout = new FakePromptWriteStream();
      let releaseSuggestions: (() => void) | undefined;

      const prompt = promptPathInlineGhost({
        message: "Path",
        cwd: fixtureDir,
        runtimeConfig: {
          mode: "auto",
          autocomplete: {
            enabled: true,
            minChars: 1,
            maxSuggestions: 12,
            includeHidden: false,
          },
        },
        stdin: stdin as unknown as NodeJS.ReadStream,
        stdout: stdout as unknown as NodeJS.WritableStream,
        validate: (value) => (value.trim().length > 0 ? true : "Required"),
        suggestionFilter: { targetKind: "any" },
        resolveSuggestions: async (options) => {
          if (options.input !== "a") {
            return [];
          }

          await new Promise<void>((resolve) => {
            releaseSuggestions = resolve;
          });
          return [];
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      stdin.emit("keypress", "a", { name: "a" });
      stdin.emit("keypress", "\r", { name: "return" });

      await expect(prompt).resolves.toBe("a");
      const outputAfterSettle = stdout.text;

      releaseSuggestions?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(stdout.text).toBe(outputAfterSettle);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
