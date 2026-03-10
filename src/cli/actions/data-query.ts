import { extname } from "node:path";

import { stringifyCsv } from "../../utils/csv";
import { renderDataQuery } from "../data-query/render";
import { CliError } from "../errors";
import { displayPath, assertNonEmpty, ensureFileExists, printLine } from "./shared";
import { resolveFromCwd, writeTextFileSafe } from "../fs-utils";
import type { CliRuntime } from "../types";
import {
  type DataQueryInputFormat,
  createDuckDbConnection,
  detectDataQueryInputFormat,
  executeDataQueryForAllRows,
  executeDataQueryForTable,
  prepareDataQuerySource,
} from "../duckdb/query";

export interface DataQueryOptions {
  input: string;
  inputFormat?: DataQueryInputFormat;
  json?: boolean;
  output?: string;
  overwrite?: boolean;
  pretty?: boolean;
  rows?: number;
  source?: string;
  sql: string;
}

const DEFAULT_QUERY_ROWS = 20;

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

  const sql = normalizeSql(options.sql);
  const outputPath = options.output?.trim() ? resolveFromCwd(runtime, options.output.trim()) : undefined;
  const format = detectDataQueryInputFormat(inputPath, options.inputFormat);
  const source = options.source?.trim() || undefined;
  const rowCount = options.rows ?? DEFAULT_QUERY_ROWS;

  let connection;
  try {
    connection = await createDuckDbConnection();
    await prepareDataQuerySource(connection, inputPath, format, source);

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
      rows: table.rows,
      source,
      truncated: table.truncated,
    });

    for (const line of rendered.lines) {
      printLine(runtime.stdout, line);
    }
  } finally {
    connection?.closeSync();
  }
}
