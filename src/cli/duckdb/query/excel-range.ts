import { CliError } from "../../errors";
import type { ExcelRangeParts } from "./types";

function columnNameToNumber(value: string): number {
  let result = 0;
  for (const character of value.toUpperCase()) {
    result = result * 26 + (character.charCodeAt(0) - 64);
  }
  return result;
}

export function normalizeExcelRange(value: string): string {
  const trimmed = value.trim();
  const match = /^([A-Za-z]+)([1-9][0-9]*):([A-Za-z]+)([1-9][0-9]*)$/.exec(trimmed);
  if (!match) {
    throw new CliError("--range must use A1:Z99 cell notation.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const startColumn = (match[1] ?? "").toUpperCase();
  const startRow = Number(match[2] ?? "");
  const endColumn = (match[3] ?? "").toUpperCase();
  const endRow = Number(match[4] ?? "");

  if (
    columnNameToNumber(startColumn) > columnNameToNumber(endColumn) ||
    startRow > endRow
  ) {
    throw new CliError("--range must start at the top-left cell of the selected rectangle.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  return `${startColumn}${startRow}:${endColumn}${endRow}`;
}

export function parseNormalizedExcelRange(value: string): ExcelRangeParts {
  const normalized = normalizeExcelRange(value);
  const match = /^([A-Z]+)([1-9][0-9]*):([A-Z]+)([1-9][0-9]*)$/.exec(normalized);
  if (!match) {
    throw new CliError("--range must use A1:Z99 cell notation.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  return {
    endColumn: match[3] ?? "",
    endRow: Number(match[4] ?? ""),
    startColumn: match[1] ?? "",
    startRow: Number(match[2] ?? ""),
  };
}

export function buildExcelRange(parts: ExcelRangeParts): string {
  return `${parts.startColumn}${parts.startRow}:${parts.endColumn}${parts.endRow}`;
}

export function normalizeExcelHeaderRow(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new CliError("--header-row must be a positive integer.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  return value;
}
