import { readTextFileRequired, writeTextFileSafe } from "../file-io";
import { resolveFromCwd } from "../path-utils";
import type { CliRuntime } from "../types";
import { normalizeDataStackOutputFormat } from "../data-stack/formats";
import { materializeDataStackRows } from "../data-stack/materialize";
import { prepareDataStackExecution, type PreparedDataStackExecution } from "../data-stack/prepare";
import type { DataStackInputFormat, DataStackOutputFormat } from "../data-stack/types";
import { CliError } from "../errors";
import { assertNonEmpty, displayPath, printLine } from "./shared";

export interface DataStackOptions {
  columns?: string[];
  inputFormat?: DataStackInputFormat;
  maxDepth?: number;
  noHeader?: boolean;
  output?: string;
  overwrite?: boolean;
  pattern?: string;
  recursive?: boolean;
  sources: string[];
}

function validateOptions(options: DataStackOptions): void {
  if (options.sources.length === 0) {
    throw new CliError("At least one input source is required for data stack.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (!options.output?.trim()) {
    throw new CliError("--output is required for data stack runs.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.columns && options.columns.length === 0) {
    throw new CliError("--columns requires at least one column name.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if ((options.columns?.length ?? 0) > 0 && options.noHeader !== true) {
    throw new CliError("--columns requires --no-header.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if ((options.columns?.length ?? 0) > 0) {
    const normalizedColumns = options.columns?.map((value) => value.trim()).filter((value) => value.length > 0) ?? [];
    if (normalizedColumns.length !== options.columns?.length) {
      throw new CliError("--columns cannot contain empty names.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    if (new Set(normalizedColumns.map((value) => value.toLowerCase())).size !== normalizedColumns.length) {
      throw new CliError("--columns cannot contain duplicate names.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
  }
}

export async function writePreparedDataStackOutput(
  runtime: CliRuntime,
  options: {
    outputFormat: DataStackOutputFormat;
    outputPath: string;
    overwrite?: boolean;
    prepared: PreparedDataStackExecution;
  },
): Promise<void> {
  const text = materializeDataStackRows({
    format: options.outputFormat,
    header: options.prepared.header,
    rows: options.prepared.rows,
  });

  await writeTextFileSafe(options.outputPath, text, { overwrite: options.overwrite });
  printLine(
    runtime.stderr,
    `Wrote ${options.outputFormat.toUpperCase()}: ${displayPath(runtime, options.outputPath)}`,
  );
  printLine(runtime.stderr, `Files: ${options.prepared.files.length}`);
  printLine(runtime.stderr, `Rows: ${options.prepared.rows.length}`);
}

export async function actionDataStack(runtime: CliRuntime, options: DataStackOptions): Promise<void> {
  validateOptions(options);

  const outputPath = resolveFromCwd(runtime, assertNonEmpty(options.output, "Output path"));
  const sourcePaths = options.sources.map((source) => resolveFromCwd(runtime, assertNonEmpty(source, "Input source")));
  const outputFormat = normalizeDataStackOutputFormat(outputPath);
  const prepared = await prepareDataStackExecution({
    columns: options.columns,
    inputFormat: options.inputFormat,
    maxDepth: options.maxDepth,
    noHeader: options.noHeader,
    outputPath,
    pattern: options.pattern?.trim() || undefined,
    readText: readTextFileRequired,
    recursive: options.recursive,
    renderPath: (path) => displayPath(runtime, path),
    sources: sourcePaths,
  });
  await writePreparedDataStackOutput(runtime, {
    outputFormat,
    outputPath,
    overwrite: options.overwrite,
    prepared,
  });
}
