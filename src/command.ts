import { Command } from "commander";
import { actionCsvToJson, actionDeferred, actionDoctor, actionJsonToCsv, actionMdToDocx, actionRenameApply, actionRenameBatch, actionVideoConvert, actionVideoGif, actionVideoResize } from "./cli/actions";
import { toCliError } from "./cli/errors";
import { runInteractiveMode } from "./cli/interactive";
import { EMBEDDED_PACKAGE_VERSION } from "./cli/program/version-embedded";
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
    .version(EMBEDDED_PACKAGE_VERSION, "-v, --version");

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
    .action(async (options: { input: string; output?: string; overwrite?: boolean; pretty?: boolean }) => {
      await actionCsvToJson(cliRuntime, options);
    });

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

  const docxCommand = program.command("docx").description("DOCX utilities");
  docxCommand
    .command("to-pdf")
    .description("Convert DOCX to PDF (deferred)")
    .action(async () => {
      await actionDeferred(cliRuntime, "docx to-pdf");
    });

  const pdfCommand = program.command("pdf").description("PDF utilities (deferred in initial phase)");
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
  renameCommand
    .command("batch")
    .description("Batch rename files in a directory")
    .argument("<directory>", "Target directory")
    .option("--prefix <value>", "Filename prefix", "file")
    .option("--dry-run", "Preview rename plan only", false)
    .option("--codex", "Use Codex-assisted semantic titles for supported image files", false)
    .option("--codex-timeout-ms <ms>", "Codex title generation timeout per request in milliseconds", (value) => Number(value))
    .option("--codex-retries <count>", "Retry failed Codex title requests (per batch)", (value) => Number(value))
    .option("--codex-batch-size <count>", "Number of images per Codex title request batch", (value) => Number(value))
    .action(
      async (
        directory: string,
        options: {
          prefix?: string;
          dryRun?: boolean;
          codex?: boolean;
          codexTimeoutMs?: number;
          codexRetries?: number;
          codexBatchSize?: number;
        },
      ) => {
      await actionRenameBatch(cliRuntime, {
        directory,
        prefix: options.prefix,
        dryRun: options.dryRun,
        codex: options.codex,
        codexTimeoutMs: options.codexTimeoutMs,
        codexRetries: options.codexRetries,
        codexBatchSize: options.codexBatchSize,
      });
    });

  renameCommand
    .command("apply")
    .description("Apply a previously generated rename plan CSV")
    .argument("<csv>", "Rename plan CSV path")
    .action(async (csv: string) => {
      await actionRenameApply(cliRuntime, { csv });
    });

  program
    .command("batch-rename")
    .description("Alias for `rename batch`")
    .argument("<directory>", "Target directory")
    .option("--prefix <value>", "Filename prefix", "file")
    .option("--dry-run", "Preview rename plan only", false)
    .option("--codex", "Use Codex-assisted semantic titles for supported image files", false)
    .option("--codex-timeout-ms <ms>", "Codex title generation timeout per request in milliseconds", (value) => Number(value))
    .option("--codex-retries <count>", "Retry failed Codex title requests (per batch)", (value) => Number(value))
    .option("--codex-batch-size <count>", "Number of images per Codex title request batch", (value) => Number(value))
    .action(
      async (
        directory: string,
        options: {
          prefix?: string;
          dryRun?: boolean;
          codex?: boolean;
          codexTimeoutMs?: number;
          codexRetries?: number;
          codexBatchSize?: number;
        },
      ) => {
      await actionRenameBatch(cliRuntime, {
        directory,
        prefix: options.prefix,
        dryRun: options.dryRun,
        codex: options.codex,
        codexTimeoutMs: options.codexTimeoutMs,
        codexRetries: options.codexRetries,
        codexBatchSize: options.codexBatchSize,
      });
    });

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
    .description("Resize video dimensions via ffmpeg")
    .requiredOption("-i, --input <path>", "Input video file")
    .requiredOption("-o, --output <path>", "Output video file")
    .requiredOption("--width <px>", "Output width", (value) => Number(value))
    .requiredOption("--height <px>", "Output height", (value) => Number(value))
    .option("--overwrite", "Overwrite output file if it already exists", false)
    .action(
      async (options: {
        input: string;
        output: string;
        width: number;
        height: number;
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
