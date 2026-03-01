import { Command, InvalidArgumentError } from "commander";
import {
  actionCsvToJson,
  actionDeferred,
  actionDoctor,
  actionJsonToCsv,
  actionMdFrontmatterToJson,
  actionMdToDocx,
  actionRenameApply,
  actionRenameBatch,
  actionRenameFile,
  actionVideoConvert,
  actionVideoGif,
  actionVideoResize,
} from "./cli/actions";
import { toCliError } from "./cli/errors";
import { runInteractiveMode } from "./cli/interactive";
import {
  DEFAULT_RENAME_SERIAL_ORDER,
  DEFAULT_RENAME_SERIAL_START,
  RENAME_SERIAL_ORDER_VALUES,
  RENAME_SERIAL_SCOPE_VALUES,
  type RenameSerialOrder,
  type RenameSerialScope,
} from "./cli/rename-template";
import { getFormattedVersionLabel } from "./cli/program/version";
import type { CliRuntime, RunCliOptions } from "./cli/types";

interface NormalizedCliArgv {
  argv: string[];
  displayPathStyle: CliRuntime["displayPathStyle"];
}

function createRuntime(options: RunCliOptions): CliRuntime {
  return {
    cwd: options.cwd ?? process.cwd(),
    now: options.now ?? (() => new Date()),
    platform: options.platform ?? process.platform,
    stdout: options.stdout ?? process.stdout,
    stderr: options.stderr ?? process.stderr,
    stdin: options.stdin ?? process.stdin,
    displayPathStyle: options.displayPathStyle ?? "relative",
  };
}

function applyCommonFileOptions(command: Command): void {
  command
    .option("-o, --output <path>", "Output file path")
    .option("--overwrite", "Overwrite output file if it already exists", false);
}

function collectCsvListOption(value: string, previous: string[] = []): string[] {
  const next = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return [...previous, ...next];
}

function parseNonNegativeIntegerOption(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new InvalidArgumentError(`${label} must be a non-negative integer.`);
  }
  return parsed;
}

function parsePositiveIntegerOption(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new InvalidArgumentError(`${label} must be a positive integer.`);
  }
  return parsed;
}

function parsePositiveNumberOption(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new InvalidArgumentError(`${label} must be a positive number.`);
  }
  return parsed;
}

function parseSerialOrderOption(value: string): RenameSerialOrder {
  if ((RENAME_SERIAL_ORDER_VALUES as readonly string[]).includes(value)) {
    return value as RenameSerialOrder;
  }
  throw new InvalidArgumentError(
    `--serial-order must be one of: ${RENAME_SERIAL_ORDER_VALUES.join(", ")}.`,
  );
}

function parseSerialScopeOption(value: string): RenameSerialScope {
  if ((RENAME_SERIAL_SCOPE_VALUES as readonly string[]).includes(value)) {
    return value as RenameSerialScope;
  }
  throw new InvalidArgumentError(
    `--serial-scope must be one of: ${RENAME_SERIAL_SCOPE_VALUES.join(", ")}.`,
  );
}

function applyRenameTemplateOptions(command: Command): void {
  command
    .option(
      "--pattern <template>",
      "Custom filename template (supports {prefix}, {timestamp}, {date}, {date_local}, {date_utc}, {stem}, {serial...})",
    )
    .option(
      "--serial-order <value>",
      `Serial ordering mode override (${RENAME_SERIAL_ORDER_VALUES.join(", ")}). mtime = modified time. Default when unspecified: ${DEFAULT_RENAME_SERIAL_ORDER}.`,
      parseSerialOrderOption,
    )
    .option(
      "--serial-start <value>",
      `Serial start value override (non-negative integer). Default when unspecified: ${DEFAULT_RENAME_SERIAL_START}.`,
      (value) => parseNonNegativeIntegerOption(value, "--serial-start"),
    )
    .option(
      "--serial-width <value>",
      "Minimum serial width in digits",
      (value) => parsePositiveIntegerOption(value, "--serial-width"),
    )
    .option(
      "--serial-scope <value>",
      `Serial scope mode override (${RENAME_SERIAL_SCOPE_VALUES.join(", ")}). Default when unspecified: global.`,
      parseSerialScopeOption,
    );
}

