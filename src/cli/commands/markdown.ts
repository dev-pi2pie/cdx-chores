import type { Command } from "commander";

import {
  actionMdFrontmatterToJson,
  actionMdPdfProjectCodex,
  actionMdPdfProfileCodex,
  actionMdPdfProfileInit,
  actionMdPdfTemplateCodex,
  actionMdPdfTemplateInit,
  actionMdToDocx,
  actionMdToPdf,
} from "../actions";
import type { MdPdfProfileCodexCliOptions, MdPdfProjectCodexCliOptions } from "../actions/markdown";
import type { MdPdfTemplateCodexCliOptions } from "../actions/markdown/pdf-template-codex";
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
  bundle?: string;
  template?: string;
  css?: string;
  profile?: string;
  meta?: string[];
  noDefaultCss?: boolean;
  defaultCss?: boolean;
  htmlOutput?: string;
  allowRemoteAssets?: boolean;
  codeHighlight?: boolean;
  pageNumbers?: boolean;
}

interface MarkdownPdfTemplateInitCliOptions extends MarkdownPdfRecipeCliOptions {
  output: string;
  overwrite?: boolean;
}

interface MarkdownPdfProfileInitCliOptions extends MarkdownPdfRecipeCliOptions {
  output: string;
  overwrite?: boolean;
}

interface MarkdownCommandActions {
  actionMdFrontmatterToJson: typeof actionMdFrontmatterToJson;
  actionMdPdfProjectCodex: typeof actionMdPdfProjectCodex;
  actionMdPdfProfileCodex: typeof actionMdPdfProfileCodex;
  actionMdPdfProfileInit: typeof actionMdPdfProfileInit;
  actionMdPdfTemplateCodex: typeof actionMdPdfTemplateCodex;
  actionMdPdfTemplateInit: typeof actionMdPdfTemplateInit;
  actionMdToDocx: typeof actionMdToDocx;
  actionMdToPdf: typeof actionMdToPdf;
}

const defaultMarkdownCommandActions: MarkdownCommandActions = {
  actionMdFrontmatterToJson,
  actionMdPdfProjectCodex,
  actionMdPdfProfileCodex,
  actionMdPdfProfileInit,
  actionMdPdfTemplateCodex,
  actionMdPdfTemplateInit,
  actionMdToDocx,
  actionMdToPdf,
};

function collectStringOption(value: string, previous: string[] = []): string[] {
  return [...previous, value];
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
    .option("--toc", "Generate a table of contents")
    .option("--toc-depth <n>", "Table of contents depth", (value) =>
      parsePositiveIntegerOption(value, "--toc-depth"),
    )
    .option(
      "--toc-page-break <value>",
      "ToC page-break behavior (auto, none, before, after, both)",
    );
}

