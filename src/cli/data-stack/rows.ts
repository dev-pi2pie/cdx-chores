import { parseDelimited } from "../../utils/delimited";
import { CliError } from "../errors";
import { parseJsonlStackSourceText } from "./jsonl";
import type { DataStackDelimitedInputFormat, DataStackInputFormat } from "./types";

interface ParsedStackSource {
  dataRows: unknown[][];
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

function createPlaceholderColumns(width: number): string[] {
  return Array.from({ length: width }, (_value, index) => `column_${index + 1}`);
}

function parseDelimitedStackSourceText(options: {
  columns?: readonly string[];
  expectedHeaderWidth?: number;
  format: DataStackDelimitedInputFormat;
  noHeader?: boolean;
  path: string;
  text: string;
}): ParsedStackSource {
  const rows = parseDelimited(options.text, options.format);
  const nonEmptyRows = rows.filter((row) => row.some((value) => value.length > 0));

  if (options.noHeader) {
    const inferredWidth =
      options.columns?.length ?? options.expectedHeaderWidth ?? nonEmptyRows[0]?.length;
    if (!inferredWidth || inferredWidth <= 0) {
      throw new CliError(
        `Input file has no data rows to infer headerless columns: ${options.path}`,
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }

    const header = options.columns ? [...options.columns] : createPlaceholderColumns(inferredWidth);
    const dataRows = nonEmptyRows.map((row) => {
      if (row.length > inferredWidth) {
        throw new CliError(
          `Headerless column count mismatch for ${options.path}. Expected ${inferredWidth} columns but received ${row.length}.`,
          {
            code: "INVALID_INPUT",
            exitCode: 2,
          },
        );
      }
      return padRow(row, inferredWidth);
    });

    return {
      dataRows,
      header,
      path: options.path,
    };
  }

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
  columns?: readonly string[];
  files: ReadonlyArray<{ format: DataStackInputFormat; path: string }>;
  noHeader?: boolean;
  readText: (path: string) => Promise<string>;
  renderPath: (path: string) => string;
}): Promise<{ header: string[]; rows: unknown[][] }> {
  let baseline: ParsedStackSource | undefined;
  const rows: unknown[][] = [];

  for (const file of options.files) {
    const text = await options.readText(file.path);
    const parsed =
      file.format === "jsonl"
        ? parseJsonlStackSourceText({
            expectedHeader: baseline?.header,
            path: file.path,
            text,
          })
        : parseDelimitedStackSourceText({
            columns: options.columns,
            expectedHeaderWidth: baseline?.header.length,
            format: file.format,
            noHeader: options.noHeader,
            path: file.path,
            text,
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
