import { extname } from "node:path";

import { stringifyDelimitedRows } from "../../../utils/delimited";
import { CliError } from "../../errors";
import type { DataExtractOutputFormat } from "./types";

export function normalizeOutputFormat(outputPath: string): DataExtractOutputFormat {
  const extension = extname(outputPath).toLowerCase();
  if (extension === ".csv" || extension === ".tsv" || extension === ".json") {
    return extension.slice(1) as DataExtractOutputFormat;
  }
  throw new CliError("Unsupported --output extension. Use .csv, .tsv, or .json.", {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
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

export function stringifyMaterializedRows(options: {
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
