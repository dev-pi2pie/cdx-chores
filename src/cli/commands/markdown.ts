import type { Command } from "commander";

import { actionMdFrontmatterToJson, actionMdToDocx } from "../actions";
import { applyCommonFileOptions } from "../options/common";
import type { CliRuntime } from "../types";

export function registerMarkdownCommands(program: Command, runtime: CliRuntime): void {
  const mdCommand = program.command("md").description("Markdown utilities");

  applyCommonFileOptions(
    mdCommand
      .command("to-docx")
      .description("Convert Markdown to DOCX using pandoc")
      .requiredOption("-i, --input <path>", "Input Markdown file")
      .action(async (options: { input: string; output?: string; overwrite?: boolean }) => {
        await actionMdToDocx(runtime, options);
      }),
  );

  mdCommand
    .command("frontmatter-to-json")
    .description("Extract Markdown frontmatter to JSON")
    .requiredOption("-i, --input <path>", "Input Markdown file")
    .option("-o, --output <path>", "Write JSON to file path (default: stdout)")
    .option("--overwrite", "Overwrite output file if it already exists", false)
    .option("--pretty", "Pretty-print JSON output", false)
    .option("--data-only", "Emit only the parsed frontmatter object", false)
    .action(
      async (options: {
        input: string;
        output?: string;
        overwrite?: boolean;
        pretty?: boolean;
        dataOnly?: boolean;
      }) => {
        await actionMdFrontmatterToJson(runtime, options);
      },
    );
}
