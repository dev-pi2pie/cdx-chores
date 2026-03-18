import { extname, join } from "node:path";

import { stringifyDelimitedRows, type DelimitedFormat } from "../../utils/delimited";
import { CliError } from "../errors";
import { resolveFromCwd, writeTextFileSafe } from "../fs-utils";
import type { CliRuntime } from "../types";
import {
  collectDataQuerySourceIntrospection,
  type DataQueryInputFormat,
  createDuckDbConnection,
  detectDataQueryInputFormat,
  executeDataQueryForAllRows,
  prepareDataQuerySource,
} from "../duckdb/query";
import {
  createDataHeaderMappingArtifact,
  createHeaderMappingInputReference,
  generateDataHeaderMappingFileName,
  readDataHeaderMappingArtifact,
  resolveReusableHeaderMappings,
  suggestDataHeaderMappingsWithCodex,
  type DataHeaderMappingEntry,
  type DataHeaderSuggestionRunner,
  writeDataHeaderMappingArtifact,
} from "../duckdb/header-mapping";
import { assertNonEmpty, displayPath, ensureFileExists, printLine } from "./shared";

export interface DataExtractOptions {
  codexSuggestHeaders?: boolean;
  headerMapping?: string;
  headerMappings?: DataHeaderMappingEntry[];
  headerSuggestionRunner?: DataHeaderSuggestionRunner;
  input: string;
  inputFormat?: DataQueryInputFormat;
  output?: string;
  overwrite?: boolean;
  range?: string;
  source?: string;
  writeHeaderMapping?: string;
}

type DataExtractOutputFormat = DelimitedFormat | "json";

const DATA_EXTRACT_HEADER_SUGGESTION_SAMPLE_ROWS = 5;

