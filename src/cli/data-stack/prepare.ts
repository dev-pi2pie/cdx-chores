import { CliError } from "../errors";
import { normalizeDataStackSources } from "./rows";
import { resolveDataStackInputSources, type DataStackNormalizedInputFile } from "./input-router";
import type { DataStackInputFormat } from "./types";

function ensureUniformFormat(
  files: ReadonlyArray<{ format: DataStackInputFormat; path: string }>,
  renderPath: (path: string) => string,
): DataStackInputFormat {
  const first = files[0];
  if (!first) {
    throw new CliError("No stackable input files matched the provided sources.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  for (const file of files.slice(1)) {
    if (file.format !== first.format) {
      throw new CliError(
        `Mixed normalized input formats are not supported for data stack. ${renderPath(first.path)} is ${first.format.toUpperCase()} but ${renderPath(file.path)} is ${file.format.toUpperCase()}.`,
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }
  }

  return first.format;
}

export interface PrepareDataStackExecutionOptions {
  columns?: readonly string[];
  inputFormat?: DataStackInputFormat;
  maxDepth?: number;
  noHeader?: boolean;
  outputPath?: string;
  pattern?: string;
  readText: (path: string) => Promise<string>;
  recursive?: boolean;
  renderPath: (path: string) => string;
  sources: string[];
}

export interface PreparedDataStackExecution {
  files: DataStackNormalizedInputFile[];
  inputFormat: DataStackInputFormat;
  rows: unknown[][];
  header: string[];
}

export async function prepareDataStackExecution(
  options: PrepareDataStackExecutionOptions,
): Promise<PreparedDataStackExecution> {
  const normalized = await resolveDataStackInputSources({
    inputFormat: options.inputFormat,
    maxDepth: options.maxDepth,
    outputPath: options.outputPath,
    pattern: options.pattern,
    recursive: options.recursive,
    sources: options.sources,
  });

  if (options.outputPath && normalized.files.some((file) => file.path === options.outputPath)) {
    throw new CliError(`Output path conflicts with an input source: ${options.renderPath(options.outputPath)}`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const inputFormat = ensureUniformFormat(normalized.files, options.renderPath);
  if (options.noHeader && inputFormat === "jsonl") {
    throw new CliError("--no-header is only valid for CSV and TSV stack inputs.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const normalizedRows = await normalizeDataStackSources({
    columns: options.columns,
    files: normalized.files,
    noHeader: options.noHeader,
    readText: options.readText,
    renderPath: options.renderPath,
  });

  return {
    files: normalized.files,
    header: normalizedRows.header,
    inputFormat,
    rows: normalizedRows.rows,
  };
}
