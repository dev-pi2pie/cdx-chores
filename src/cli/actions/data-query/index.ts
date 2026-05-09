import type {
  DataHeaderMappingEntry,
  DataHeaderSuggestionRunner,
} from "../../duckdb/header-mapping";
import {
  collectDataQuerySourceIntrospection,
  type DataQueryInputFormat,
  type DataQueryRelationBinding,
  createDuckDbConnection,
  detectDataQueryInputFormat,
  executeDataQueryForAllRows,
  executeDataQueryForTable,
} from "../../duckdb/query";
import { resolveFromCwd } from "../../path-utils";
import type { CliRuntime } from "../../types";
import { assertNonEmpty, ensureFileExists } from "../shared";
import { resolveDataQueryHeaderMappings, runDataQueryHeaderSuggestion } from "./header-suggestion";
import {
  printDataQueryJsonResult,
  printRenderedDataQueryTable,
  writeDataQueryResultOutput,
} from "./output";
import { prepareDataQueryExecutionContext, resolveDataQueryShape } from "./shape-resolution";
import { normalizeSql, validateDataQueryFormatOptions, validateDataQueryOptions } from "./validate";

export interface DataQueryOptions {
  bodyStartRow?: number;
  codexSuggestHeaders?: boolean;
  headerMapping?: string;
  headerMappings?: DataHeaderMappingEntry[];
  headerSuggestionRunner?: DataHeaderSuggestionRunner;
  headerRow?: number;
  installMissingExtension?: boolean;
  input: string;
  inputFormat?: DataQueryInputFormat;
  json?: boolean;
  noHeader?: boolean;
  output?: string;
  overwrite?: boolean;
  pretty?: boolean;
  range?: string;
  relations?: DataQueryRelationBinding[];
  rows?: number;
  sourceIntrospectionCollector?: typeof collectDataQuerySourceIntrospection;
  sourceShape?: string;
  source?: string;
  sql?: string;
  writeHeaderMapping?: string;
}

const DEFAULT_QUERY_ROWS = 20;

export async function actionDataQuery(
  runtime: CliRuntime,
  options: DataQueryOptions,
): Promise<void> {
  validateDataQueryOptions(options);

  const inputPath = resolveFromCwd(runtime, assertNonEmpty(options.input, "Input path"));
  await ensureFileExists(inputPath, "Input");

  const outputPath = options.output?.trim()
    ? resolveFromCwd(runtime, options.output.trim())
    : undefined;
  const format = detectDataQueryInputFormat(inputPath, options.inputFormat);
  const noHeader = options.noHeader === true;
  validateDataQueryFormatOptions({
    format,
    installMissingExtension: options.installMissingExtension,
    noHeader,
  });

  const relationBindings = options.relations ?? [];
  const resolvedShape = await resolveDataQueryShape({
    bodyStartRow: options.bodyStartRow,
    format,
    headerRow: options.headerRow,
    inputPath,
    noHeader,
    range: options.range,
    relations: relationBindings,
    runtime,
    source: options.source,
    sourceShape: options.sourceShape,
  });
  const rowCount = options.rows ?? DEFAULT_QUERY_ROWS;

  if (options.codexSuggestHeaders) {
    await runDataQueryHeaderSuggestion({
      format,
      headerSuggestionRunner: options.headerSuggestionRunner,
      inputPath,
      installMissingExtension: options.installMissingExtension,
      overwrite: options.overwrite,
      runtime,
      shape: resolvedShape,
      sourceIntrospectionCollector: options.sourceIntrospectionCollector,
      writeHeaderMapping: options.writeHeaderMapping,
    });
    return;
  }

  const resolvedHeaderMappings = await resolveDataQueryHeaderMappings({
    format,
    headerMapping: options.headerMapping,
    headerMappings: options.headerMappings,
    inputPath,
    runtime,
    shape: resolvedShape,
  });
  const sql = normalizeSql(options.sql ?? "");

  let connection;
  try {
    connection = await createDuckDbConnection();
    const preparedContext = await prepareDataQueryExecutionContext(connection, {
      format,
      headerMappings: resolvedHeaderMappings,
      inputPath,
      installMissingExtension: options.installMissingExtension,
      relationBindings,
      runtime,
      shape: resolvedShape,
    });

    if (options.json) {
      const result = await executeDataQueryForAllRows(connection, sql);
      printDataQueryJsonResult(runtime, result.rows, options.pretty);
      return;
    }

    if (outputPath) {
      const result = await executeDataQueryForAllRows(connection, sql);
      await writeDataQueryResultOutput({
        outputPath,
        overwrite: options.overwrite,
        pretty: options.pretty,
        rows: result.rows,
        runtime,
      });
      return;
    }

    const table = await executeDataQueryForTable(connection, sql, rowCount);
    printRenderedDataQueryTable({
      format,
      inputPath,
      preparedContext,
      runtime,
      table,
    });
  } finally {
    connection?.closeSync();
  }
}