function normalizeOutputFormat(outputPath: string): DataExtractOutputFormat {
  const extension = extname(outputPath).toLowerCase();
  if (extension === ".csv" || extension === ".tsv" || extension === ".json") {
    return extension.slice(1) as DataExtractOutputFormat;
  }
  throw new CliError("Unsupported --output extension. Use .csv, .tsv, or .json.", {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

function validateDataExtractOptions(options: DataExtractOptions): void {
  const normalizedOutput = options.output?.trim();

  if (options.codexSuggestHeaders && options.headerMapping) {
    throw new CliError("--codex-suggest-headers cannot be used together with --header-mapping.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.codexSuggestHeaders && normalizedOutput) {
    throw new CliError("--codex-suggest-headers stops after writing a header mapping artifact and cannot be used with --output.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.writeHeaderMapping && !options.codexSuggestHeaders) {
    throw new CliError("--write-header-mapping requires --codex-suggest-headers.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (!options.codexSuggestHeaders && !normalizedOutput) {
    throw new CliError("--output is required for data extract materialization runs.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (normalizedOutput) {
    normalizeOutputFormat(normalizedOutput);
  }
}

function classifyHeaderSuggestionFailure(message: string): { code: string; prefix: string } {
  if (
    /codex exec exited/i.test(message) ||
    /missing optional dependency/i.test(message) ||
    /spawn/i.test(message) ||
    /enoent/i.test(message) ||
    /auth/i.test(message) ||
    /sign in/i.test(message) ||
    /api key/i.test(message)
  ) {
    return {
      code: "CODEX_UNAVAILABLE",
      prefix: "Codex header suggestions unavailable",
    };
  }

  return {
    code: "DATA_EXTRACT_HEADER_SUGGESTION_FAILED",
    prefix: "Codex header suggestions failed",
  };
}

function renderHeaderSuggestionSummary(
  runtime: CliRuntime,
  mappings: readonly DataHeaderMappingEntry[],
): void {
  printLine(runtime.stdout, "Suggested headers");
  printLine(runtime.stdout, "");

  if (mappings.length === 0) {
    printLine(runtime.stdout, "(no semantic header changes suggested)");
    return;
  }

  for (const mapping of mappings) {
    const details = [
      `${mapping.from} -> ${mapping.to}`,
      typeof mapping.sample === "string" ? `sample: ${JSON.stringify(mapping.sample)}` : undefined,
      typeof mapping.inferredType === "string" ? `type: ${mapping.inferredType}` : undefined,
    ].filter((value): value is string => Boolean(value));
    printLine(runtime.stdout, `- ${details.join("  ")}`);
  }
}

function buildHeaderSuggestionFollowUpCommand(options: {
  artifactPath: string;
  format: DataQueryInputFormat;
  inputPath: string;
  runtime: CliRuntime;
  shape: {
    range?: string;
    source?: string;
  };
}): string {
  const parts = [
    "cdx-chores",
    "data",
    "extract",
    JSON.stringify(displayPath(options.runtime, options.inputPath)),
    "--input-format",
    options.format,
    ...(options.shape.source ? ["--source", JSON.stringify(options.shape.source)] : []),
    ...(options.shape.range ? ["--range", options.shape.range] : []),
    "--header-mapping",
    JSON.stringify(displayPath(options.runtime, options.artifactPath)),
    "--output",
    JSON.stringify("<output.csv|.tsv|.json>"),
  ];
  return parts.join(" ");
}

function orderMaterializedRows(
  columns: readonly string[],
  rows: ReadonlyArray<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return rows.map((row) =>
    Object.fromEntries(columns.map((column) => [column, row[column]])),
  );
}

function stringifyDelimitedCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function stringifyMaterializedRows(options: {
  columns: readonly string[];
  format: DataExtractOutputFormat;
  rows: ReadonlyArray<Record<string, unknown>>;
}): string {
  const orderedRows = orderMaterializedRows(options.columns, options.rows);

  if (options.format === "json") {
    return `${JSON.stringify(orderedRows)}\n`;
  }

  if (options.columns.length === 0) {
    return "";
  }

  const tableRows: unknown[][] = [
    [...options.columns],
    ...orderedRows.map((row) =>
      options.columns.map((column) => stringifyDelimitedCell(row[column])),
    ),
  ];
  return stringifyDelimitedRows(tableRows, options.format);
}

async function resolveReusableHeaderMappingsForExtract(options: {
  format: DataQueryInputFormat;
  headerMappingPath: string;
  inputPath: string;
  runtime: CliRuntime;
  shape: {
    range?: string;
    source?: string;
  };
}): Promise<DataHeaderMappingEntry[]> {
  const artifact = await readDataHeaderMappingArtifact(options.headerMappingPath);
  const currentInput = createHeaderMappingInputReference({
    cwd: options.runtime.cwd,
    format: options.format,
    inputPath: options.inputPath,
    shape: options.shape,
  });
  return resolveReusableHeaderMappings({
    artifact,
    currentInput,
  });
}

async function runCodexHeaderSuggestionFlow(
  runtime: CliRuntime,
  options: {
    format: DataQueryInputFormat;
    headerSuggestionRunner?: DataHeaderSuggestionRunner;
    inputPath: string;
    overwrite?: boolean;
    range?: string;
    source?: string;
    writeHeaderMapping?: string;
  },
): Promise<void> {
  const artifactPath = options.writeHeaderMapping?.trim()
    ? resolveFromCwd(runtime, options.writeHeaderMapping.trim())
    : join(runtime.cwd, generateDataHeaderMappingFileName());

  let connection;
  try {
    connection = await createDuckDbConnection();
    const introspection = await collectDataQuerySourceIntrospection(
      connection,
      options.inputPath,
      options.format,
      {
        range: options.range,
        source: options.source,
      },
      DATA_EXTRACT_HEADER_SUGGESTION_SAMPLE_ROWS,
    );
    const suggestionResult = await suggestDataHeaderMappingsWithCodex({
      format: options.format,
      introspection,
      runner: options.headerSuggestionRunner,
      workingDirectory: runtime.cwd,
    });

    if (suggestionResult.errorMessage) {
      const failure = classifyHeaderSuggestionFailure(suggestionResult.errorMessage);
      throw new CliError(`${failure.prefix}: ${suggestionResult.errorMessage}`, {
        code: failure.code,
        exitCode: 2,
      });
    }

    const artifact = createDataHeaderMappingArtifact({
      input: createHeaderMappingInputReference({
        cwd: runtime.cwd,
        format: options.format,
        inputPath: options.inputPath,
        shape: {
          range: options.range,
          source: options.source,
        },
      }),
      mappings: suggestionResult.mappings,
      now: runtime.now(),
    });
    await writeDataHeaderMappingArtifact(artifactPath, artifact, {
      overwrite: options.overwrite,
    });

    renderHeaderSuggestionSummary(runtime, suggestionResult.mappings);
    printLine(runtime.stderr, `Wrote header mapping: ${displayPath(runtime, artifactPath)}`);
    printLine(
      runtime.stderr,
      "Review the mapping, then rerun with --header-mapping and --output to materialize the shaped table.",
    );
    printLine(
      runtime.stderr,
      buildHeaderSuggestionFollowUpCommand({
        artifactPath,
        format: options.format,
        inputPath: options.inputPath,
        runtime,
        shape: {
          range: options.range,
          source: options.source,
        },
      }),
    );
  } finally {
    connection?.closeSync();
  }
}

export async function actionDataExtract(runtime: CliRuntime, options: DataExtractOptions): Promise<void> {
  validateDataExtractOptions(options);

  const inputPath = resolveFromCwd(runtime, assertNonEmpty(options.input, "Input path"));
  await ensureFileExists(inputPath, "Input");

  const outputPath = options.output?.trim() ? resolveFromCwd(runtime, options.output.trim()) : undefined;
  const format = detectDataQueryInputFormat(inputPath, options.inputFormat);
  const range = options.range?.trim() || undefined;
  const source = options.source?.trim() || undefined;

  if (options.codexSuggestHeaders) {
    await runCodexHeaderSuggestionFlow(runtime, {
      format,
      headerSuggestionRunner: options.headerSuggestionRunner,
      inputPath,
      overwrite: options.overwrite,
      range,
      source,
      writeHeaderMapping: options.writeHeaderMapping,
    });
    return;
  }

  const resolvedHeaderMappings = options.headerMappings
    ? options.headerMappings.map((mapping) => ({ ...mapping }))
    : options.headerMapping?.trim()
      ? await resolveReusableHeaderMappingsForExtract({
          format,
          headerMappingPath: resolveFromCwd(runtime, options.headerMapping.trim()),
          inputPath,
          runtime,
          shape: {
            range,
            source,
          },
        })
      : undefined;

  let connection;
  try {
    connection = await createDuckDbConnection();
    await prepareDataQuerySource(
      connection,
      inputPath,
      format,
      {
        headerMappings: resolvedHeaderMappings,
        range,
        source,
      },
    );

    const result = await executeDataQueryForAllRows(connection, "select * from file");
    const normalizedOutputPath = assertNonEmpty(outputPath, "Output path");
    const outputFormat = normalizeOutputFormat(normalizedOutputPath);
    const text = stringifyMaterializedRows({
      columns: result.columns,
      format: outputFormat,
      rows: result.rows,
    });

    await writeTextFileSafe(normalizedOutputPath, text, { overwrite: options.overwrite });
    printLine(runtime.stderr, `Wrote ${outputFormat.toUpperCase()}: ${displayPath(runtime, normalizedOutputPath)}`);
    printLine(runtime.stderr, `Rows: ${result.rows.length}`);
  } finally {
    connection?.closeSync();
  }
}
