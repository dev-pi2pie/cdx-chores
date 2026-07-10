import { Command } from "commander";
import { expect, test } from "bun:test";

import { registerMarkdownCommands } from "../src/cli/commands/markdown";
import { createCapturedRuntime } from "./helpers/cli-test-utils";

test("md to-pdf command forwards the render bundle directory", async () => {
  const calls: unknown[] = [];
  const actionStubs = {
    actionMdFrontmatterToJson: async () => {},
    actionMdPdfProjectCodex: async () => {},
    actionMdPdfProfileCodex: async () => {},
    actionMdPdfProfileInit: async () => {},
    actionMdPdfTemplateCodex: async () => {},
    actionMdPdfTemplateInit: async () => {},
    actionMdToDocx: async () => {},
    actionMdToPdf: async (_runtime: unknown, options: unknown) => {
      calls.push(options);
    },
  };

  const program = new Command();
  program.exitOverride();
  registerMarkdownCommands(program, createCapturedRuntime().runtime, actionStubs);

  await program.parseAsync([
    "node",
    "test",
    "md",
    "to-pdf",
    "--input",
    "report.md",
    "--bundle",
    "report-project",
  ]);

  expect(calls).toEqual([
    {
      allowRemoteAssets: false,
      bundle: "report-project",
      defaultCss: true,
      input: "report.md",
      noDefaultCss: false,
      overwrite: false,
    },
  ]);
});
