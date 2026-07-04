import { Command } from "commander";
import { expect, test } from "bun:test";

import { registerMarkdownCommands } from "../src/cli/commands/markdown";
import { createCapturedRuntime } from "./helpers/cli-test-utils";

test("md pdf-project codex command forwards positional input and project options", async () => {
  const calls: unknown[] = [];
  const actionStubs = {
    actionMdFrontmatterToJson: async () => {},
    actionMdPdfProjectCodex: async (_runtime: unknown, options: unknown) => {
      calls.push(options);
    },
    actionMdPdfProfileCodex: async () => {},
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
    "pdf-project",
    "codex",
    "report.md",
    "--intent",
    "client report",
    "--font-hint",
    "   ",
    "--font-hint",
    "prefer Noto Serif CJK TC",
    "--base-profile",
    "base-profile.yml",
    "--cover-image",
    "cover.png",
    "--output",
    "pdf-project",
    "--keep-codex-report",
    "--overwrite",
  ]);

  expect(calls).toEqual([
    {
      baseProfile: "base-profile.yml",
      coverImage: "cover.png",
      dryRun: false,
      fontHint: ["   ", "prefer Noto Serif CJK TC"],
      intent: "client report",
      keepCodexReport: true,
      output: "pdf-project",
      overwrite: true,
      positionalInput: "report.md",
    },
  ]);
});
