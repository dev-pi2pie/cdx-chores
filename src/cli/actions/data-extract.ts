import { extname, join } from "node:path";

import { stringifyDelimitedRows, type DelimitedFormat } from "../../utils/delimited";
import {
  resolveReusableHeaderMappingsForDataFlow,
  runCodexHeaderSuggestionFlow,
} from "../data-workflows/header-mapping-flow";
import {
  buildSourceShapeFollowUpCommand,
  classifySourceShapeSuggestionFailure,
  isSourceShapeFormat,
  renderSuggestedSourceShape,
  resolveReusableSourceShapeForDataFlow,
} from "../data-workflows/source-shape-flow";
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
  type DataHeaderMappingEntry,
  type DataHeaderSuggestionRunner,
} from "../duckdb/header-mapping";
import { collectXlsxSheetSnapshot } from "../duckdb/xlsx-sources";
import {
  createDataSourceShapeArtifact,
  createSourceShapeInputReference,
  generateDataSourceShapeFileName,
  suggestDataSourceShapeWithCodex,
  type DataSourceShapeSuggestionRunner,
  writeDataSourceShapeArtifact,
} from "../duckdb/source-shape";
import { assertNonEmpty, displayPath, ensureFileExists, printLine } from "./shared";

export interface DataExtractOptions {
  codexSuggestShape?: boolean;
  codexSuggestHeaders?: boolean;
  headerMapping?: string;
  headerMappings?: DataHeaderMappingEntry[];
  headerRow?: number;
  headerSuggestionRunner?: DataHeaderSuggestionRunner;
  input: string;
  inputFormat?: DataQueryInputFormat;
  output?: string;
  overwrite?: boolean;
  range?: string;
  sourceShape?: string;
  sourceShapeSuggestionRunner?: DataSourceShapeSuggestionRunner;
  source?: string;
  writeHeaderMapping?: string;
  writeSourceShape?: string;
}

type DataExtractOutputFormat = DelimitedFormat | "json";