export function registerMarkdownCommands(
  program: Command,
  runtime: CliRuntime,
  actions: MarkdownCommandActions = defaultMarkdownCommandActions,
): void {
  const mdCommand = program.command("md").description("Markdown utilities");

  applyCommonFileOptions(
    mdCommand
      .command("to-docx")
      .description("Convert Markdown to DOCX using Pandoc")
      .requiredOption("-i, --input <path>", "Input Markdown file")
      .action(async (options: { input: string; output?: string; overwrite?: boolean }) => {
        await actions.actionMdToDocx(runtime, options);
      }),
  );

  applyMarkdownPdfRecipeOptions(
    applyCommonFileOptions(
      mdCommand
        .command("to-pdf")
        .description("Convert Markdown to PDF using Pandoc and WeasyPrint")
        .requiredOption("-i, --input <path>", "Input Markdown file")
        .option("--bundle <directory>", "Discover Markdown PDF render inputs from a directory")
        .option("--template <path>", "Custom Pandoc HTML template")
        .option("--css <path>", "Custom print stylesheet")
        .option("--profile <path>", "Markdown PDF profile file (.yml, .yaml, .json)")
        .option(
          "--meta <key=value>",
          "Metadata override for profile placeholders",
          collectStringOption,
        )
        .option("--no-default-css", "Do not apply the built-in default stylesheet")
        .option("--html-output <path>", "Write the intermediate rendered HTML")
        .option("--allow-remote-assets", "Allow non-local asset URLs during PDF rendering", false)
        .option("--code-highlight", "Enable Shiki code highlighting")
        .option("--no-code-highlight", "Disable Shiki code highlighting")
        .option("--page-numbers", "Enable Profile page numbers for this render")
        .option("--no-page-numbers", "Disable Profile page numbers for this render")
        .action(async (options: MarkdownPdfCliOptions) => {
          await actions.actionMdToPdf(runtime, {
            ...options,
            noDefaultCss: options.noDefaultCss ?? options.defaultCss === false,
          });
        }),
    ),
  );

  const pdfTemplateCommand = mdCommand
    .command("pdf-template")
    .description("Manage Markdown PDF templates");

  applyMarkdownPdfRecipeOptions(
    pdfTemplateCommand
      .command("init")
      .description("Write the default Markdown PDF template recipe")
      .requiredOption("-o, --output <path>", "Output template directory")
      .option("--overwrite", "Overwrite recipe files if they already exist", false)
      .action(async (options: MarkdownPdfTemplateInitCliOptions) => {
        await actions.actionMdPdfTemplateInit(runtime, options);
      }),
  );

  pdfTemplateCommand
    .command("codex")
    .argument("[input]", "Markdown sample for document-informed template signals")
    .description("Draft a reviewable Markdown PDF template bundle from bounded signals")
    .option("-i, --input <path>", "Same as the input argument; useful in scripts")
    .option("--intent <text>", "Template, layout, and design direction")
    .option(
      "--font-hint <text>",
      "Repeatable font preference hint for the same Codex request",
      collectStringOption,
    )
    .option("--base-profile <path>", "Existing Markdown PDF profile to use as a signal")
    .option("--cover-image <path>", "Local PNG, JPEG, or WebP cover image")
    .option("-o, --output <path>", "Output template bundle directory")
    .option(
      "--dry-run",
      "Preview signal collection, decision, synthesis, and validation without writing",
      false,
    )
    .option("--keep-codex-report", "Write a diagnostic Codex report sidecar", false)
    .option("--codex-report-output <path>", "Write the diagnostic Codex report to this JSON path")
    .option("--overwrite", "Overwrite selected generated files if they already exist", false)
    .action(async (input: string | undefined, options: MdPdfTemplateCodexCliOptions) => {
      await actions.actionMdPdfTemplateCodex(runtime, { ...options, positionalInput: input });
    });

  const pdfProfileCommand = mdCommand
    .command("pdf-profile")
    .description("Manage Markdown PDF profiles");

  applyMarkdownPdfRecipeOptions(
    pdfProfileCommand
      .command("init")
      .description("Write a Markdown PDF profile file")
      .requiredOption("-o, --output <path>", "Output profile file")
      .option("--overwrite", "Overwrite the profile file if it already exists", false)
      .action(async (options: MarkdownPdfProfileInitCliOptions) => {
        await actions.actionMdPdfProfileInit(runtime, options);
      }),
  );

  pdfProfileCommand
    .command("codex")
    .argument("[input]", "Markdown sample for document-informed profile signals")
    .description(
      "Draft a reusable Markdown PDF profile from sample signals, hints, or fallback defaults",
    )
    .option("-i, --input <path>", "Same as the input argument; useful in scripts")
    .option("--intent <text>", "Rendering direction for the reusable profile")
    .option(
      "--font-hint <text>",
      "Repeatable font preference hint for the same Codex request",
      collectStringOption,
    )
    .option("--base-profile <path>", "Existing Markdown PDF profile to refine")
    .option("-o, --output <path>", "Output profile file (.yml, .yaml, .json)")
    .option("--dry-run", "Preview the Codex profile decision without writing the profile", false)
    .option("--keep-codex-report", "Write a diagnostic Codex report sidecar", false)
    .option("--codex-report-output <path>", "Write the diagnostic Codex report to this JSON path")
    .option("--overwrite", "Overwrite selected output artifacts if they already exist", false)
    .action(async (input: string | undefined, options: MdPdfProfileCodexCliOptions) => {
      await actions.actionMdPdfProfileCodex(runtime, { ...options, positionalInput: input });
    });

  const pdfProjectCommand = mdCommand
    .command("pdf-project")
    .description("Manage Markdown PDF project bundles");

  pdfProjectCommand
    .command("codex")
    .argument("[input]", "Markdown sample for shared project signals")
    .description("Draft a coordinated Markdown PDF profile and template project bundle")
    .option("-i, --input <path>", "Same as the input argument; useful in scripts")
    .option("--intent <text>", "Project render, layout, and design direction")
    .option(
      "--font-hint <text>",
      "Repeatable font preference hint for the same project request",
      collectStringOption,
    )
    .option("--base-profile <path>", "Existing Markdown PDF profile to refine or target")
    .option("--cover-image <path>", "Local PNG, JPEG, or WebP cover image")
    .option("-o, --output <directory>", "Output project bundle directory")
    .option(
      "--dry-run",
      "Preview signal collection, phase decisions, synthesis, and validation without writing",
      false,
    )
    .option("--keep-codex-report", "Write a diagnostic project Codex report", false)
    .option("--codex-report-output <path>", "Write the diagnostic project report to this JSON path")
    .option("--overwrite", "Overwrite selected project-generated outputs if safe", false)
    .action(async (input: string | undefined, options: MdPdfProjectCodexCliOptions) => {
      await actions.actionMdPdfProjectCodex(runtime, { ...options, positionalInput: input });
    });

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
        await actions.actionMdFrontmatterToJson(runtime, options);
      },
    );
}
