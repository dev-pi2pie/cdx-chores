import { Command } from "commander";
import { test, expect } from "bun:test";

import { registerMarkdownCommands } from "../../../src/cli/commands/markdown";
import { createCapturedRuntime } from "../../helpers/cli-test-utils";

test("md pdf-profile codex command forwards positional input and repeated font hints", async () => {
  const calls: unknown[] = [];
  const actionStubs = {
    actionMdFrontmatterToJson: async () => {},
    actionMdPdfProjectCodex: async () => {},
    actionMdPdfProfileCodex: async (_runtime: unknown, options: unknown) => {
      calls.push(options);
    },
    actionMdPdfProfileInit: async () => {},
    actionMdPdfTemplateCodex: async () => {},
    actionMdPdfTemplateInit: async () => {},
    actionMdToDocx: async () => {},
    actionMdToPdf: async () => {},
  };

  const program = new Command();
  program.exitOverride();
  registerMarkdownCommands(program, createCapturedRuntime().runtime, actionStubs);

  await program.parseAsync([
    "node",
    "test",
    "md",
    "pdf-profile",
    "codex",
    "report.md",
    "--font-hint",
    "   ",
    "--font-hint",
    "prefer Noto Serif CJK TC",
    "--output",
    "profile.yml",
  ]);

  expect(calls).toEqual([
    {
      codexExecution: { reasoningEffort: "low" },
      dryRun: false,
      fontHint: ["   ", "prefer Noto Serif CJK TC"],
      keepCodexReport: false,
      output: "profile.yml",
      overwrite: false,
      positionalInput: "report.md",
    },
  ]);
});
