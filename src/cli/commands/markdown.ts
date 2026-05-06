import type { Command } from "commander";

import {
  actionMdFrontmatterToJson,
  actionMdPdfTemplateInit,
  actionMdToDocx,
  actionMdToPdf,
} from "../actions";
import { applyCommonFileOptions } from "../options/common";
import { parsePositiveIntegerOption } from "../options/parsers";
import type { CliRuntime } from "../types";

interface MarkdownPdfRecipeCliOptions {
  preset?: string;
  pageSize?: string;
  orientation?: string;
  margin?: string;
  marginX?: string;
  marginY?: string;
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  toc?: boolean;
  tocDepth?: number;
  tocPageBreak?: string;
}

interface MarkdownPdfCliOptions extends MarkdownPdfRecipeCliOptions {
  input: string;
  output?: string;
  overwrite?: boolean;
  template?: string;
  css?: string;
  noDefaultCss?: boolean;
  defaultCss?: boolean;
  htmlOutput?: string;
  allowRemoteAssets?: boolean;
}

interface MarkdownPdfTemplateInitCliOptions extends MarkdownPdfRecipeCliOptions {
  output: string;
  overwrite?: boolean;
}

function applyMarkdownPdfRecipeOptions(command: Command): Command {
  return command
    .option("--preset <value>", "PDF recipe preset (article, report, wide-table, compact, reader)")
    .option("--page-size <value>", "PDF page size (A3, A4, A5, Letter, Legal, Tabloid)")
    .option("--orientation <value>", "PDF page orientation (portrait, landscape)")
    .option("--margin <length>", "Set all page margins")
    .option("--margin-x <length>", "Set left and right page margins")
    .option("--margin-y <length>", "Set top and bottom page margins")
    .option("--margin-top <length>", "Set top page margin")
    .option("--margin-right <length>", "Set right page margin")
    .option("--margin-bottom <length>", "Set bottom page margin")
    .option("--margin-left <length>", "Set left page margin")
    .option("--toc", "Generate a table of contents", false)
    .option("--toc-depth <n>", "Table of contents depth", (value) =>
      parsePositiveIntegerOption(value, "--toc-depth"),
    )
    .option(
      "--toc-page-break <value>",
      "ToC page-break behavior (auto, none, before, after, both)",
    );
}

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

  applyMarkdownPdfRecipeOptions(
    applyCommonFileOptions(
      mdCommand
        .command("to-pdf")
        .description("Convert Markdown to PDF using Pandoc and WeasyPrint")
        .requiredOption("-i, --input <path>", "Input Markdown file")
        .option("--template <path>", "Custom Pandoc HTML template")
        .option("--css <path>", "Custom print stylesheet")
        .option("--no-default-css", "Do not apply the built-in default stylesheet")
        .option("--html-output <path>", "Write the intermediate rendered HTML")
        .option("--allow-remote-assets", "Allow http and https assets during PDF rendering", false)
        .action(async (options: MarkdownPdfCliOptions) => {
          await actionMdToPdf(runtime, {
            ...options,
            noDefaultCss: options.noDefaultCss ?? options.defaultCss === false,
          });
        }),
    ),
  );

  applyMarkdownPdfRecipeOptions(
    mdCommand
      .command("pdf-template")
      .description("Manage Markdown PDF templates")
      .command("init")
      .description("Write the default Markdown PDF template recipe")
      .requiredOption("-o, --output <path>", "Output template directory")
      .option("--overwrite", "Overwrite recipe files if they already exist", false)
      .action(async (options: MarkdownPdfTemplateInitCliOptions) => {
        await actionMdPdfTemplateInit(runtime, options);
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