const DATA_EXTRACT_HEADER_SUGGESTION_SAMPLE_ROWS = 5;
const DATA_EXTRACT_SOURCE_SHAPE_SNAPSHOT_ROWS = 24;

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

  if (options.codexSuggestShape && options.headerMapping) {
    throw new CliError("--codex-suggest-shape cannot be used together with --header-mapping.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.codexSuggestShape && options.codexSuggestHeaders) {
    throw new CliError("--codex-suggest-shape cannot be used together with --codex-suggest-headers.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.codexSuggestShape && options.range?.trim()) {
    throw new CliError("--codex-suggest-shape cannot be used together with --range in the first pass.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.codexSuggestShape && options.headerRow !== undefined) {
    throw new CliError("--codex-suggest-shape cannot be used together with --header-row in the current reviewed-shape flow.", {
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

  if (options.codexSuggestHeaders && normalizedOutput) {
    throw new CliError("--codex-suggest-headers stops after writing a header mapping artifact and cannot be used with --output.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.codexSuggestShape && normalizedOutput) {
    throw new CliError("--codex-suggest-shape stops after writing a source shape artifact and cannot be used with --output.", {
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

  if (options.writeSourceShape && !options.codexSuggestShape) {
    throw new CliError("--write-source-shape requires --codex-suggest-shape.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.sourceShape?.trim() && options.range?.trim()) {
    throw new CliError("--source-shape cannot be used together with --range in the first pass.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.sourceShape?.trim() && options.headerRow !== undefined) {
    throw new CliError("--source-shape cannot be used together with --header-row in the current reviewed-shape flow.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (!options.codexSuggestHeaders && !options.codexSuggestShape && !normalizedOutput) {
    throw new CliError("--output is required for data extract materialization runs.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (normalizedOutput) {
    normalizeOutputFormat(normalizedOutput);
  }
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

async function runCodexSourceShapeSuggestionFlow(
  runtime: CliRuntime,
  options: {
    format: DataQueryInputFormat;
    inputPath: string;
    overwrite?: boolean;
    source?: string;
    sourceShapeSuggestionRunner?: DataSourceShapeSuggestionRunner;
    writeSourceShape?: string;
  },
): Promise<void> {
  if (!isSourceShapeFormat(options.format)) {
    throw new CliError("--codex-suggest-shape is only valid for Excel extract inputs.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const selectedSource = assertNonEmpty(options.source, "Source");
  const artifactPath = options.writeSourceShape?.trim()
    ? resolveFromCwd(runtime, options.writeSourceShape.trim())
    : join(runtime.cwd, generateDataSourceShapeFileName());

  let connection;
  try {
    connection = await createDuckDbConnection();
    const currentIntrospection = await collectDataQuerySourceIntrospection(
      connection,
      options.inputPath,
      options.format,
      {
        source: selectedSource,
      },
      DATA_EXTRACT_HEADER_SUGGESTION_SAMPLE_ROWS,
    );
    const sheetSnapshot = await collectXlsxSheetSnapshot(options.inputPath, selectedSource, {
      maxRows: DATA_EXTRACT_SOURCE_SHAPE_SNAPSHOT_ROWS,
    });
    const suggestionResult = await suggestDataSourceShapeWithCodex({
      context: {
        currentIntrospection,
        sheetSnapshot,
      },
      currentHeaderRow: currentIntrospection.selectedHeaderRow,
      currentRange: currentIntrospection.selectedRange,
      runner: options.sourceShapeSuggestionRunner,
      workingDirectory: runtime.cwd,
    });

    if (suggestionResult.errorMessage || !suggestionResult.shape || !suggestionResult.reasoningSummary) {
      const failure = classifySourceShapeSuggestionFailure(
        suggestionResult.errorMessage ?? "Codex did not return a valid source-shape suggestion.",
      );
      throw new CliError(`${failure.prefix}: ${suggestionResult.errorMessage ?? "Codex did not return a valid source-shape suggestion."}`, {
        code: failure.code,
        exitCode: 2,
      });
    }

    const artifact = createDataSourceShapeArtifact({
      input: createSourceShapeInputReference({
        cwd: runtime.cwd,
        format: "excel",
        inputPath: options.inputPath,
        source: selectedSource,
      }),
      now: runtime.now(),
      shape: suggestionResult.shape,
    });
    await writeDataSourceShapeArtifact(artifactPath, artifact, {
      overwrite: options.overwrite,
    });

    renderSuggestedSourceShape(runtime, {
      headerRow: suggestionResult.shape.headerRow,
      range: suggestionResult.shape.range,
      reasoningSummary: suggestionResult.reasoningSummary,
      stream: "stdout",
    });
    printLine(runtime.stderr, `Wrote source shape: ${displayPath(runtime, artifactPath)}`);
    printLine(
      runtime.stderr,
      "Review the shape artifact, then rerun with --source-shape and --output to materialize the shaped table.",
    );
    printLine(
      runtime.stderr,
      buildSourceShapeFollowUpCommand({
        artifactPath,
        format: options.format,
        inputPath: options.inputPath,
        runtime,
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
  const headerRow = options.headerRow;
  const explicitRange = options.range?.trim() || undefined;
  const explicitSource = options.source?.trim() || undefined;

  if (options.codexSuggestShape) {
    await runCodexSourceShapeSuggestionFlow(runtime, {
      format,
      inputPath,
      overwrite: options.overwrite,
      source: explicitSource,
      sourceShapeSuggestionRunner: options.sourceShapeSuggestionRunner,
      writeSourceShape: options.writeSourceShape,
    });
    return;
  }

  const resolvedSourceShape = options.sourceShape?.trim()
    ? await resolveReusableSourceShapeForDataFlow({
        format,
        inputPath,
        runtime,
        source: explicitSource,
        sourceShapePath: resolveFromCwd(runtime, options.sourceShape.trim()),
      })
    : undefined;
  const range = resolvedSourceShape?.range ?? explicitRange;
  const effectiveHeaderRow = resolvedSourceShape?.headerRow ?? headerRow;
  const source = resolvedSourceShape?.source ?? explicitSource;

  if (options.codexSuggestHeaders) {
    const connection = await createDuckDbConnection();
    try {
      await runCodexHeaderSuggestionFlow({
        runtime,
        format,
        inputPath,
        shape: {
          headerRow: effectiveHeaderRow,
          range,
          source,
        },
        overwrite: options.overwrite,
        writeHeaderMapping: options.writeHeaderMapping,
        headerSuggestionRunner: options.headerSuggestionRunner,
        collectIntrospection: async () =>
          await collectDataQuerySourceIntrospection(
            connection,
            inputPath,
            format,
            {
              headerRow: effectiveHeaderRow,
              range,
              source,
            },
            DATA_EXTRACT_HEADER_SUGGESTION_SAMPLE_ROWS,
          ),
        failureCode: "DATA_EXTRACT_HEADER_SUGGESTION_FAILED",
        failurePrefix: "Codex header suggestions failed",
        reviewMessage:
          "Review the mapping, then rerun with --header-mapping and --output to materialize the shaped table.",
        followUpCommandPath: ["data", "extract"],
        followUpTailArgs: ["--output", JSON.stringify("<output.csv|.tsv|.json>")],
      });
    } finally {
      connection.closeSync();
    }
    return;
  }

  const resolvedHeaderMappings = options.headerMappings
    ? options.headerMappings.map((mapping) => ({ ...mapping }))
    : options.headerMapping?.trim()
      ? await resolveReusableHeaderMappingsForDataFlow({
          format,
          headerMappingPath: resolveFromCwd(runtime, options.headerMapping.trim()),
          inputPath,
          runtime,
          shape: {
            ...(effectiveHeaderRow !== undefined ? { headerRow: effectiveHeaderRow } : {}),
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
        headerRow: effectiveHeaderRow,
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
