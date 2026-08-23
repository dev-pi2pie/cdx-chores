import { describe, expect, test } from "bun:test";
import { Command } from "commander";

import { registerMarkdownCommands } from "../src/cli/commands/markdown";
import { createCapturedRuntime, runCli } from "./helpers/cli-test-utils";

type MarkdownCodexCommand = "pdf-profile" | "pdf-project" | "pdf-template";

interface MarkdownCodexTimeoutHarness {
  calls: Record<MarkdownCodexCommand, Array<{ codexTimeout?: number; timeoutMs?: number }>>;
  parse: (args: string[]) => Promise<unknown>;
  stderr: { text: string };
}

function createMarkdownCodexTimeoutHarness(): MarkdownCodexTimeoutHarness {
  const { runtime, stderr, stdout } = createCapturedRuntime({ colorEnabled: false });
  const calls: MarkdownCodexTimeoutHarness["calls"] = {
    "pdf-profile": [],
    "pdf-project": [],
    "pdf-template": [],
  };
  const program = new Command();
  program
    .name("cdx-chores")
    .showHelpAfterError()
    .exitOverride()
    .configureOutput({
      writeOut: (value) => stdout.write(value),
      writeErr: (value) => stderr.write(value),
    });
  registerMarkdownCommands(program, runtime, {
    actionMdFrontmatterToJson: async () => {},
    actionMdPdfProjectCodex: async (_runtime, options) => {
      calls["pdf-project"].push(options);
    },
    actionMdPdfProfileCodex: async (_runtime, options) => {
      calls["pdf-profile"].push(options);
    },
    actionMdPdfProfileInit: async () => {},
    actionMdPdfTemplateCodex: async (_runtime, options) => {
      calls["pdf-template"].push(options);
    },
    actionMdPdfTemplateInit: async () => {},
    actionMdToDocx: async () => {},
    actionMdToPdf: async () => {},
  });

  return {
    calls,
    parse: (args) => program.parseAsync(["node", "test", ...args]),
    stderr,
  };
}

async function expectParseFailure(
  harness: MarkdownCodexTimeoutHarness,
  args: string[],
): Promise<void> {
  try {
    await harness.parse(args);
  } catch (error) {
    expect(error).toHaveProperty("exitCode", 1);
    return;
  }
  throw new Error("Expected Commander parsing to fail");
}

describe("Markdown Codex timeout command routing", () => {
  test.each(["pdf-profile", "pdf-template", "pdf-project"] as const)(
    "normalizes and forwards the timeout for md %s codex",
    async (command) => {
      const harness = createMarkdownCodexTimeoutHarness();

      await harness.parse(["md", command, "codex", "--codex-timeout", "2m"]);

      expect(harness.calls[command]).toHaveLength(1);
      expect(harness.calls[command][0]).toMatchObject({ timeoutMs: 120_000 });
      expect(harness.calls[command][0]?.codexTimeout).toBeUndefined();
    },
  );

  test.each(["pdf-profile", "pdf-template", "pdf-project"] as const)(
    "keeps the action timeout unset when md %s codex omits the option",
    async (command) => {
      const harness = createMarkdownCodexTimeoutHarness();

      await harness.parse(["md", command, "codex"]);

      expect(harness.calls[command]).toHaveLength(1);
      expect(harness.calls[command][0]?.timeoutMs).toBeUndefined();
    },
  );
});

describe("Markdown Codex timeout validation", () => {
  test.each(["pdf-profile", "pdf-template", "pdf-project"] as const)(
    "rejects an invalid duration before invoking md %s codex",
    async (command) => {
      const harness = createMarkdownCodexTimeoutHarness();

      await expectParseFailure(harness, ["md", command, "codex", "--codex-timeout", "11m"]);

      expect(harness.calls[command]).toEqual([]);
      expect(harness.stderr.text).toContain(
        "--codex-timeout must be a positive integer duration using ms, s, or m",
      );
    },
  );

  test.each(["pdf-profile", "pdf-template", "pdf-project"] as const)(
    "rejects a repeated duration before invoking md %s codex",
    async (command) => {
      const harness = createMarkdownCodexTimeoutHarness();

      await expectParseFailure(harness, [
        "md",
        command,
        "codex",
        "--codex-timeout",
        "30s",
        "--codex-timeout",
        "45s",
      ]);

      expect(harness.calls[command]).toEqual([]);
      expect(harness.stderr.text).toContain("--codex-timeout may only be specified once");
    },
  );
});

describe("Markdown Codex timeout help", () => {
  test.each(["pdf-profile", "pdf-template", "pdf-project"] as const)(
    "documents the per-attempt option for md %s codex",
    (command) => {
      const result = runCli(["md", command, "codex", "--help"]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toMatch(
        /--codex-timeout <duration>\s+Codex request timeout per attempt/u,
      );
    },
  );
});
