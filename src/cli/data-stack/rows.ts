import { parseDelimited, stringifyDelimitedRows } from "../../utils/delimited";
import { CliError } from "../errors";
import type { DataStackInputFormat, DataStackOutputFormat } from "./types";

interface ParsedStackSource {
  dataRows: string[][];
  header: string[];
  path: string;
}

function normalizeHeaderCell(value: string, index: number): string {
  return (index === 0 ? value.replace(/^\uFEFF/, "") : value).trim();
}

function normalizeHeaderRow(row: readonly string[]): string[] {
  return row.map((value, index) => normalizeHeaderCell(value, index));
}

function padRow(row: readonly string[], width: number): string[] {
  return [...row, ...Array.from({ length: Math.max(width - row.length, 0) }, () => "")];
}

function parseDataStackSourceText(options: {
  expectedHeaderWidth?: number;
  format: DataStackInputFormat;
  path: string;
  text: string;
}): ParsedStackSource {
  const rows = parseDelimited(options.text, options.format);
  const headerRow = rows[0];

  if (!headerRow || headerRow.every((value) => value.trim().length === 0)) {
    throw new CliError(`Input file has no header row: ${options.path}`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const header = normalizeHeaderRow(headerRow);
  if (header.some((value) => value.length === 0)) {
    throw new CliError(`Input file contains empty header cells: ${options.path}`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const width = options.expectedHeaderWidth ?? header.length;
  const dataRows = rows
    .slice(1)
    .filter((row) => row.some((value) => value.length > 0))
    .map((row) => {
      if (row.length > width) {
        throw new CliError(`Input row has more cells than the header: ${options.path}`, {
          code: "INVALID_INPUT",
          exitCode: 2,
        });
      }
      return padRow(row, width);
    });

  return {
    dataRows,
    header,
    path: options.path,
  };
}

function ensureMatchingHeaders(options: {
  baseline: ParsedStackSource;
  candidate: ParsedStackSource;
  renderPath: (path: string) => string;
}): void {
  if (options.baseline.header.length !== options.candidate.header.length) {
    throw new CliError(
      `Header mismatch for ${options.renderPath(options.candidate.path)}. Expected ${options.baseline.header.join(", ")} from ${options.renderPath(options.baseline.path)} but received ${options.candidate.header.join(", ")}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  for (const [index, value] of options.candidate.header.entries()) {
    if (value !== options.baseline.header[index]) {
      throw new CliError(
        `Header mismatch for ${options.renderPath(options.candidate.path)}. Expected ${options.baseline.header.join(", ")} from ${options.renderPath(options.baseline.path)} but received ${options.candidate.header.join(", ")}.`,
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }
  }
}

export async function normalizeDataStackSources(options: {
  files: ReadonlyArray<{ format: DataStackInputFormat; path: string }>;
  readText: (path: string) => Promise<string>;
  renderPath: (path: string) => string;
}): Promise<{ header: string[]; rows: string[][] }> {
  let baseline: ParsedStackSource | undefined;
  const rows: string[][] = [];

  for (const file of options.files) {
    const parsed = parseDataStackSourceText({
      expectedHeaderWidth: baseline?.header.length,
      format: file.format,
      path: file.path,
      text: await options.readText(file.path),
    });

    if (baseline) {
      ensureMatchingHeaders({
        baseline,
        candidate: parsed,
        renderPath: options.renderPath,
      });
    } else {
      baseline = parsed;
    }

    rows.push(...parsed.dataRows);
  }

  if (!baseline) {
    throw new CliError("No stackable input files matched the provided sources.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  return {
    header: baseline.header,
    rows,
  };
}

export function materializeDataStackRows(options: {
  format: DataStackOutputFormat;
  header: readonly string[];
  rows: ReadonlyArray<readonly string[]>;
}): string {
  if (options.format === "json") {
    const records = options.rows.map((row) =>
      Object.fromEntries(options.header.map((header, index) => [header, row[index] ?? ""])),
    );
    return `${JSON.stringify(records)}\n`;
  }

  return stringifyDelimitedRows([options.header, ...options.rows], options.format);
}
