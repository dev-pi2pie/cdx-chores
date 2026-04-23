import { CliError } from "../errors";

interface ParsedJsonlStackSource {
  dataRows: unknown[][];
  header: string[];
  path: string;
}

function validateJsonlRowObject(
  value: unknown,
  path: string,
  lineNumber: number,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CliError(`JSONL rows must be JSON objects: ${path} (line ${lineNumber}).`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return value as Record<string, unknown>;
}

function compareJsonlKeySets(options: {
  baseline: readonly string[];
  candidate: readonly string[];
  path: string;
}): void {
  const baselineSorted = [...options.baseline].sort();
  const candidateSorted = [...options.candidate].sort();
  if (
    baselineSorted.length !== candidateSorted.length ||
    baselineSorted.some((value, index) => value !== candidateSorted[index])
  ) {
    throw new CliError(
      `JSONL key mismatch for ${options.path}. Expected keys ${baselineSorted.join(", ")} but received ${candidateSorted.join(", ")}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
}

export function parseJsonlStackSourceText(options: {
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
    : Object.keys(parsedRows[0] ?? {});
  if (header.length === 0) {
    throw new CliError(`JSONL rows must contain at least one key: ${options.path}`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const dataRows = parsedRows.map((row) => {
    compareJsonlKeySets({
      baseline: header,
      candidate: Object.keys(row),
      path: options.path,
    });
    return header.map((key) => row[key]);
  });

  return {
    dataRows,
    header,
    path: options.path,
  };
}
