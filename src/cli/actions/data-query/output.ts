import { stringifyCsv } from "../../../utils/csv";
import type {
  DataQueryInputFormat,
  DataQueryTableResult,
  PreparedDataQueryContext,
} from "../../duckdb/query";
import { writeTextFileSafe } from "../../file-io";
import { renderDataQuery } from "../../data-query/render";
import type { CliRuntime } from "../../types";
import { displayPath, printLine } from "../shared";
import { normalizeOutputExtension } from "./validate";

function normalizeCsvExportRows(
  rows: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
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

export function printDataQueryJsonResult(
  runtime: CliRuntime,
  rows: Array<Record<string, unknown>>,
  pretty?: boolean,
): void {
  printLine(runtime.stdout, `${JSON.stringify(rows, null, pretty ? 2 : 0)}\n`.trimEnd());
}

export async function writeDataQueryResultOutput(options: {
  outputPath: string;
  overwrite?: boolean;
  pretty?: boolean;
  rows: Array<Record<string, unknown>>;
  runtime: CliRuntime;
}): Promise<void> {
  const outputExtension = normalizeOutputExtension(options.outputPath);
  if (outputExtension === ".json") {
    const json = `${JSON.stringify(options.rows, null, options.pretty ? 2 : 0)}\n`;
    await writeTextFileSafe(options.outputPath, json, { overwrite: options.overwrite });
    printLine(
      options.runtime.stderr,
      `Wrote JSON: ${displayPath(options.runtime, options.outputPath)}`,
    );
    printLine(options.runtime.stderr, `Rows: ${options.rows.length}`);
    return;
  }

  const csv = stringifyCsv(normalizeCsvExportRows(options.rows));
  await writeTextFileSafe(options.outputPath, csv, { overwrite: options.overwrite });
  printLine(
    options.runtime.stderr,
    `Wrote CSV: ${displayPath(options.runtime, options.outputPath)}`,
  );
  printLine(options.runtime.stderr, `Rows: ${options.rows.length}`);
}

export function printRenderedDataQueryTable(options: {
  format: DataQueryInputFormat;
  inputPath: string;
  preparedContext: PreparedDataQueryContext;
  runtime: CliRuntime;
  table: DataQueryTableResult;
}): void {
  const rendered = renderDataQuery(options.runtime, {
    columns: options.table.columns,
    format: options.format,
    bodyStartRow: options.preparedContext.selectedBodyStartRow,
    inputPath: options.inputPath,
    range: options.preparedContext.selectedRange,
    headerRow: options.preparedContext.selectedHeaderRow,
    relations: options.preparedContext.relationAliases,
    rows: options.table.rows,
    source: options.preparedContext.selectedSource,
    truncated: options.table.truncated,
  });

  for (const line of rendered.lines) {
    printLine(options.runtime.stdout, line);
  }
}
