import { extname } from "node:path";

import { stringifyCsv } from "../../utils/csv";
import { renderDataQuery } from "../data-query/render";
import {
  resolveReusableHeaderMappingsForDataFlow,
  runCodexHeaderSuggestionFlow,
} from "../data-workflows/header-mapping-flow";
import { resolveReusableSourceShapeForDataFlow } from "../data-workflows/source-shape-flow";
import { CliError } from "../errors";
import { displayPath, assertNonEmpty, ensureFileExists, printLine } from "./shared";
import { writeTextFileSafe } from "../file-io";
import { resolveFromCwd } from "../path-utils";
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
  type DataHeaderMappingEntry,
  type DataHeaderSuggestionRunner,
} from "../duckdb/header-mapping";

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
  rows?: number;
  sourceIntrospectionCollector?: typeof collectDataQuerySourceIntrospection;
  sourceShape?: string;
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

  if (options.sourceShape?.trim() && options.source?.trim()) {
    throw new CliError("--source-shape cannot be used together with --source in the current replay flow.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.sourceShape?.trim() && options.range?.trim()) {
    throw new CliError("--source-shape cannot be used together with --range in the current replay flow.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.sourceShape?.trim() && options.headerRow !== undefined) {
    throw new CliError("--source-shape cannot be used together with --header-row in the current replay flow.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.sourceShape?.trim() && options.bodyStartRow !== undefined) {
    throw new CliError("--source-shape cannot be used together with --body-start-row in the current replay flow.", {
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

export async function actionDataQuery(runtime: CliRuntime, options: DataQueryOptions): Promise<void> {
  validateDataQueryOptions(options);

  const inputPath = resolveFromCwd(runtime, assertNonEmpty(options.input, "Input path"));
  await ensureFileExists(inputPath, "Input");

  const outputPath = options.output?.trim() ? resolveFromCwd(runtime, options.output.trim()) : undefined;
  const format = detectDataQueryInputFormat(inputPath, options.inputFormat);
  const bodyStartRow = options.bodyStartRow;
  const headerRow = options.headerRow;
  const noHeader = options.noHeader === true;
  if (noHeader && format !== "csv" && format !== "tsv") {
    throw new CliError("--no-header is only valid for CSV and TSV query inputs.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  if (options.installMissingExtension && isDuckDbBuiltInQueryFormat(format)) {
    throw new CliError(
      "--install-missing-extension is only valid for extension-backed query formats (sqlite, excel).",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
  const explicitRange = options.range?.trim() || undefined;
  const explicitSource = options.source?.trim() || undefined;
  const resolvedSourceShape = options.sourceShape?.trim()
    ? await resolveReusableSourceShapeForDataFlow({
        commandName: "query",
        format,
        inputPath,
        runtime,
        source: explicitSource,
        sourceShapePath: resolveFromCwd(runtime, options.sourceShape.trim()),
      })
    : undefined;
  const range = resolvedSourceShape?.range ?? explicitRange;
  const source = resolvedSourceShape?.source ?? explicitSource;
  const effectiveBodyStartRow = resolvedSourceShape?.bodyStartRow ?? bodyStartRow;
  const effectiveHeaderRow = resolvedSourceShape?.headerRow ?? headerRow;
  const rowCount = options.rows ?? DEFAULT_QUERY_ROWS;

  if (options.codexSuggestHeaders) {
    const collectSourceIntrospection =
      options.sourceIntrospectionCollector ?? collectDataQuerySourceIntrospection;
    const connection = await createDuckDbConnection();
    try {
      await runCodexHeaderSuggestionFlow({
        runtime,
        format,
        inputPath,
        shape: {
          bodyStartRow: effectiveBodyStartRow,
          range,
          headerRow: effectiveHeaderRow,
          noHeader,
          source,
        },
        overwrite: options.overwrite,
        writeHeaderMapping: options.writeHeaderMapping,
        headerSuggestionRunner: options.headerSuggestionRunner,
        collectIntrospection: async () =>
          await collectSourceIntrospection(
            connection,
            inputPath,
            format,
            {
              bodyStartRow: effectiveBodyStartRow,
              range,
              headerRow: effectiveHeaderRow,
              noHeader,
              source,
            },
            DATA_QUERY_HEADER_SUGGESTION_SAMPLE_ROWS,
            {
              installMissingExtension: options.installMissingExtension,
              statusStream: runtime.stderr,
            },
          ),
        failureCode: "DATA_QUERY_HEADER_SUGGESTION_FAILED",
        failurePrefix: "Codex header suggestions failed",
        reviewMessage: "Review the mapping, then rerun with --header-mapping before SQL execution.",
        followUpCommandPath: ["data", "query"],
        followUpTailArgs: ["--sql", JSON.stringify("<query>")],
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
            range,
            ...(effectiveHeaderRow !== undefined ? { headerRow: effectiveHeaderRow } : {}),
            noHeader,
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
        bodyStartRow: effectiveBodyStartRow,
        headerMappings: resolvedHeaderMappings,
        headerRow: effectiveHeaderRow,
        noHeader,
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
      bodyStartRow: preparedSource.selectedBodyStartRow,
      inputPath,
      range: preparedSource.selectedRange,
      headerRow: preparedSource.selectedHeaderRow,
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
