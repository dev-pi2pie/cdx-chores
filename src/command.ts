import { Command, InvalidArgumentError } from "commander";
import {
  actionCsvToJson,
  actionCsvToTsv,
  actionDataDuckDbDoctor,
  actionDataDuckDbExtensionInstall,
  actionDataExtract,
  actionDataParquetPreview,
  actionDataPreview,
  actionDataQuery,
  actionDataQueryCodex,
  actionDoctor,
  actionJsonToCsv,
  actionJsonToTsv,
  actionMdFrontmatterToJson,
  actionMdToDocx,
  actionRenameApply,
  actionRenameBatch,
  actionRenameCleanup,
  actionRenameFile,
  actionTsvToCsv,
  actionTsvToJson,
  actionVideoConvert,
  actionVideoGif,
  actionVideoResize,
} from "./cli/actions";
import { toCliError } from "./cli/errors";
import { runInteractiveMode } from "./cli/interactive";
import { resolveCliColorEnabled } from "./cli/colors";
import {
  DEFAULT_RENAME_SERIAL_ORDER,
  DEFAULT_RENAME_SERIAL_START,
  RENAME_SERIAL_ORDER_VALUES,
  RENAME_SERIAL_SCOPE_VALUES,
  type RenameSerialOrder,
  type RenameSerialScope,
  type TimestampTimezone,
  TIMESTAMP_TIMEZONE_VALUES,
} from "./cli/rename-template";
import {
  DATA_QUERY_INPUT_FORMAT_VALUES,
  type DataQueryInputFormat,
} from "./cli/duckdb/query";
import {
  DUCKDB_MANAGED_EXTENSION_NAMES,
  type DuckDbManagedExtensionName,
} from "./cli/duckdb/extensions";
import type {
  RenameCleanupConflictStrategy,
  RenameCleanupStyle,
  RenameCleanupTimestampAction,
} from "./cli/actions/rename";
import { getFormattedVersionLabel } from "./cli/program/version";
import type { CliRuntime, RunCliOptions } from "./cli/types";

interface NormalizedCliArgv {
  argv: string[];
  colorEnabled: boolean;
  displayPathStyle: CliRuntime["displayPathStyle"];
}

