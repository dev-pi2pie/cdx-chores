import { formatPathForDisplay } from "../fs-utils";
import type { CliRuntime } from "../types";
import { getCliColors } from "../colors";
import type { DataPreviewContainsFilter, DataPreviewRow, DataPreviewSource } from "./source";
import { getDisplayWidth, truncateAndPadToDisplayWidth } from "../text-display-width";

export interface RenderDataPreviewOptions {
  columns?: string[];
  containsFilters?: readonly DataPreviewContainsFilter[];
  inputPath: string;
  offset: number;
  rowCount: number;
}

export interface RenderDataPreviewResult {
  lines: string[];
}

export interface RenderDataPreviewSource {
  columns: string[];
  format: string;
  totalRows: number;
  getWindow(offset: number, rowCount: number): DataPreviewRow[];
}

interface VisibleColumn {
  name: string;
  width: number;
}

const DEFAULT_NON_TTY_WIDTH = 120;
const DEFAULT_TTY_WIDTH = 100;
const MAX_COLUMN_WIDTH = 32;
const MIN_COLUMN_WIDTH = 3;
const COLUMN_SEPARATOR = " | ";

function resolveRenderWidth(runtime: CliRuntime): number {
  const stream = runtime.stdout as NodeJS.WritableStream & { columns?: number; isTTY?: boolean };
  if (stream.isTTY && typeof stream.columns === "number" && Number.isFinite(stream.columns)) {
    return Math.max(20, Math.floor(stream.columns));
  }
  if (stream.isTTY) {
    return DEFAULT_TTY_WIDTH;
  }
  return DEFAULT_NON_TTY_WIDTH;
}

function truncateCell(value: string, width: number): string {
  return truncateAndPadToDisplayWidth(value, width);
}

function createSeparator(widths: readonly number[]): string {
  return widths.map((width) => "-".repeat(Math.max(1, width))).join("-+-");
}

function dedupeRequestedColumns(columns: readonly string[] | undefined): string[] {
  if (!columns) {
    return [];
  }

  const values: string[] = [];
  const seen = new Set<string>();
  for (const column of columns.map((item) => item.trim()).filter((item) => item.length > 0)) {
    if (seen.has(column)) {
      continue;
    }
    seen.add(column);
    values.push(column);
  }
  return values;
}

function resolveRequestedColumns(
  source: RenderDataPreviewSource,
  requestedColumns: readonly string[] | undefined,
): string[] {
  const deduped = dedupeRequestedColumns(requestedColumns);
  if (deduped.length === 0) {
    return [...source.columns];
  }

  const available = new Set(source.columns);
  const missing = deduped.filter((column) => !available.has(column));
  if (missing.length > 0) {
    throw new Error(`Unknown columns: ${missing.join(", ")}`);
  }

  return deduped;
}

function measureColumnWidth(name: string, rows: readonly DataPreviewRow[]): number {
  let width = getDisplayWidth(name);
  for (const row of rows) {
    width = Math.max(width, getDisplayWidth(row.values[name] ?? ""));
  }
  return Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, width));
}

function resolveVisibleColumns(
  columns: readonly string[],
  rows: readonly DataPreviewRow[],
  budget: number,
): VisibleColumn[] {
  if (columns.length === 0) {
    return [];
  }

  const visible: VisibleColumn[] = [];
  let consumed = 0;

  for (const column of columns) {
    const separatorWidth = visible.length > 0 ? COLUMN_SEPARATOR.length : 0;
    const remaining = budget - consumed - separatorWidth;
    if (remaining < MIN_COLUMN_WIDTH && visible.length > 0) {
      break;
    }

    const targetWidth = measureColumnWidth(column, rows);
    const width = Math.max(1, Math.min(targetWidth, remaining));
    if (width < MIN_COLUMN_WIDTH && visible.length > 0) {
      break;
    }

    visible.push({
      name: column,
      width,
    });
    consumed += separatorWidth + width;
  }

  return visible.length > 0 ? visible : [{ name: columns[0] ?? "value", width: Math.max(1, budget) }];
}

function formatColumnSummary(allColumns: readonly string[], visibleColumns: readonly VisibleColumn[]): string {
  if (visibleColumns.length === 0) {
    return "(none)";
  }

  const hiddenCount = Math.max(0, allColumns.length - visibleColumns.length);
  const visibleLabel = visibleColumns.map((column) => column.name).join(", ");
  if (hiddenCount === 0) {
    return visibleLabel;
  }
  return `${visibleLabel} (+${hiddenCount} hidden)`;
}

