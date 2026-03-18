import { formatPathForDisplay } from "../fs-utils";
import type { CliRuntime } from "../types";
import { getCliColors } from "../colors";
import type { DataPreviewRow } from "../data-preview/source";
import { getDisplayWidth, truncateAndPadToDisplayWidth } from "../text-display-width";

export interface RenderDataQueryOptions {
  columns: string[];
  format: string;
  headerRow?: number;
  inputPath: string;
  range?: string;
  rows: DataPreviewRow[];
  source?: string;
  truncated: boolean;
}

export interface RenderDataQueryResult {
  lines: string[];
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

    visible.push({ name: column, width });
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

function renderTable(
  runtime: CliRuntime,
  visibleColumns: readonly VisibleColumn[],
  rows: readonly DataPreviewRow[],
): string[] {
  if (visibleColumns.length === 0) {
    return ["(no columns to display)"];
  }

  const pc = getCliColors(runtime);
  const widths = visibleColumns.map((column) => column.width);
  const header = visibleColumns
    .map((column) => pc.bold(pc.cyan(truncateCell(column.name, column.width))))
    .join(COLUMN_SEPARATOR);
  const separator = createSeparator(widths);
  const body = rows.map((row) =>
    visibleColumns
      .map((column) => truncateCell(row.values[column.name] ?? "", column.width))
      .join(COLUMN_SEPARATOR),
  );

  if (body.length === 0) {
    return [header, separator];
  }

  return [header, separator, ...body];
}

export function renderDataQuery(
  runtime: CliRuntime,
  options: RenderDataQueryOptions,
): RenderDataQueryResult {
  const pc = getCliColors(runtime);
  const widthBudget = resolveRenderWidth(runtime);
  const visibleColumns = resolveVisibleColumns(options.columns, options.rows, widthBudget);
  const resultRowsLabel = options.truncated
    ? `${options.rows.length}+ (bounded)`
    : String(options.rows.length);

  const lines = [
    `${pc.bold(pc.cyan("Input"))}: ${formatPathForDisplay(runtime, options.inputPath)}`,
    `${pc.bold(pc.cyan("Format"))}: ${options.format}`,
    ...(options.source
      ? [`${pc.bold(pc.cyan("Source"))}: ${options.source}`]
      : []),
    ...(options.range
      ? [`${pc.bold(pc.cyan("Range"))}: ${options.range}`]
      : []),
    ...(options.headerRow !== undefined
      ? [`${pc.bold(pc.cyan("Header row"))}: ${options.headerRow}`]
      : []),
    `${pc.bold(pc.cyan("Result rows"))}: ${resultRowsLabel}`,
    `${pc.bold(pc.cyan("Visible columns"))}: ${formatColumnSummary(options.columns, visibleColumns)}`,
    "",
    ...renderTable(runtime, visibleColumns, options.rows),
  ];

  return { lines };
}
