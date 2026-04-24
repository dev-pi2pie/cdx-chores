import { parseDelimited } from "../../utils/delimited";
import { CliError } from "../errors";
import { parseJsonlStackSourceText, parseJsonStackSourceText } from "./jsonl";
import type {
  DataStackDelimitedInputFormat,
  DataStackInputFormat,
  DataStackSchemaMode,
} from "./types";

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

function parseStackSourceText(options: {
  allowKeyUnion: boolean;
  columns?: readonly string[];
  expectedHeader?: readonly string[];
  expectedHeaderWidth?: number;
  file: { format: DataStackInputFormat; path: string };
  noHeader?: boolean;
  text: string;
}): ParsedStackSource {
  if (options.file.format === "jsonl") {
    return parseJsonlStackSourceText({
      allowKeyUnion: options.allowKeyUnion,
      expectedHeader: options.allowKeyUnion ? undefined : options.expectedHeader,
      path: options.file.path,
      text: options.text,
    });
  }

  if (options.file.format === "json") {
    return parseJsonStackSourceText({
      allowKeyUnion: options.allowKeyUnion,
      expectedHeader: options.allowKeyUnion ? undefined : options.expectedHeader,
      path: options.file.path,
      text: options.text,
    });
  }

  return parseDelimitedStackSourceText({
    columns: options.columns,
    expectedHeaderWidth: options.allowKeyUnion ? undefined : options.expectedHeaderWidth,
    format: options.file.format,
    noHeader: options.noHeader,
    path: options.file.path,
    text: options.text,
  });
}

function createUnionHeader(sources: readonly ParsedStackSource[]): string[] {
  const header: string[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    for (const name of source.header) {
      if (seen.has(name)) {
        continue;
      }
      seen.add(name);
      header.push(name);
    }
  }

  return header;
}

function applyExcludedColumns(options: {
  excludedColumns: readonly string[];
  header: readonly string[];
}): string[] {
  if (options.excludedColumns.length === 0) {
    return [...options.header];
  }

  const headerNames = new Set(options.header);
  const unknownNames = options.excludedColumns.filter((name) => !headerNames.has(name));
  if (unknownNames.length > 0) {
    throw new CliError(`Unknown --exclude-columns names: ${unknownNames.join(", ")}.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const excludedNames = new Set(options.excludedColumns);
  return options.header.filter((name) => !excludedNames.has(name));
}

function assertUniqueHeaderNames(options: {
  header: readonly string[];
  path: string;
  renderPath: (path: string) => string;
  schemaMode: DataStackSchemaMode;
}): void {
  const seen = new Set<string>();
  for (const name of options.header) {
    if (seen.has(name)) {
      throw new CliError(
        `Duplicate column or key name in ${options.renderPath(options.path)}: ${name}. ${options.schemaMode} requires unique names.`,
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }
    seen.add(name);
  }
}

function alignRowsToHeader(options: {
  header: readonly string[];
  source: ParsedStackSource;
}): unknown[][] {
  const sourceIndexes = new Map<string, number>();
  for (const [index, name] of options.source.header.entries()) {
    if (!sourceIndexes.has(name)) {
      sourceIndexes.set(name, index);
    }
  }

  return options.source.dataRows.map((row) =>
    options.header.map((name) => {
      const sourceIndex = sourceIndexes.get(name);
      return sourceIndex === undefined ? "" : (row[sourceIndex] ?? "");
    }),
  );
}

export async function normalizeDataStackSources(options: {
  columns?: readonly string[];
  excludeColumns?: readonly string[];
  files: ReadonlyArray<{ format: DataStackInputFormat; path: string }>;
  noHeader?: boolean;
  readText: (path: string) => Promise<string>;
  renderPath: (path: string) => string;
  schemaMode?: DataStackSchemaMode;
}): Promise<{ header: string[]; rows: unknown[][] }> {
  const schemaMode = options.schemaMode ?? "strict";
  let baseline: ParsedStackSource | undefined;
  const parsedSources: ParsedStackSource[] = [];

  for (const file of options.files) {
    const text = await options.readText(file.path);
    const parsed = parseStackSourceText({
      allowKeyUnion: schemaMode === "union-by-name",
      columns: options.columns,
      expectedHeader: baseline?.header,
      expectedHeaderWidth: baseline?.header.length,
      file,
      noHeader: options.noHeader,
      text,
    });

    if (schemaMode === "strict" && baseline) {
      ensureMatchingHeaders({
        baseline,
        candidate: parsed,
        renderPath: options.renderPath,
      });
    }

    if (!baseline) {
      baseline = parsed;
    }

    parsedSources.push(parsed);
  }

  if (!baseline) {
    throw new CliError("No stackable input files matched the provided sources.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (schemaMode === "strict") {
    return {
      header: baseline.header,
      rows: parsedSources.flatMap((source) => source.dataRows),
    };
  }

  for (const source of parsedSources) {
    assertUniqueHeaderNames({
      header: source.header,
      path: source.path,
      renderPath: options.renderPath,
      schemaMode,
    });
  }

  const unionHeader = createUnionHeader(parsedSources);
  const header = applyExcludedColumns({
    excludedColumns: options.excludeColumns ?? [],
    header: unionHeader,
  });

  return {
    header,
    rows: parsedSources.flatMap((source) => alignRowsToHeader({ header, source })),
  };
}