function formatWindowLabel(offset: number, rowCount: number, totalRows: number): string {
  if (totalRows === 0 || rowCount === 0 || offset >= totalRows) {
    return `0 rows at offset ${offset}`;
  }

  const start = offset + 1;
  const end = Math.min(totalRows, offset + rowCount);
  return `${start}-${end} of ${totalRows}`;
}

function resolveContainsFilterColumns(filters: readonly DataPreviewContainsFilter[] | undefined): string[] {
  if (!filters || filters.length === 0) {
    return [];
  }

  const columns: string[] = [];
  const seen = new Set<string>();
  for (const filter of filters) {
    if (seen.has(filter.column)) {
      continue;
    }
    seen.add(filter.column);
    columns.push(filter.column);
  }
  return columns;
}

function resolveHiddenContainsColumns(
  filters: readonly DataPreviewContainsFilter[] | undefined,
  visibleColumns: readonly VisibleColumn[],
): string[] {
  const visibleNames = new Set(visibleColumns.map((column) => column.name));
  return resolveContainsFilterColumns(filters).filter((column) => !visibleNames.has(column));
}

function formatHiddenContainsNote(hiddenColumns: readonly string[]): string {
  if (hiddenColumns.length === 0) {
    return "";
  }
  return `hidden matching columns: ${hiddenColumns.join(", ")}`;
}

function renderTable(
  runtime: CliRuntime,
  visibleColumns: readonly VisibleColumn[],
  rows: readonly DataPreviewRow[],
  options: { containsFilters?: readonly DataPreviewContainsFilter[] } = {},
): string[] {
  if (visibleColumns.length === 0) {
    return ["(no columns to display)"];
  }

  const pc = getCliColors(runtime);
  const widths = visibleColumns.map((column) => column.width);
  const highlightedColumns = new Set(resolveContainsFilterColumns(options.containsFilters));
  const header = visibleColumns
    .map((column) => pc.bold(pc.cyan(truncateCell(column.name, column.width))))
    .join(COLUMN_SEPARATOR);
  const separator = createSeparator(widths);
  const body = rows.map((row) =>
    visibleColumns
      .map((column) => {
        const cell = truncateCell(row.values[column.name] ?? "", column.width);
        if (!highlightedColumns.has(column.name)) {
          return cell;
        }
        return pc.bold(pc.yellow(cell));
      })
      .join(COLUMN_SEPARATOR),
  );

  if (body.length === 0) {
    return [header, separator];
  }

  return [header, separator, ...body];
}

export function renderDataPreview(
  runtime: CliRuntime,
  source: RenderDataPreviewSource,
  options: RenderDataPreviewOptions,
): RenderDataPreviewResult {
  const pc = getCliColors(runtime);
  const widthBudget = resolveRenderWidth(runtime);
  const selectedColumns = resolveRequestedColumns(source, options.columns);
  const rows = source.getWindow(options.offset, options.rowCount);
  const visibleColumns = resolveVisibleColumns(selectedColumns, rows, widthBudget);
  const hiddenContainsColumns = resolveHiddenContainsColumns(options.containsFilters, visibleColumns);

  const lines = [
    `${pc.bold(pc.cyan("Input"))}: ${formatPathForDisplay(runtime, options.inputPath)}`,
    `${pc.bold(pc.cyan("Format"))}: ${source.format}`,
    `${pc.bold(pc.cyan("Rows"))}: ${source.totalRows}`,
    `${pc.bold(pc.cyan("Window"))}: ${formatWindowLabel(options.offset, rows.length, source.totalRows)}`,
    `${pc.bold(pc.cyan("Visible columns"))}: ${formatColumnSummary(selectedColumns, visibleColumns)}`,
    ...(hiddenContainsColumns.length > 0
      ? [`${pc.bold(pc.cyan("Contains highlight"))}: ${formatHiddenContainsNote(hiddenContainsColumns)}`]
      : []),
    "",
    ...renderTable(runtime, visibleColumns, rows, { containsFilters: options.containsFilters }),
  ];

  return { lines };
}

export function renderInMemoryDataPreview(
  runtime: CliRuntime,
  source: DataPreviewSource,
  options: RenderDataPreviewOptions,
): RenderDataPreviewResult {
  return renderDataPreview(runtime, source, options);
}
