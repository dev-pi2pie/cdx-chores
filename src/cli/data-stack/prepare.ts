import { CliError } from "../errors";
import { normalizeDataStackSchemaOptions } from "./disclosure";
import { normalizeDataStackSources } from "./rows";
import { resolveDataStackInputSources, type DataStackNormalizedInputFile } from "./input-router";
import type { DataStackInputFormat, DataStackSchemaMode } from "./types";

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
  excludeColumns?: readonly string[];
  inputFormat?: DataStackInputFormat;
  maxDepth?: number;
  noHeader?: boolean;
  outputPath?: string;
  pattern?: string;
  readText: (path: string) => Promise<string>;
  recursive?: boolean;
  renderPath: (path: string) => string;
  schemaMode?: DataStackSchemaMode;
  sources: string[];
}

export interface PreparedDataStackExecution {
  excludedColumns: string[];
  files: DataStackNormalizedInputFile[];
  inputFormat: DataStackInputFormat;
  rows: unknown[][];
  header: string[];
  schemaMode: DataStackSchemaMode;
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
    throw new CliError(
      `Output path conflicts with an input source: ${options.renderPath(options.outputPath)}`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  const inputFormat = ensureUniformFormat(normalized.files, options.renderPath);
  if (options.noHeader && (inputFormat === "jsonl" || inputFormat === "json")) {
    throw new CliError("--no-header is only valid for CSV and TSV stack inputs.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const schemaOptions = normalizeDataStackSchemaOptions({
    excludeColumns: options.excludeColumns,
    noHeader: options.noHeader,
    schemaMode: options.schemaMode,
  });

  const normalizedRows = await normalizeDataStackSources({
    columns: options.columns,
    excludeColumns: schemaOptions.excludeColumns,
    files: normalized.files,
    noHeader: options.noHeader,
    readText: options.readText,
    renderPath: options.renderPath,
    schemaMode: schemaOptions.schemaMode,
  });

  return {
    excludedColumns: schemaOptions.excludeColumns,
    files: normalized.files,
    header: normalizedRows.header,
    inputFormat,
    rows: normalizedRows.rows,
    schemaMode: schemaOptions.schemaMode,
  };
}
