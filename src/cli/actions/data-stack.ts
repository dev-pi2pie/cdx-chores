import { readTextFileRequired, writeTextFileSafe } from "../file-io";
import { resolveFromCwd } from "../path-utils";
import type { CliRuntime } from "../types";
import { normalizeDataStackOutputFormat } from "../data-stack/formats";
import { resolveDataStackInputSources } from "../data-stack/input-router";
import { materializeDataStackRows, normalizeDataStackSources } from "../data-stack/rows";
import type { DataStackInputFormat } from "../data-stack/types";
import { CliError } from "../errors";
import { assertNonEmpty, displayPath, printLine } from "./shared";

export interface DataStackOptions {
  inputFormat?: DataStackInputFormat;
  maxDepth?: number;
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
}

function ensureUniformFormat(runtime: CliRuntime, files: ReadonlyArray<{ format: DataStackInputFormat; path: string }>): DataStackInputFormat {
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
        `Mixed normalized input formats are not supported for data stack. ${displayPath(runtime, first.path)} is ${first.format.toUpperCase()} but ${displayPath(runtime, file.path)} is ${file.format.toUpperCase()}.`,
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }
  }

  return first.format;
}

export async function actionDataStack(runtime: CliRuntime, options: DataStackOptions): Promise<void> {
  validateOptions(options);

  const outputPath = resolveFromCwd(runtime, assertNonEmpty(options.output, "Output path"));
  const sourcePaths = options.sources.map((source) => resolveFromCwd(runtime, assertNonEmpty(source, "Input source")));

  const normalized = await resolveDataStackInputSources({
    inputFormat: options.inputFormat,
    maxDepth: options.maxDepth,
    outputPath,
    pattern: options.pattern?.trim() || undefined,
    recursive: options.recursive,
    sources: sourcePaths,
  });

  if (normalized.files.some((file) => file.path === outputPath)) {
    throw new CliError(`Output path conflicts with an input source: ${displayPath(runtime, outputPath)}`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  ensureUniformFormat(runtime, normalized.files);
  const outputFormat = normalizeDataStackOutputFormat(outputPath);

  const normalizedRows = await normalizeDataStackSources({
    files: normalized.files,
    readText: readTextFileRequired,
    renderPath: (path) => displayPath(runtime, path),
  });
  const text = materializeDataStackRows({
    format: outputFormat,
    header: normalizedRows.header,
    rows: normalizedRows.rows,
  });

  await writeTextFileSafe(outputPath, text, { overwrite: options.overwrite });
  printLine(
    runtime.stderr,
    `Wrote ${outputFormat.toUpperCase()}: ${displayPath(runtime, outputPath)}`,
  );
  printLine(runtime.stderr, `Files: ${normalized.files.length}`);
  printLine(runtime.stderr, `Rows: ${normalizedRows.rows.length}`);
}
