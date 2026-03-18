import { extname, join } from "node:path";

import { stringifyCsv } from "../../utils/csv";
import { renderDataQuery } from "../data-query/render";
import { CliError } from "../errors";
import { displayPath, assertNonEmpty, ensureFileExists, printLine } from "./shared";
import { resolveFromCwd, writeTextFileSafe } from "../fs-utils";
import type { CliRuntime } from "../types";
import {
  collectDataQuerySourceIntrospection,
  type DataQueryInputFormat,
  createDuckDbConnection,
  detectDataQueryInputFormat,
  executeDataQueryForAllRows,
  executeDataQueryForTable,
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

export interface DataQueryOptions {
  codexSuggestHeaders?: boolean;
  headerMapping?: string;
  headerMappings?: DataHeaderMappingEntry[];
  headerSuggestionRunner?: DataHeaderSuggestionRunner;
  installMissingExtension?: boolean;
  input: string;
  inputFormat?: DataQueryInputFormat;
  json?: boolean;
  output?: string;
  overwrite?: boolean;
  pretty?: boolean;
  range?: string;
  rows?: number;
  source?: string;
  sql?: string;
  writeHeaderMapping?: string;
}

const DEFAULT_QUERY_ROWS = 20;
const DATA_QUERY_HEADER_SUGGESTION_SAMPLE_ROWS = 5;

function normalizeOutputExtension(outputPath: string): ".csv" | ".json" {
  const extension = extname(outputPath).toLowerCase();
  if (extension === ".json" || extension === ".csv") {
    return extension;
  }
  throw new CliError("Unsupported --output extension. Use .json or .csv.", {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

function validateDataQueryOptions(options: DataQueryOptions): void {
  if (options.json && options.output) {
    throw new CliError("--json cannot be used together with --output.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const outputExtension = options.output ? normalizeOutputExtension(options.output) : undefined;
  if (options.pretty && !options.json && outputExtension !== ".json") {
    throw new CliError("--pretty requires either --json or a .json --output path.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.codexSuggestHeaders && options.headerMapping) {
    throw new CliError("--codex-suggest-headers cannot be used together with --header-mapping.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.codexSuggestHeaders && options.output) {
    throw new CliError("--codex-suggest-headers stops after writing a header mapping artifact and cannot be used with --output.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.codexSuggestHeaders && options.json) {
    throw new CliError("--codex-suggest-headers stops before SQL execution and cannot be used with --json.", {
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
}

function isDuckDbBuiltInQueryFormat(format: DataQueryInputFormat): boolean {
  return format === "csv" || format === "tsv" || format === "parquet";
}

function normalizeSql(sql: string): string {
  const value = assertNonEmpty(sql, "SQL");
  return value.endsWith(";") ? value : value;
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
    code: "DATA_QUERY_HEADER_SUGGESTION_FAILED",
    prefix: "Codex header suggestions failed",
  };
}

function normalizeCsvExportRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => {
        if (value === null || value === undefined) {
          return [key, ""];
        }
        if (typeof value === "object") {
          return [key, JSON.stringify(value)];
        }
        return [key, value];
      }),
    ),
  );
}

async function resolveReusableHeaderMappingsForQuery(options: {
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
    "query",
    JSON.stringify(displayPath(options.runtime, options.inputPath)),
    "--input-format",
    options.format,
    ...(options.shape.source ? ["--source", JSON.stringify(options.shape.source)] : []),
    ...(options.shape.range ? ["--range", options.shape.range] : []),
    "--header-mapping",
    JSON.stringify(displayPath(options.runtime, options.artifactPath)),
    "--sql",
    JSON.stringify("<query>"),
  ];
  return parts.join(" ");
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
      DATA_QUERY_HEADER_SUGGESTION_SAMPLE_ROWS,
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
      `Review the mapping, then rerun with --header-mapping before SQL execution.`,
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

export async function actionDataQuery(runtime: CliRuntime, options: DataQueryOptions): Promise<void> {
  validateDataQueryOptions(options);

  const inputPath = resolveFromCwd(runtime, assertNonEmpty(options.input, "Input path"));
  await ensureFileExists(inputPath, "Input");

  const outputPath = options.output?.trim() ? resolveFromCwd(runtime, options.output.trim()) : undefined;
  const format = detectDataQueryInputFormat(inputPath, options.inputFormat);
  if (options.installMissingExtension && isDuckDbBuiltInQueryFormat(format)) {
    throw new CliError(
      "--install-missing-extension is only valid for extension-backed query formats (sqlite, excel).",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
  const range = options.range?.trim() || undefined;
  const source = options.source?.trim() || undefined;
  const rowCount = options.rows ?? DEFAULT_QUERY_ROWS;

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
      ? await resolveReusableHeaderMappingsForQuery({
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
  const sql = normalizeSql(options.sql ?? "");

  let connection;
  try {
    connection = await createDuckDbConnection();
    const preparedSource = await prepareDataQuerySource(
      connection,
      inputPath,
      format,
      {
        headerMappings: resolvedHeaderMappings,
        range,
        source,
      },
      {
        installMissingExtension: options.installMissingExtension,
        statusStream: runtime.stderr,
      },
    );

    if (options.json) {
      const result = await executeDataQueryForAllRows(connection, sql);
      printLine(runtime.stdout, `${JSON.stringify(result.rows, null, options.pretty ? 2 : 0)}\n`.trimEnd());
      return;
    }

    if (outputPath) {
      const result = await executeDataQueryForAllRows(connection, sql);
      const outputExtension = normalizeOutputExtension(outputPath);
      if (outputExtension === ".json") {
        const json = `${JSON.stringify(result.rows, null, options.pretty ? 2 : 0)}\n`;
        await writeTextFileSafe(outputPath, json, { overwrite: options.overwrite });
        printLine(runtime.stderr, `Wrote JSON: ${displayPath(runtime, outputPath)}`);
        printLine(runtime.stderr, `Rows: ${result.rows.length}`);
        return;
      }

      const csv = stringifyCsv(normalizeCsvExportRows(result.rows));
      await writeTextFileSafe(outputPath, csv, { overwrite: options.overwrite });
      printLine(runtime.stderr, `Wrote CSV: ${displayPath(runtime, outputPath)}`);
      printLine(runtime.stderr, `Rows: ${result.rows.length}`);
      return;
    }

    const table = await executeDataQueryForTable(connection, sql, rowCount);
    const rendered = renderDataQuery(runtime, {
      columns: table.columns,
      format,
      inputPath,
      range: preparedSource.selectedRange,
      rows: table.rows,
      source: preparedSource.selectedSource,
      truncated: table.truncated,
    });

    for (const line of rendered.lines) {
      printLine(runtime.stdout, line);
    }
  } finally {
    connection?.closeSync();
  }
}
