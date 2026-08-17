import { Command } from "commander";
import { expect, test } from "bun:test";

import { registerMarkdownCommands } from "../src/cli/commands/markdown";
import { createCapturedRuntime } from "./helpers/cli-test-utils";

async function captureMdToPdfOptions(args: string[]): Promise<Record<string, unknown>> {
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

  await program.parseAsync(["node", "test", "md", "to-pdf", ...args]);

  expect(calls).toHaveLength(1);
  return calls[0] as Record<string, unknown>;
}

test("md to-pdf command forwards the render bundle directory", async () => {
  const options = await captureMdToPdfOptions([
    "--input",
    "report.md",
    "--bundle",
    "report-project",
  ]);

  expect(options).toEqual({
    allowRemoteAssets: false,
    bundle: "report-project",
    defaultCss: true,
    input: "report.md",
    noDefaultCss: false,
    overwrite: false,
  });
});

test.each([
  { flag: undefined, expected: undefined, label: "omitted" },
  { flag: "--page-numbers", expected: true, label: "enabled" },
  { flag: "--no-page-numbers", expected: false, label: "disabled" },
])("preserves the $label page-number override", async ({ flag, expected }) => {
  const options = await captureMdToPdfOptions(["--input", "report.md", ...(flag ? [flag] : [])]);

  expect(options.pageNumbers).toBe(expected);
  expect(Object.hasOwn(options, "pageNumbers")).toBe(flag !== undefined);
});
