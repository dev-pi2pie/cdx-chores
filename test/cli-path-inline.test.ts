import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";

import { promptPathInlineGhost } from "../src/cli/prompts/path-inline";
import { createTempFixtureDir } from "./helpers/cli-test-utils";
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

async function createPromptHarness(options?: {
  fixtureName?: string;
  columns?: number;
  setup?: (fixtureDir: string) => Promise<void>;
  resolveSuggestions?: Parameters<typeof promptPathInlineGhost>[0]["resolveSuggestions"];
}): Promise<{
  fixtureDir: string;
  stdin: FakePromptReadStream;
  stdout: FakePromptWriteStream;
  prompt: ReturnType<typeof promptPathInlineGhost>;
}> {
  const fixtureDir = await createTempFixtureDir(options?.fixtureName ?? "path-inline");
  if (options?.setup) {
    await options.setup(fixtureDir);
  }

  const stdin = new FakePromptReadStream();
  const stdout = new FakePromptWriteStream();
  stdout.columns = options?.columns ?? 80;
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
    resolveSuggestions: options?.resolveSuggestions,
  });

  await nextRenderTick();

  return { fixtureDir, stdin, stdout, prompt };
}

describe("path inline prompt controller", () => {
  test("promptPathInlineGhost renders a dimmed ghost suffix for the best completion", async () => {
    const { fixtureDir, stdin, stdout, prompt } = await createPromptHarness({
      setup: async (dir) => {
        await mkdir(join(dir, "docs"), { recursive: true });
      },
    });
    try {
      stdin.emit("keypress", ".", { name: "." });
      stdin.emit("keypress", "/", { name: "/" });
      stdin.emit("keypress", "d", { name: "d" });
      await nextRenderTick();
      await nextRenderTick();

      expect(stdout.text).toContain("Path ./d");
      expect(stdout.text).toContain("\x1b[2mocs/\x1b[22m");

      stdin.emit("keypress", "\r", { name: "return" });
      await expect(prompt).resolves.toBe("./d");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("promptPathInlineGhost accepts typed input, submits it, and restores the raw session", async () => {
    const { fixtureDir, stdin, stdout, prompt } = await createPromptHarness();
    try {
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

  test("promptPathInlineGhost treats q as literal input after existing text", async () => {
    const { fixtureDir, stdin, stdout, prompt } = await createPromptHarness();
    try {
      stdin.emit("keypress", "a", { name: "a" });
      stdin.emit("keypress", "q", { name: "q" });
      stdin.emit("keypress", "\r", { name: "return" });

      await expect(prompt).resolves.toBe("aq");
      expect(stdout.text).toContain("Path aq");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("promptPathInlineGhost accepts ghost text from a direct right-arrow key event", async () => {
    const { fixtureDir, stdin, stdout, prompt } = await createPromptHarness({
      setup: async (dir) => {
        const docsDir = join(dir, "docs");
        await mkdir(docsDir, { recursive: true });
        await writeFile(join(docsDir, "guide.md"), "# guide\n", "utf8");
      },
    });
    try {
      stdin.emit("keypress", ".", { name: "." });
      stdin.emit("keypress", "/", { name: "/" });
      stdin.emit("keypress", "d", { name: "d" });
      await nextRenderTick();
      await nextRenderTick();
      stdin.emit("keypress", "", { name: "right" });
      stdin.emit("keypress", "\r", { name: "return" });

      await expect(prompt).resolves.toBe("./docs/");
      expect(stdout.text).toContain("Path ./docs/");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("promptPathInlineGhost keeps Tab completion and cycling behavior", async () => {
    const { fixtureDir, stdin, stdout, prompt } = await createPromptHarness({
      setup: async (dir) => {
        await mkdir(join(dir, "docs"), { recursive: true });
        await mkdir(join(dir, "downloads"), { recursive: true });
      },
    });
    try {
      stdin.emit("keypress", ".", { name: "." });
      stdin.emit("keypress", "/", { name: "/" });
      stdin.emit("keypress", "d", { name: "d" });
      await nextRenderTick();
      stdin.emit("keypress", "\t", { name: "tab" });
      await nextRenderTick();
      stdin.emit("keypress", "\t", { name: "tab" });
      await nextRenderTick();
      stdin.emit("keypress", "\r", { name: "return" });

      await expect(prompt).resolves.toBe("./downloads/");
      expect(stdout.text).toContain("Path ./downloads/");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("promptPathInlineGhost left arrow moves to the parent segment", async () => {
    const { fixtureDir, stdin, prompt } = await createPromptHarness();
    try {
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
    const { fixtureDir, stdin, stdout, prompt } = await createPromptHarness({
      setup: async (dir) => {
        await mkdir(join(dir, "docs"), { recursive: true });
        await mkdir(join(dir, "downloads"), { recursive: true });
      },
    });
    try {
      stdin.emit("keypress", ".", { name: "." });
      stdin.emit("keypress", "/", { name: "/" });
      stdin.emit("keypress", "d", { name: "d" });
      await nextRenderTick();
      stdin.emit("keypress", "", { name: "up" });
      await nextRenderTick();
      stdin.emit("keypress", "", { name: "right" });
      await nextRenderTick();
      stdin.emit("keypress", "\r", { name: "return" });

      await expect(prompt).resolves.toBe("./downloads/");
      expect(stdout.text).toContain("Path ./downloads/");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("promptPathInlineGhost rejects on Esc and restores the raw session", async () => {
    const { fixtureDir, stdin, stdout, prompt } = await createPromptHarness();
    try {
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

  test("promptPathInlineGhost clears wrapped rows on Esc in a narrow terminal", async () => {
    const { fixtureDir, stdin, stdout, prompt } = await createPromptHarness({
      columns: 20,
    });
    const longInput = "./multi-folder-sample/reports/2026/03/Field Report 2026-03-05.csv";

    try {
      for (const character of longInput) {
        stdin.emit("keypress", character, { name: character });
      }
      await nextRenderTick();
      stdin.emit("keypress", "\x1b", { name: "escape" });

      await expect(prompt).rejects.toMatchObject({
        name: "ExitPromptError",
        message: "User aborted prompt",
      });

      const terminal = new VirtualTerminal(stdout.columns);
      terminal.write(stdout.text);

      expect(terminal.getVisibleLines()).toEqual([]);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("promptPathInlineGhost does not repaint after settling when a late async suggestion resolves", async () => {
    let releaseSuggestions: (() => void) | undefined;
    const { fixtureDir, stdin, stdout, prompt } = await createPromptHarness({
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
    try {
      stdin.emit("keypress", "a", { name: "a" });
      stdin.emit("keypress", "\r", { name: "return" });

      await expect(prompt).resolves.toBe("a");
      const outputAfterSettle = stdout.text;

      releaseSuggestions?.();
      await nextRenderTick();
      await nextRenderTick();

      expect(stdout.text).toBe(outputAfterSettle);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("promptPathInlineGhost clears wrapped rows before submitting in a narrow terminal", async () => {
    const { fixtureDir, stdin, stdout, prompt } = await createPromptHarness({
      columns: 20,
    });
    const longInput = "./multi-folder-sample/reports/2026/03/Field Report 2026-03-05.csv";
    const submitted = "./multi-folder";

    try {
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

      expect(terminal.getVisibleLines()).toEqual(wrapAscii(`Path ${submitted}`, stdout.columns));
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("promptPathInlineGhost accepts a wrapped ghost completion and clears rows on submit", async () => {
    const fullPath = "./multi-folder-sample/reports/2026/03/Field Report 2026-03-05.csv";
    const typedPrefix = "./multi-folder-sample/reports/2026/03/Field Rep";
    const { fixtureDir, stdin, stdout, prompt } = await createPromptHarness({
      columns: 20,
      setup: async (dir) => {
        const targetDir = join(dir, "multi-folder-sample", "reports", "2026", "03");
        await mkdir(targetDir, { recursive: true });
        await writeFile(join(targetDir, "Field Report 2026-03-05.csv"), "id,name\n1,Ada\n", "utf8");
      },
    });

    try {
      for (const character of typedPrefix) {
        stdin.emit("keypress", character, { name: character });
      }
      await nextRenderTick();
      stdin.emit("keypress", "", { name: "right" });
      await nextRenderTick();
      stdin.emit("keypress", "\r", { name: "return" });

      await expect(prompt).resolves.toBe(fullPath);

      const terminal = new VirtualTerminal(stdout.columns);
      terminal.write(stdout.text);

      expect(terminal.getVisibleLines()).toEqual(wrapAscii(`Path ${fullPath}`, stdout.columns));
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
