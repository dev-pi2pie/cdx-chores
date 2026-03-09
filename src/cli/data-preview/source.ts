import { extname } from "node:path";

import { parseCsv } from "../../utils/csv";
import { CliError } from "../errors";
import {
  collectFirstSeenColumns,
  normalizeRowsFromJson,
  stringifyPreviewValue,
  type JsonRow,
} from "./normalize";

export type DataPreviewFormat = "csv" | "json";

export interface DataPreviewRow {
  values: Record<string, string>;
}

export interface DataPreviewSource {
  columns: string[];
  format: DataPreviewFormat;
  totalRows: number;
  getWindow(offset: number, rowCount: number): DataPreviewRow[];
}

interface InMemoryDataPreviewSourceOptions {
  columns: string[];
  format: DataPreviewFormat;
  rows: DataPreviewRow[];
}

const EMPTY_CELL = "";

class InMemoryDataPreviewSource implements DataPreviewSource {
  public readonly columns: string[];
  public readonly format: DataPreviewFormat;
  public readonly totalRows: number;
  private readonly rows: DataPreviewRow[];

  constructor(options: InMemoryDataPreviewSourceOptions) {
    this.columns = options.columns;
    this.format = options.format;
    this.rows = options.rows;
    this.totalRows = options.rows.length;
  }

  getWindow(offset: number, rowCount: number): DataPreviewRow[] {
    return this.rows.slice(offset, offset + rowCount);
  }
}

function normalizeCsvHeader(value: string | undefined, index: number): string {
  const trimmed = (index === 0 ? (value ?? "").replace(/^\uFEFF/, "") : (value ?? "")).trim();
  return trimmed || `column_${index + 1}`;
}

function dedupeColumnName(name: string, seen: Map<string, number>): string {
  const current = seen.get(name) ?? 0;
  seen.set(name, current + 1);
  if (current === 0) {
    return name;
  }
  return `${name}_${current + 1}`;
}

function resolveCsvColumns(rows: readonly string[][]): string[] {
  const headerRow = rows[0] ?? [];
  const maxWidth = rows.reduce((largest, row) => Math.max(largest, row.length), 0);
  const seen = new Map<string, number>();
  const columns: string[] = [];

  for (let index = 0; index < maxWidth; index += 1) {
    const normalized = normalizeCsvHeader(headerRow[index], index);
    columns.push(dedupeColumnName(normalized, seen));
  }

  return columns;
}

function buildCsvRows(rows: readonly string[][], columns: readonly string[]): DataPreviewRow[] {
  const dataRows = rows.slice(1).filter((row) => row.some((value) => value.length > 0));
  return dataRows.map((row) => {
    const values: Record<string, string> = {};
    columns.forEach((column, index) => {
      values[column] = row[index] ?? EMPTY_CELL;
    });
    return { values };
  });
}

function buildJsonRows(rows: readonly JsonRow[], columns: readonly string[]): DataPreviewRow[] {
  return rows.map((row) => {
    const values: Record<string, string> = {};
    columns.forEach((column) => {
      values[column] = stringifyPreviewValue(row[column]);
    });
    return { values };
  });
}

function createCsvPreviewSource(text: string): DataPreviewSource {
  let rows: string[][];
  try {
    rows = parseCsv(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Invalid CSV: ${message}`, { code: "INVALID_CSV", exitCode: 2 });
  }

  const columns = resolveCsvColumns(rows);
  return new InMemoryDataPreviewSource({
    columns,
    format: "csv",
    rows: buildCsvRows(rows, columns),
  });
}

function createJsonPreviewSource(text: string): DataPreviewSource {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Invalid JSON: ${message}`, { code: "INVALID_JSON", exitCode: 2 });
  }

  const normalizedRows = normalizeRowsFromJson(parsed);
  const columns = collectFirstSeenColumns(normalizedRows);
  return new InMemoryDataPreviewSource({
    columns,
    format: "json",
    rows: buildJsonRows(normalizedRows, columns),
  });
}

export function createDataPreviewSource(inputPath: string, text: string): DataPreviewSource {
  const extension = extname(inputPath).toLowerCase();

  if (extension === ".csv") {
    return createCsvPreviewSource(text);
  }
  if (extension === ".json") {
    return createJsonPreviewSource(text);
  }

  throw new CliError(`Unsupported preview file type: ${extension || "(none)"}. Expected .csv or .json.`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}
