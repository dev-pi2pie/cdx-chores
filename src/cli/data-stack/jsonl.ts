import { CliError } from "../errors";
import { DataStackSchemaMismatchError } from "./schema-errors";

interface ParsedJsonlStackSource {
  dataRows: unknown[][];
  header: string[];
  path: string;
}

function validateJsonlRowObject(
  value: unknown,
  path: string,
  lineNumber: number,
  label = "JSONL rows",
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CliError(`${label} must be JSON objects: ${path} (line ${lineNumber}).`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return value as Record<string, unknown>;
}

function compareJsonlKeySets(options: {
  baseline: readonly string[];
  candidate: readonly string[];
  label?: string;
  path: string;
}): void {
  const baselineSorted = [...options.baseline].sort();
  const candidateSorted = [...options.candidate].sort();
  if (
    baselineSorted.length !== candidateSorted.length ||
    baselineSorted.some((value, index) => value !== candidateSorted[index])
  ) {
    throw new DataStackSchemaMismatchError(
      `${options.label ?? "JSONL"} key mismatch for ${options.path}. Expected keys ${baselineSorted.join(", ")} but received ${candidateSorted.join(", ")}.`,
    );
  }
}

function collectUnionHeaderFromRows(rows: ReadonlyArray<Record<string, unknown>>): string[] {
  const header: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      header.push(key);
    }
  }

  return header;
}

function rowsToDataRows(
  rows: ReadonlyArray<Record<string, unknown>>,
  header: readonly string[],
): unknown[][] {
  return rows.map((row) => header.map((key) => row[key] ?? ""));
}

export function parseJsonlStackSourceText(options: {
  allowKeyUnion?: boolean;
  expectedHeader?: readonly string[];
  path: string;
  text: string;
}): ParsedJsonlStackSource {
  const lines = options.text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new CliError(`Input file has no JSONL rows: ${options.path}`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const parsedRows = lines.map((line, index) => {
    try {
      return validateJsonlRowObject(JSON.parse(line), options.path, index + 1);
    } catch (error) {
      if (error instanceof CliError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new CliError(`Invalid JSONL row in ${options.path} at line ${index + 1}: ${message}`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
  });

  const header = options.expectedHeader
    ? [...options.expectedHeader]
    : options.allowKeyUnion
      ? collectUnionHeaderFromRows(parsedRows)
      : Object.keys(parsedRows[0] ?? {});
  if (header.length === 0) {
    throw new CliError(`JSONL rows must contain at least one key: ${options.path}`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (!options.allowKeyUnion) {
    for (const row of parsedRows) {
      compareJsonlKeySets({
        baseline: header,
        candidate: Object.keys(row),
        label: "JSONL",
        path: options.path,
      });
    }
  }

  return {
    dataRows: rowsToDataRows(parsedRows, header),
    header,
    path: options.path,
  };
}

export function parseJsonStackSourceText(options: {
  allowKeyUnion?: boolean;
  expectedHeader?: readonly string[];
  path: string;
  text: string;
}): ParsedJsonlStackSource {
  let parsed: unknown;
  try {
    parsed = JSON.parse(options.text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Invalid JSON input in ${options.path}: ${message}`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (!Array.isArray(parsed)) {
    throw new CliError(`JSON stack input must be one top-level array of objects: ${options.path}`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (parsed.length === 0) {
    throw new CliError(`Input file has no JSON rows: ${options.path}`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const parsedRows = parsed.map((row, index) =>
    validateJsonlRowObject(row, options.path, index + 1, "JSON array items"),
  );
  const header = options.expectedHeader
    ? [...options.expectedHeader]
    : options.allowKeyUnion
      ? collectUnionHeaderFromRows(parsedRows)
      : Object.keys(parsedRows[0] ?? {});
  if (header.length === 0) {
    throw new CliError(`JSON rows must contain at least one key: ${options.path}`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (!options.allowKeyUnion) {
    for (const row of parsedRows) {
      compareJsonlKeySets({
        baseline: header,
        candidate: Object.keys(row),
        label: "JSON",
        path: options.path,
      });
    }
  }

  return {
    dataRows: rowsToDataRows(parsedRows, header),
    header,
    path: options.path,
  };
}
