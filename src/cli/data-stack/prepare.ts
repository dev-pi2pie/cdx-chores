import { CliError } from "../errors";
import { normalizeDataStackSchemaOptions } from "./disclosure";
import { normalizeDataStackSources } from "./rows";
import { resolveDataStackInputSources, type DataStackNormalizedInputFile } from "./input-router";
import { isDataStackSchemaMismatchError } from "./schema-errors";
import type { DataStackInputFormat, DataStackSchemaMode, DataStackSchemaModeOption } from "./types";

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
  schemaMode?: DataStackSchemaModeOption;
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

function createAutoSchemaModeFailure(error: unknown): CliError {
  const reason = error instanceof Error ? error.message : String(error);
  return new CliError(
    `--schema-mode auto could not choose a safe schema mode. Use --schema-mode strict to fail on schema drift, use --schema-mode union-by-name after resolving ambiguous names, or revise the inputs. Last error: ${reason}`,
    {
      code: "INVALID_INPUT",
      exitCode: 2,
    },
  );
}

async function normalizeSourcesForSchemaMode(options: {
  columns?: readonly string[];
  excludeColumns?: readonly string[];
  files: DataStackNormalizedInputFile[];
  noHeader?: boolean;
  readText: (path: string) => Promise<string>;
  renderPath: (path: string) => string;
  schemaMode: DataStackSchemaMode;
}): Promise<{ header: string[]; rows: unknown[][] }> {
  return await normalizeDataStackSources({
    columns: options.columns,
    excludeColumns: options.excludeColumns,
    files: options.files,
    noHeader: options.noHeader,
    readText: options.readText,
    renderPath: options.renderPath,
    schemaMode: options.schemaMode,
  });
}

async function normalizeSourcesWithAutoSchemaMode(options: {
  columns?: readonly string[];
  files: DataStackNormalizedInputFile[];
  noHeader?: boolean;
  readText: (path: string) => Promise<string>;
  renderPath: (path: string) => string;
}): Promise<{ header: string[]; rows: unknown[][]; schemaMode: DataStackSchemaMode }> {
  try {
    const normalizedRows = await normalizeSourcesForSchemaMode({
      columns: options.columns,
      files: options.files,
      noHeader: options.noHeader,
      readText: options.readText,
      renderPath: options.renderPath,
      schemaMode: "strict",
    });
    return {
      ...normalizedRows,
      schemaMode: "strict",
    };
  } catch (error) {
    if (!isDataStackSchemaMismatchError(error)) {
      throw error;
    }
    if (options.noHeader) {
      throw createAutoSchemaModeFailure(error);
    }
  }

  try {
    const normalizedRows = await normalizeSourcesForSchemaMode({
      columns: options.columns,
      files: options.files,
      noHeader: options.noHeader,
      readText: options.readText,
      renderPath: options.renderPath,
      schemaMode: "union-by-name",
    });
    return {
      ...normalizedRows,
      schemaMode: "union-by-name",
    };
  } catch (error) {
    throw createAutoSchemaModeFailure(error);
  }
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

  const normalizedRows =
    schemaOptions.schemaMode === "auto"
      ? await normalizeSourcesWithAutoSchemaMode({
          columns: options.columns,
          files: normalized.files,
          noHeader: options.noHeader,
          readText: options.readText,
          renderPath: options.renderPath,
        })
      : {
          ...(await normalizeSourcesForSchemaMode({
            columns: options.columns,
            excludeColumns: schemaOptions.excludeColumns,
            files: normalized.files,
            noHeader: options.noHeader,
            readText: options.readText,
            renderPath: options.renderPath,
            schemaMode: schemaOptions.schemaMode,
          })),
          schemaMode: schemaOptions.schemaMode,
        };

  return {
    excludedColumns: schemaOptions.excludeColumns,
    files: normalized.files,
    header: normalizedRows.header,
    inputFormat,
    rows: normalizedRows.rows,
    schemaMode: normalizedRows.schemaMode,
  };
}