function createRuntime(options: RunCliOptions): CliRuntime {
  return {
    cwd: options.cwd ?? process.cwd(),
    colorEnabled: options.colorEnabled ?? true,
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

function collectRepeatedOption(value: string, previous: string[] = []): string[] {
  return [...previous, value];
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

function parseTimestampTimezoneOption(value: string): TimestampTimezone {
  const normalized = value.trim().toLowerCase();
  if ((TIMESTAMP_TIMEZONE_VALUES as readonly string[]).includes(normalized)) {
    return normalized as TimestampTimezone;
  }
  throw new InvalidArgumentError(
    `--timestamp-timezone must be one of: ${TIMESTAMP_TIMEZONE_VALUES.join(", ")}.`,
  );
}

function parseDataQueryInputFormatOption(value: string): DataQueryInputFormat {
  const normalized = value.trim().toLowerCase();
  if ((DATA_QUERY_INPUT_FORMAT_VALUES as readonly string[]).includes(normalized)) {
    return normalized as DataQueryInputFormat;
  }
  throw new InvalidArgumentError(
    `--input-format must be one of: ${DATA_QUERY_INPUT_FORMAT_VALUES.join(", ")}.`,
  );
}

function parseDuckDbManagedExtensionOption(value: string): DuckDbManagedExtensionName {
  const normalized = value.trim().toLowerCase();
  if ((DUCKDB_MANAGED_EXTENSION_NAMES as readonly string[]).includes(normalized)) {
    return normalized as DuckDbManagedExtensionName;
  }
  throw new InvalidArgumentError(
    `Extension name must be one of: ${DUCKDB_MANAGED_EXTENSION_NAMES.join(", ")}.`,
  );
}

function parseRenameCleanupStyleOption(value: string): RenameCleanupStyle {
  const normalized = value.trim().toLowerCase();
  if (normalized === "preserve" || normalized === "slug") {
    return normalized;
  }
  throw new InvalidArgumentError("--style must be one of: preserve, slug.");
}

function parseRenameCleanupTimestampActionOption(value: string): RenameCleanupTimestampAction {
  const normalized = value.trim().toLowerCase();
  if (normalized === "keep" || normalized === "remove") {
    return normalized;
  }
  throw new InvalidArgumentError("--timestamp-action must be one of: keep, remove.");
}

function parseRenameCleanupConflictStrategyOption(value: string): RenameCleanupConflictStrategy {
  const normalized = value.trim().toLowerCase();
  if (normalized === "skip" || normalized === "number" || normalized === "uid-suffix") {
    return normalized;
  }
  throw new InvalidArgumentError("--conflict-strategy must be one of: skip, number, uid-suffix.");
}

function applyRenameTemplateOptions(command: Command): void {
  command
    .option(
      "--pattern <template>",
      "Custom filename template (supports {prefix}, {timestamp}, {timestamp_local}, {timestamp_utc}, {timestamp_local_iso}, {timestamp_utc_iso}, {timestamp_local_12h}, {timestamp_utc_12h}, {date}, {date_local}, {date_utc}, {stem}, {uid}, {serial...})",
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
    .option("--serial-width <value>", "Minimum serial width in digits", (value) =>
      parsePositiveIntegerOption(value, "--serial-width"),
    )
    .option(
      "--serial-scope <value>",
      `Serial scope mode override (${RENAME_SERIAL_SCOPE_VALUES.join(", ")}). Default when unspecified: global.`,
      parseSerialScopeOption,
    )
    .option(
      "--timestamp-timezone <value>",
      `Timestamp timezone basis for legacy {timestamp} placeholder (${TIMESTAMP_TIMEZONE_VALUES.join(", ")}). Default when unspecified: utc.`,
      parseTimestampTimezoneOption,
    );
}

function normalizeCliArgv(argv: string[]): NormalizedCliArgv {
  const normalized = argv.slice(0, 2);
  let displayPathStyle: CliRuntime["displayPathStyle"] = "relative";
  let noColorFlag = false;

  for (const arg of argv.slice(2)) {
    if (arg === "--absolute" || arg === "--abs") {
      displayPathStyle = "absolute";
      continue;
    }

    if (arg === "--no-color") {
      noColorFlag = true;
      continue;
    }

    if (arg === "-V") {
      normalized.push("-v");
      continue;
    }

    normalized.push(arg);
  }

  return {
    argv: normalized,
    colorEnabled: resolveCliColorEnabled({ noColorFlag }),
    displayPathStyle,
  };
}

export async function runCli(
  argv: string[] = process.argv,
  runtime: RunCliOptions = {},
): Promise<void> {
  const normalized = normalizeCliArgv(argv);
  const cliRuntime = createRuntime(runtime);
  cliRuntime.colorEnabled = normalized.colorEnabled && (runtime.colorEnabled ?? true);
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
    .option("--no-color", "Disable ANSI colors", false)
    .version(getFormattedVersionLabel(cliRuntime.colorEnabled), "-v, --version", "Show version information");

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

  const dataCommand = program.command("data").description("Data preview, extract, query, and conversion utilities");

  applyCommonFileOptions(
    dataCommand
      .command("json-to-csv")
      .description("Convert JSON file to CSV")
      .requiredOption("-i, --input <path>", "Input JSON file")
      .action(async (options: { input: string; output?: string; overwrite?: boolean }) => {
        await actionJsonToCsv(cliRuntime, options);
      }),
  );

  applyCommonFileOptions(
    dataCommand
      .command("json-to-tsv")
      .description("Convert JSON file to TSV")
      .requiredOption("-i, --input <path>", "Input JSON file")
      .action(async (options: { input: string; output?: string; overwrite?: boolean }) => {
        await actionJsonToTsv(cliRuntime, options);
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

  applyCommonFileOptions(
    dataCommand
      .command("csv-to-tsv")
      .description("Convert CSV file to TSV")
      .requiredOption("-i, --input <path>", "Input CSV file")
      .action(async (options: { input: string; output?: string; overwrite?: boolean }) => {
        await actionCsvToTsv(cliRuntime, options);
      }),
  );

  applyCommonFileOptions(
    dataCommand
      .command("tsv-to-csv")
      .description("Convert TSV file to CSV")
      .requiredOption("-i, --input <path>", "Input TSV file")
      .action(async (options: { input: string; output?: string; overwrite?: boolean }) => {
        await actionTsvToCsv(cliRuntime, options);
      }),
  );

  dataCommand
    .command("tsv-to-json")
    .description("Convert TSV file to JSON")
    .requiredOption("-i, --input <path>", "Input TSV file")
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
        await actionTsvToJson(cliRuntime, options);
      },
    );

  dataCommand
    .command("preview")
    .description("Preview CSV, TSV, or JSON data as a bounded terminal table")
    .argument("<input>", "Input CSV, TSV, or JSON file")
    .option("--no-header", "Treat CSV or TSV input as headerless and generate column_n names", false)
    .option("--rows <value>", "Number of rows to show", (value: string) => parsePositiveIntegerOption(value, "--rows"))
    .option("--offset <value>", "Row offset to start from", (value: string) =>
      parseNonNegativeIntegerOption(value, "--offset"),
    )
    .option("--columns <names>", "Columns to show (comma-separated)", collectCsvListOption, [])
    .option(
      "--contains <column:keyword>",
      "Filter rows by case-insensitive substring match on a named column (repeatable; escape ':' as \\: and '\\' as \\\\)",
      collectRepeatedOption,
      [],
    )
    .action(
      async (
        input: string,
        options: {
          columns?: string[];
          contains?: string[];
          noHeader?: boolean;
          offset?: number;
          rows?: number;
        },
      ) => {
        await actionDataPreview(cliRuntime, {
          columns: options.columns,
          contains: options.contains,
          input,
          noHeader: options.noHeader,
          offset: options.offset,
          rows: options.rows,
        });
      },
    );

  const parquetCommand = dataCommand.command("parquet").description("DuckDB-backed Parquet preview utilities");

  const duckdbCommand = dataCommand.command("duckdb").description("DuckDB extension inspection and setup utilities");

  duckdbCommand
    .command("doctor")
    .description("Inspect DuckDB-managed extension state for data query")
    .option("--json", "Output machine-readable JSON", false)
    .action(async (options: { json?: boolean }) => {
      await actionDataDuckDbDoctor(cliRuntime, { json: options.json });
    });

  const duckdbExtensionCommand = duckdbCommand
    .command("extension")
    .description("Manage DuckDB extensions used by data query");

  duckdbExtensionCommand
    .command("install")
    .description("Install a managed DuckDB extension for the current runtime")
    .argument("[name]", `Extension name (${DUCKDB_MANAGED_EXTENSION_NAMES.join(", ")})`, parseDuckDbManagedExtensionOption)
    .option("--all-supported", "Install all managed DuckDB extensions", false)
    .action(
      async (
        extensionName: DuckDbManagedExtensionName | undefined,
        options: { allSupported?: boolean },
      ) => {
        await actionDataDuckDbExtensionInstall(cliRuntime, {
          allSupported: options.allSupported,
          extensionName,
        });
      },
    );

  parquetCommand
    .command("preview")
    .description("Preview Parquet data as a bounded terminal table")
    .argument("<input>", "Input Parquet file")
    .option("--rows <value>", "Number of rows to show", (value: string) => parsePositiveIntegerOption(value, "--rows"))
    .option("--offset <value>", "Row offset to start from", (value: string) =>
      parseNonNegativeIntegerOption(value, "--offset"),
    )
    .option("--columns <names>", "Columns to show (comma-separated)", collectCsvListOption, [])
    .action(
      async (
        input: string,
        options: {
          columns?: string[];
          offset?: number;
          rows?: number;
        },
      ) => {
        await actionDataParquetPreview(cliRuntime, {
          columns: options.columns,
          input,
          offset: options.offset,
          rows: options.rows,
        });
      },
    );

  dataCommand
    .command("extract")
    .description("Materialize one shaped table from one input file")
    .argument("<input>", "Input data file")
    .option(
      "--input-format <format>",
      `Override detected input format (${DATA_QUERY_INPUT_FORMAT_VALUES.join(", ")})`,
      parseDataQueryInputFormatOption,
    )
    .option("--source <name>", "Source object name for SQLite tables/views or Excel sheets")
    .option("--range <A1:Z99>", "Excel cell range within the selected sheet")
    .option("--header-row <value>", "Excel worksheet row number to treat as the header row", (value: string) =>
      parsePositiveIntegerOption(value, "--header-row"),
    )
    .option("--source-shape <path>", "Reuse an accepted JSON source-shape artifact")
    .option("--codex-suggest-shape", "Ask Codex to suggest an explicit Excel source shape and stop after writing the review artifact", false)
    .option("--write-source-shape <path>", "Write the suggested source-shape artifact to an explicit path")
    .option("--header-mapping <path>", "Reuse an accepted JSON header-mapping artifact")
    .option("--codex-suggest-headers", "Ask Codex to suggest semantic header mappings and stop after writing the review artifact", false)
    .option("--write-header-mapping <path>", "Write the suggested header-mapping artifact to an explicit path")
    .option("-o, --output <path>", "Write the shaped table to a .csv, .tsv, or .json file")
    .option("--overwrite", "Overwrite output file if it already exists", false)
    .action(
      async (
        input: string,
        options: {
          codexSuggestShape?: boolean;
          codexSuggestHeaders?: boolean;
          headerMapping?: string;
          headerRow?: number;
          inputFormat?: DataQueryInputFormat;
          output?: string;
          overwrite?: boolean;
          range?: string;
          sourceShape?: string;
          source?: string;
          writeHeaderMapping?: string;
          writeSourceShape?: string;
        },
      ) => {
        await actionDataExtract(cliRuntime, {
          codexSuggestShape: options.codexSuggestShape,
          codexSuggestHeaders: options.codexSuggestHeaders,
          headerMapping: options.headerMapping,
          headerRow: options.headerRow,
          input,
          inputFormat: options.inputFormat,
          output: options.output,
          overwrite: options.overwrite,
          range: options.range,
          sourceShape: options.sourceShape,
          source: options.source,
          writeHeaderMapping: options.writeHeaderMapping,
          writeSourceShape: options.writeSourceShape,
        });
      },
    );

  const queryCommand = dataCommand
    .command("query")
    .description("Run a DuckDB-backed SQL query against one input file")
    .argument("<input>", "Input data file")
    .option("--sql <query>", "SQL query to execute against logical table `file`")
    .option(
      "--input-format <format>",
      `Override detected input format (${DATA_QUERY_INPUT_FORMAT_VALUES.join(", ")})`,
      parseDataQueryInputFormatOption,
    )
    .option("--source <name>", "Source object name for SQLite tables/views or Excel sheets")
    .option("--range <A1:Z99>", "Excel cell range within the selected sheet")
    .option("--header-row <value>", "Excel worksheet row number to treat as the header row", (value: string) =>
      parsePositiveIntegerOption(value, "--header-row"),
    )
    .option("--header-mapping <path>", "Reuse an accepted JSON header-mapping artifact")
    .option("--codex-suggest-headers", "Ask Codex to suggest semantic header mappings and stop after writing the review artifact", false)
    .option("--write-header-mapping <path>", "Write the suggested header-mapping artifact to an explicit path")
    .option(
      "--install-missing-extension",
      "Attempt one DuckDB extension install-and-retry for sqlite/excel inputs",
      false,
    )
    .option("--rows <value>", "Number of rows to show in bounded table output", (value: string) =>
      parsePositiveIntegerOption(value, "--rows"),
    )
    .option("--json", "Write full query results as JSON to stdout", false)
    .option("--pretty", "Pretty-print JSON stdout or .json file output", false)
    .option("-o, --output <path>", "Write full query results to a .json or .csv file")
    .option("--overwrite", "Overwrite output file if it already exists", false)
    .action(
      async (
        input: string,
        options: {
          codexSuggestHeaders?: boolean;
          headerMapping?: string;
          headerRow?: number;
          inputFormat?: DataQueryInputFormat;
          installMissingExtension?: boolean;
          json?: boolean;
          output?: string;
          overwrite?: boolean;
          pretty?: boolean;
          range?: string;
          rows?: number;
          source?: string;
          sql?: string;
          writeHeaderMapping?: string;
        },
      ) => {
        await actionDataQuery(cliRuntime, {
          codexSuggestHeaders: options.codexSuggestHeaders,
          headerMapping: options.headerMapping,
          headerRow: options.headerRow,
          input,
          inputFormat: options.inputFormat,
          installMissingExtension: options.installMissingExtension,
          json: options.json,
          output: options.output,
          overwrite: options.overwrite,
          pretty: options.pretty,
          range: options.range,
          rows: options.rows,
          source: options.source,
          sql: options.sql,
          writeHeaderMapping: options.writeHeaderMapping,
        });
      },
    );

  queryCommand
    .command("codex")
    .description("Draft SQL from natural-language intent using bounded introspection")
    .argument("<input>", "Input data file")
    .requiredOption("--intent <text>", "Natural-language query intent for Codex drafting")
    .option(
      "--input-format <format>",
      `Override detected input format (${DATA_QUERY_INPUT_FORMAT_VALUES.join(", ")})`,
      parseDataQueryInputFormatOption,
    )
    .option("--source <name>", "Source object name for SQLite tables/views or Excel sheets")
    .option("--range <A1:Z99>", "Excel cell range within the selected sheet")
    .option("--header-row <value>", "Excel worksheet row number to treat as the header row", (value: string) =>
      parsePositiveIntegerOption(value, "--header-row"),
    )
    .option("--print-sql", "Write drafted SQL only to stdout", false)
    .action(
      async (
        input: string,
        options: {
          inputFormat?: DataQueryInputFormat;
          intent: string;
          headerRow?: number;
          printSql?: boolean;
          range?: string;
          source?: string;
        },
        command: Command,
      ) => {
        const parentOptions = command.parent?.opts<{
          headerRow?: number;
          inputFormat?: DataQueryInputFormat;
          range?: string;
          source?: string;
        }>();
        await actionDataQueryCodex(cliRuntime, {
          headerRow: options.headerRow ?? parentOptions?.headerRow,
          input,
          inputFormat: options.inputFormat ?? parentOptions?.inputFormat,
          intent: options.intent,
          printSql: options.printSql,
          range: options.range ?? parentOptions?.range,
          source: options.source ?? parentOptions?.source,
        });
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
  const renameCommand = program.command("rename").description("Rename helpers");
  const renameFileCommand = renameCommand
    .command("file")
    .description("Rename a single file")
    .argument("<path>", "Target file path")
    .option("--prefix <value>", "Filename prefix (optional)")
    .option("--dry-run", "Preview rename plan only", false)
    .option("--codex", "Auto-route eligible files to Codex analyzers by file type", false)
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
        timestampTimezone?: TimestampTimezone;
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
        timestampTimezone: options.timestampTimezone,
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
    .option("--codex", "Auto-route eligible files to Codex analyzers by file type", false)
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
        timestampTimezone?: TimestampTimezone;
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
        timestampTimezone: options.timestampTimezone,
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
    .command("cleanup")
    .description("Normalize existing filenames by explicit hint families")
    .argument("<path>", "Target file or directory path")
    .option(
      "--hint <value>",
      "Cleanup hint family (repeatable or comma-separated): date, timestamp, serial, uid",
      collectCsvListOption,
      [],
    )
    .option(
      "--hints <value>",
      "Alias for --hint (repeatable or comma-separated): date, timestamp, serial, uid",
      collectCsvListOption,
      [],
    )
    .option(
      "--style <value>",
      "Cleanup output style: preserve, slug",
      parseRenameCleanupStyleOption,
    )
    .option(
      "--timestamp-action <value>",
      "Timestamp fragment handling when --hint timestamp is active: keep or remove",
      parseRenameCleanupTimestampActionOption,
    )
    .option(
      "--conflict-strategy <value>",
      "Cleanup conflict strategy: skip, number, uid-suffix",
      parseRenameCleanupConflictStrategyOption,
    )
    .option("--dry-run", "Preview cleanup plan only", false)
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
    .action(
      async (
        path: string,
        options: {
          hint?: string[];
          hints?: string[];
          style?: RenameCleanupStyle;
          timestampAction?: RenameCleanupTimestampAction;
          conflictStrategy?: RenameCleanupConflictStrategy;
          dryRun?: boolean;
          previewSkips?: "summary" | "detailed";
          recursive?: boolean;
          maxDepth?: number;
          matchRegex?: string;
          skipRegex?: string;
          ext?: string[];
          skipExt?: string[];
        },
      ) => {
        await actionRenameCleanup(cliRuntime, {
          path,
          hints: [...(options.hint ?? []), ...(options.hints ?? [])],
          style: options.style,
          timestampAction: options.timestampAction,
          conflictStrategy: options.conflictStrategy,
          dryRun: options.dryRun,
          previewSkips: options.previewSkips,
          recursive: options.recursive,
          maxDepth: options.maxDepth,
          matchRegex: options.matchRegex,
          skipRegex: options.skipRegex,
          ext: options.ext,
          skipExt: options.skipExt,
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
    .option("--codex", "Auto-route eligible files to Codex analyzers by file type", false)
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
        timestampTimezone?: TimestampTimezone;
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
        timestampTimezone: options.timestampTimezone,
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
    .option("--width <px>", "Output width in pixels (requires --height)", (value) =>
      parsePositiveIntegerOption(value, "--width"),
    )
    .option("--height <px>", "Output height in pixels (requires --width)", (value) =>
      parsePositiveIntegerOption(value, "--height"),
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
