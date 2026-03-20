import {
  resolveReusableHeaderMappingsForDataFlow,
  runCodexHeaderSuggestionFlow,
} from "../data-workflows/header-mapping-flow";
import { resolveReusableSourceShapeForDataFlow } from "../data-workflows/source-shape-flow";
import { writeTextFileSafe } from "../file-io";
import { resolveFromCwd } from "../path-utils";
import type { CliRuntime } from "../types";
import {
  collectDataQuerySourceIntrospection,
  createDuckDbConnection,
  detectDataQueryInputFormat,
  executeDataQueryForAllRows,
  prepareDataQuerySource,
} from "../duckdb/query";
import { assertNonEmpty, displayPath, ensureFileExists, printLine } from "./shared";
import { normalizeOutputFormat, stringifyMaterializedRows } from "./data-extract/materialize";
import { runCodexSourceShapeSuggestionFlow } from "./data-extract/source-shape";
import { DATA_EXTRACT_HEADER_SUGGESTION_SAMPLE_ROWS, type DataExtractOptions } from "./data-extract/types";
import { validateDataExtractOptions } from "./data-extract/validate";
import { CliError } from "../errors";

export type { DataExtractOptions } from "./data-extract/types";

export async function actionDataExtract(runtime: CliRuntime, options: DataExtractOptions): Promise<void> {
  validateDataExtractOptions(options);

  const inputPath = resolveFromCwd(runtime, assertNonEmpty(options.input, "Input path"));
  await ensureFileExists(inputPath, "Input");

  const outputPath = options.output?.trim() ? resolveFromCwd(runtime, options.output.trim()) : undefined;
  const format = detectDataQueryInputFormat(inputPath, options.inputFormat);
  const bodyStartRow = options.bodyStartRow;
  const headerRow = options.headerRow;
  const noHeader = options.noHeader === true;
  if (noHeader && format !== "csv" && format !== "tsv") {
    throw new CliError("--no-header is only valid for CSV and TSV extract inputs.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
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
  const effectiveBodyStartRow = resolvedSourceShape?.bodyStartRow ?? bodyStartRow;
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
          bodyStartRow: effectiveBodyStartRow,
          headerRow: effectiveHeaderRow,
          noHeader,
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
              bodyStartRow: effectiveBodyStartRow,
              headerRow: effectiveHeaderRow,
              noHeader,
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
            ...(effectiveBodyStartRow !== undefined ? { bodyStartRow: effectiveBodyStartRow } : {}),
            ...(effectiveHeaderRow !== undefined ? { headerRow: effectiveHeaderRow } : {}),
            ...(noHeader ? { noHeader: true } : {}),
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
        bodyStartRow: effectiveBodyStartRow,
        headerMappings: resolvedHeaderMappings,
        headerRow: effectiveHeaderRow,
        noHeader,
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