function normalizeCliArgv(argv: string[]): NormalizedCliArgv {
  const normalized = argv.slice(0, 2);
  let displayPathStyle: CliRuntime["displayPathStyle"] = "relative";

  for (const arg of argv.slice(2)) {
    if (arg === "--absolute" || arg === "--abs") {
      displayPathStyle = "absolute";
      continue;
    }

    if (arg === "-V") {
      normalized.push("-v");
      continue;
    }

    normalized.push(arg);
  }

  return { argv: normalized, displayPathStyle };
}

export async function runCli(
  argv: string[] = process.argv,
  runtime: RunCliOptions = {},
): Promise<void> {
  const normalized = normalizeCliArgv(argv);
  const cliRuntime = createRuntime(runtime);
  cliRuntime.displayPathStyle = runtime.displayPathStyle ?? normalized.displayPathStyle;
  const args = normalized.argv.slice(2);

  if (args.length === 0) {
    if (!cliRuntime.stdin.isTTY) {
      cliRuntime.stderr.write(
        "No arguments provided and interactive mode requires a TTY. Use --help for commands.\n",
      );
      process.exitCode = 2;
      return;
    }

    try {
      await runInteractiveMode(cliRuntime);
    } catch (error) {
      const cliError = toCliError(error);
      cliRuntime.stderr.write(`${cliError.message}\n`);
      process.exitCode = cliError.exitCode;
    }
    return;
  }

  const program = new Command();
  program
    .name("cdx-chores")
    .description("CLI chores toolkit for file/media/document workflow helpers")
    .showHelpAfterError()
    .option("--absolute, --abs", "Show absolute paths in CLI output", false)
    .version(getFormattedVersionLabel(), "-v, --version", "Show version information");

  program
    .command("interactive")
    .description("Start interactive mode")
    .action(async () => {
      await runInteractiveMode(cliRuntime);
    });

  program
    .command("doctor")
    .description("Check tool availability and current feature capabilities")
    .option("--json", "Output machine-readable JSON", false)
    .action(async (options: { json?: boolean }) => {
      await actionDoctor(cliRuntime, { json: options.json });
    });

  const dataCommand = program.command("data").description("Data conversion utilities");

  applyCommonFileOptions(
    dataCommand
      .command("json-to-csv")
      .description("Convert JSON file to CSV")
      .requiredOption("-i, --input <path>", "Input JSON file")
      .action(async (options: { input: string; output?: string; overwrite?: boolean }) => {
        await actionJsonToCsv(cliRuntime, options);
      }),
  );

  dataCommand
    .command("csv-to-json")
    .description("Convert CSV file to JSON")
    .requiredOption("-i, --input <path>", "Input CSV file")
    .option("-o, --output <path>", "Output JSON file path")
    .option("--overwrite", "Overwrite output file if it already exists", false)
    .option("--pretty", "Pretty-print JSON output", false)
    .action(
      async (options: {
        input: string;
        output?: string;
        overwrite?: boolean;
        pretty?: boolean;
      }) => {
        await actionCsvToJson(cliRuntime, options);
      },
    );

  const mdCommand = program.command("md").description("Markdown utilities");
  applyCommonFileOptions(
    mdCommand
      .command("to-docx")
      .description("Convert Markdown to DOCX using pandoc")
      .requiredOption("-i, --input <path>", "Input Markdown file")
      .action(async (options: { input: string; output?: string; overwrite?: boolean }) => {
        await actionMdToDocx(cliRuntime, options);
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
        await actionMdFrontmatterToJson(cliRuntime, options);
      },
    );

  const docxCommand = program.command("docx").description("DOCX utilities");
  docxCommand
    .command("to-pdf")
    .description("Convert DOCX to PDF (deferred)")
    .action(async () => {
      await actionDeferred(cliRuntime, "docx to-pdf");
    });

  const pdfCommand = program
    .command("pdf")
    .description("PDF utilities (deferred in initial phase)");
  for (const [name, description] of [
    ["to-images", "Convert PDF pages to images (deferred)"],
    ["from-images", "Build PDF from image sequence (deferred)"],
    ["merge", "Merge PDF files (deferred)"],
    ["split", "Split PDF file (deferred)"],
  ] as const) {
    pdfCommand
      .command(name)
      .description(description)
      .action(async () => {
        await actionDeferred(cliRuntime, `pdf ${name}`);
      });
  }

  const renameCommand = program.command("rename").description("Rename helpers");
  const renameFileCommand = renameCommand
    .command("file")
    .description("Rename a single file")
    .argument("<path>", "Target file path")
    .option("--prefix <value>", "Filename prefix (optional)")
    .option("--dry-run", "Preview rename plan only", false)
    .option(
      "--codex",
      "Auto-route eligible files to Codex analyzers by file type",
      false,
    )
    .option(
      "--codex-images",
      "Use only the Codex image analyzer for supported static image files",
      false,
    )
    .option(
      "--codex-images-timeout-ms <ms>",
      "Codex image-title generation timeout per request in milliseconds",
      (value) => Number(value),
    )
    .option("--codex-images-retries <count>", "Retry failed Codex image-title requests", (value) =>
      Number(value),
    )
    .option(
      "--codex-images-batch-size <count>",
      "Number of images per Codex image-title request batch",
      (value) => Number(value),
    )
    .option(
      "--codex-docs",
      "Use only the Codex document analyzer for supported docs (.md, .txt, .json, .yaml, .toml, .xml, .html, .pdf, ...)",
      false,
    )
    .option(
      "--codex-docs-timeout-ms <ms>",
      "Codex document-title generation timeout per request in milliseconds",
      (value) => Number(value),
    )
    .option("--codex-docs-retries <count>", "Retry failed Codex document-title requests", (value) =>
      Number(value),
    )
    .option(
      "--codex-docs-batch-size <count>",
      "Number of documents per Codex document-title request batch",
      (value) => Number(value),
    );
  applyRenameTemplateOptions(renameFileCommand);
  renameFileCommand.action(
      async (
        path: string,
        options: {
          prefix?: string;
          pattern?: string;
          serialOrder?: RenameSerialOrder;
          serialStart?: number;
          serialWidth?: number;
          serialScope?: RenameSerialScope;
          dryRun?: boolean;
          codex?: boolean;
          codexImages?: boolean;
          codexImagesTimeoutMs?: number;
          codexImagesRetries?: number;
          codexImagesBatchSize?: number;
          codexDocs?: boolean;
          codexDocsTimeoutMs?: number;
          codexDocsRetries?: number;
          codexDocsBatchSize?: number;
        },
      ) => {
        await actionRenameFile(cliRuntime, {
          path,
          prefix: options.prefix,
          pattern: options.pattern,
          serialOrder: options.serialOrder,
          serialStart: options.serialStart,
          serialWidth: options.serialWidth,
          serialScope: options.serialScope,
          dryRun: options.dryRun,
          codex: options.codex,
          codexImages: options.codexImages,
          codexImagesTimeoutMs: options.codexImagesTimeoutMs,
          codexImagesRetries: options.codexImagesRetries,
          codexImagesBatchSize: options.codexImagesBatchSize,
          codexDocs: options.codexDocs,
          codexDocsTimeoutMs: options.codexDocsTimeoutMs,
          codexDocsRetries: options.codexDocsRetries,
          codexDocsBatchSize: options.codexDocsBatchSize,
        });
      },
    );

  const renameBatchCommand = renameCommand
    .command("batch")
    .description("Batch rename files in a directory")
    .argument("<directory>", "Target directory")
    .option("--prefix <value>", "Filename prefix (optional)")
    .option("--profile <name>", "Preset file profile: all, images, media, docs")
    .option("--dry-run", "Preview rename plan only", false)
    .option("--preview-skips <mode>", "Skipped-item preview mode: summary or detailed")
    .option("--recursive", "Traverse subdirectories recursively", false)
    .option("--max-depth <value>", "Maximum recursive depth (root=0)", (value) => Number(value))
    .option("--match-regex <pattern>", "Only include files whose basename matches the regex")
    .option("--skip-regex <pattern>", "Exclude files whose basename matches the regex")
    .option(
      "--ext <value>",
      "Only include file extensions (repeatable or comma-separated)",
      collectCsvListOption,
      [],
    )
    .option(
      "--skip-ext <value>",
      "Exclude file extensions (repeatable or comma-separated)",
      collectCsvListOption,
      [],
    )
    .option(
      "--codex",
      "Auto-route eligible files to Codex analyzers by file type",
      false,
    )
    .option(
      "--codex-images",
      "Use only the Codex image analyzer for supported static image files",
      false,
    )
    .option(
      "--codex-images-timeout-ms <ms>",
      "Codex image-title generation timeout per request in milliseconds",
      (value) => Number(value),
    )
    .option(
      "--codex-images-retries <count>",
      "Retry failed Codex image-title requests (per batch)",
      (value) => Number(value),
    )
    .option(
      "--codex-images-batch-size <count>",
      "Number of images per Codex image-title request batch",
      (value) => Number(value),
    )
    .option(
      "--codex-docs",
      "Use only the Codex document analyzer for supported docs (.md, .txt, .json, .yaml, .toml, .xml, .html, .pdf, ...)",
      false,
    )
    .option(
      "--codex-docs-timeout-ms <ms>",
      "Codex document-title generation timeout per request in milliseconds",
      (value) => Number(value),
    )
    .option(
      "--codex-docs-retries <count>",
      "Retry failed Codex document-title requests (per batch)",
      (value) => Number(value),
    )
    .option(
      "--codex-docs-batch-size <count>",
      "Number of documents per Codex document-title request batch",
      (value) => Number(value),
    );
  applyRenameTemplateOptions(renameBatchCommand);
  renameBatchCommand.action(
      async (
        directory: string,
        options: {
          prefix?: string;
          pattern?: string;
          serialOrder?: RenameSerialOrder;
          serialStart?: number;
          serialWidth?: number;
          serialScope?: RenameSerialScope;
          profile?: string;
          dryRun?: boolean;
          previewSkips?: "summary" | "detailed";
          recursive?: boolean;
          maxDepth?: number;
          matchRegex?: string;
          skipRegex?: string;
          ext?: string[];
          skipExt?: string[];
          codex?: boolean;
          codexImages?: boolean;
          codexImagesTimeoutMs?: number;
          codexImagesRetries?: number;
          codexImagesBatchSize?: number;
          codexDocs?: boolean;
          codexDocsTimeoutMs?: number;
          codexDocsRetries?: number;
          codexDocsBatchSize?: number;
        },
      ) => {
        await actionRenameBatch(cliRuntime, {
          directory,
          prefix: options.prefix,
          pattern: options.pattern,
          serialOrder: options.serialOrder,
          serialStart: options.serialStart,
          serialWidth: options.serialWidth,
          serialScope: options.serialScope,
          profile: options.profile,
          dryRun: options.dryRun,
          previewSkips: options.previewSkips,
          recursive: options.recursive,
          maxDepth: options.maxDepth,
          matchRegex: options.matchRegex,
          skipRegex: options.skipRegex,
          ext: options.ext,
          skipExt: options.skipExt,
          codex: options.codex,
          codexImages: options.codexImages,
          codexImagesTimeoutMs: options.codexImagesTimeoutMs,
          codexImagesRetries: options.codexImagesRetries,
          codexImagesBatchSize: options.codexImagesBatchSize,
          codexDocs: options.codexDocs,
          codexDocsTimeoutMs: options.codexDocsTimeoutMs,
          codexDocsRetries: options.codexDocsRetries,
          codexDocsBatchSize: options.codexDocsBatchSize,
        });
      },
    );

  renameCommand
    .command("apply")
    .description("Apply a previously generated rename plan CSV")
    .argument("<csv>", "Rename plan CSV path")
    .option("--auto-clean", "Delete the plan CSV after a successful apply", false)
    .action(async (csv: string, options: { autoClean?: boolean }) => {
      await actionRenameApply(cliRuntime, { csv, autoClean: options.autoClean });
    });

  const batchRenameAliasCommand = program
    .command("batch-rename")
    .description("Alias for `rename batch`")
    .argument("<directory>", "Target directory")
    .option("--prefix <value>", "Filename prefix (optional)")
    .option("--profile <name>", "Preset file profile: all, images, media, docs")
    .option("--dry-run", "Preview rename plan only", false)
    .option("--preview-skips <mode>", "Skipped-item preview mode: summary or detailed")
    .option("--recursive", "Traverse subdirectories recursively", false)
    .option("--max-depth <value>", "Maximum recursive depth (root=0)", (value) => Number(value))
    .option("--match-regex <pattern>", "Only include files whose basename matches the regex")
    .option("--skip-regex <pattern>", "Exclude files whose basename matches the regex")
    .option(
      "--ext <value>",
      "Only include file extensions (repeatable or comma-separated)",
      collectCsvListOption,
      [],
    )
    .option(
      "--skip-ext <value>",
      "Exclude file extensions (repeatable or comma-separated)",
      collectCsvListOption,
      [],
    )
    .option(
      "--codex",
      "Auto-route eligible files to Codex analyzers by file type",
      false,
    )
    .option(
      "--codex-images",
      "Use only the Codex image analyzer for supported static image files",
      false,
    )
    .option(
      "--codex-images-timeout-ms <ms>",
      "Codex image-title generation timeout per request in milliseconds",
      (value) => Number(value),
    )
    .option(
      "--codex-images-retries <count>",
      "Retry failed Codex image-title requests (per batch)",
      (value) => Number(value),
    )
    .option(
      "--codex-images-batch-size <count>",
      "Number of images per Codex image-title request batch",
      (value) => Number(value),
    )
    .option(
      "--codex-docs",
      "Use only the Codex document analyzer for supported docs (.md, .txt, .json, .yaml, .toml, .xml, .html, .pdf, ...)",
      false,
    )
    .option(
      "--codex-docs-timeout-ms <ms>",
      "Codex document-title generation timeout per request in milliseconds",
      (value) => Number(value),
    )
    .option(
      "--codex-docs-retries <count>",
      "Retry failed Codex document-title requests (per batch)",
      (value) => Number(value),
    )
    .option(
      "--codex-docs-batch-size <count>",
      "Number of documents per Codex document-title request batch",
      (value) => Number(value),
    );
  applyRenameTemplateOptions(batchRenameAliasCommand);
  batchRenameAliasCommand.action(
      async (
        directory: string,
        options: {
          prefix?: string;
          pattern?: string;
          serialOrder?: RenameSerialOrder;
          serialStart?: number;
          serialWidth?: number;
          serialScope?: RenameSerialScope;
          profile?: string;
          dryRun?: boolean;
          previewSkips?: "summary" | "detailed";
          recursive?: boolean;
          maxDepth?: number;
          matchRegex?: string;
          skipRegex?: string;
          ext?: string[];
          skipExt?: string[];
          codex?: boolean;
          codexImages?: boolean;
          codexImagesTimeoutMs?: number;
          codexImagesRetries?: number;
          codexImagesBatchSize?: number;
          codexDocs?: boolean;
          codexDocsTimeoutMs?: number;
          codexDocsRetries?: number;
          codexDocsBatchSize?: number;
        },
      ) => {
        await actionRenameBatch(cliRuntime, {
          directory,
          prefix: options.prefix,
          pattern: options.pattern,
          serialOrder: options.serialOrder,
          serialStart: options.serialStart,
          serialWidth: options.serialWidth,
          serialScope: options.serialScope,
          profile: options.profile,
          dryRun: options.dryRun,
          previewSkips: options.previewSkips,
          recursive: options.recursive,
          maxDepth: options.maxDepth,
          matchRegex: options.matchRegex,
          skipRegex: options.skipRegex,
          ext: options.ext,
          skipExt: options.skipExt,
          codex: options.codex,
          codexImages: options.codexImages,
          codexImagesTimeoutMs: options.codexImagesTimeoutMs,
          codexImagesRetries: options.codexImagesRetries,
          codexImagesBatchSize: options.codexImagesBatchSize,
          codexDocs: options.codexDocs,
          codexDocsTimeoutMs: options.codexDocsTimeoutMs,
          codexDocsRetries: options.codexDocsRetries,
          codexDocsBatchSize: options.codexDocsBatchSize,
        });
      },
    );

  const videoCommand = program.command("video").description("Video utilities (ffmpeg-backed)");
  videoCommand
    .command("convert")
    .description("Convert a video file to another format via ffmpeg")
    .requiredOption("-i, --input <path>", "Input video file")
    .requiredOption("-o, --output <path>", "Output video file")
    .option("--overwrite", "Overwrite output file if it already exists", false)
    .action(async (options: { input: string; output: string; overwrite?: boolean }) => {
      await actionVideoConvert(cliRuntime, options);
    });

  videoCommand
    .command("resize")
    .description("Resize video via ffmpeg")
    .requiredOption("-i, --input <path>", "Input video file")
    .requiredOption("-o, --output <path>", "Output video file")
    .option(
      "-s, --scale <factor>",
      "Scale factor multiplier (for example 0.5 halves size, 2 doubles it)",
      (value) => parsePositiveNumberOption(value, "--scale"),
    )
    .option(
      "--width <px>",
      "Output width in pixels (requires --height)",
      (value) => parsePositiveIntegerOption(value, "--width"),
    )
    .option(
      "--height <px>",
      "Output height in pixels (requires --width)",
      (value) => parsePositiveIntegerOption(value, "--height"),
    )
    .option("--overwrite", "Overwrite output file if it already exists", false)
    .addHelpText(
      "after",
      [
        "",
        "Resize modes:",
        "  Preferred: --scale 0.5",
        "  Explicit override: --width 1280 --height 720",
      ].join("\n"),
    )
    .action(
      async (options: {
        input: string;
        output: string;
        scale?: number;
        width?: number;
        height?: number;
        overwrite?: boolean;
      }) => {
        await actionVideoResize(cliRuntime, options);
      },
    );

  videoCommand
    .command("gif")
    .description("Convert video to GIF via ffmpeg")
    .requiredOption("-i, --input <path>", "Input video file")
    .option("-o, --output <path>", "Output GIF file path")
    .option("--width <px>", "GIF width", (value) => Number(value))
    .option("--fps <value>", "GIF frames per second", (value) => Number(value))
    .option("--overwrite", "Overwrite output file if it already exists", false)
    .action(
      async (options: {
        input: string;
        output?: string;
        width?: number;
        fps?: number;
        overwrite?: boolean;
      }) => {
        await actionVideoGif(cliRuntime, options);
      },
    );

  try {
    await program.parseAsync(normalized.argv);
  } catch (error) {
    const cliError = toCliError(error);
    cliRuntime.stderr.write(`${cliError.message}\n`);
    process.exitCode = cliError.exitCode;
  }
}
