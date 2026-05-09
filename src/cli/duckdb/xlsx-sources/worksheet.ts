import { CliError } from "../../errors";
import { toErrorMessage } from "./errors";
import type { XlsxSheetSnapshot, XlsxSheetSnapshotCell } from "./types";
import { listWorkbookSheetEntries, parseSharedStrings, readXlsxWorkbookPackage } from "./workbook";
import { decodeXmlEntities } from "./xml";
import { extractRequiredZipEntryText } from "./zip";

function columnLabelToNumber(label: string): number {
  let result = 0;
  for (const character of label.toUpperCase()) {
    result = result * 26 + (character.charCodeAt(0) - 64);
  }
  return result;
}

function columnNumberToLabel(value: number): string {
  let current = value;
  let result = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

function extractCellValue(options: {
  cellXml: string;
  sharedStrings: readonly string[];
  type?: string;
}): string | undefined {
  if (options.type === "inlineStr") {
    const textParts = [...options.cellXml.matchAll(/<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/g)].map(
      (match) => decodeXmlEntities(match[1] ?? ""),
    );
    const value = textParts.join("");
    return value.trim().length > 0 ? value : undefined;
  }

  const rawValue = options.cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1];
  if (rawValue === undefined) {
    return undefined;
  }

  if (options.type === "s") {
    const index = Number(rawValue);
    return Number.isInteger(index) && index >= 0 ? options.sharedStrings[index] : undefined;
  }

  const decoded = decodeXmlEntities(rawValue);
  return decoded.trim().length > 0 ? decoded : undefined;
}

function appendWorksheetCell(
  rowMap: Map<number, XlsxSheetSnapshotCell[]>,
  ref: string,
  value: string,
):
  | {
      columnNumber: number;
      rowNumber: number;
    }
  | undefined {
  const refMatch = /^([A-Z]+)([1-9][0-9]*)$/i.exec(ref);
  if (!refMatch) {
    return undefined;
  }

  const columnLabel = (refMatch[1] ?? "").toUpperCase();
  const rowNumber = Number(refMatch[2] ?? "");
  const columnNumber = columnLabelToNumber(columnLabel);
  const existingCells = rowMap.get(rowNumber);
  const cell = { ref: `${columnLabel}${rowNumber}`, value };

  if (existingCells) {
    existingCells.push(cell);
  } else {
    rowMap.set(rowNumber, [cell]);
  }

  return { columnNumber, rowNumber };
}

export async function collectXlsxSheetSnapshot(
  inputPath: string,
  sheetName: string,
  options: {
    maxCellsPerRow?: number;
    maxMergedRanges?: number;
    maxRows?: number;
  } = {},
): Promise<XlsxSheetSnapshot> {
  const maxRows = options.maxRows ?? 24;
  const maxCellsPerRow = options.maxCellsPerRow ?? 8;
  const maxMergedRanges = options.maxMergedRanges ?? 12;

  try {
    const pkg = await readXlsxWorkbookPackage(inputPath);
    const sheet = listWorkbookSheetEntries(pkg).find((entry) => entry.name === sheetName);
    if (!sheet) {
      throw new CliError(`Unknown Excel source: ${sheetName}.`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }

    const worksheetXml = extractRequiredZipEntryText(pkg.buffer, pkg.entries, sheet.targetPath);
    const sharedStrings = parseSharedStrings(pkg);

    const rowMap = new Map<number, XlsxSheetSnapshotCell[]>();
    let minColumnNumber: number | undefined;
    let maxColumnNumber: number | undefined;
    let minRowNumber: number | undefined;
    let maxRowNumber: number | undefined;
    let nonEmptyCellCount = 0;

    for (const rowMatch of worksheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const rowXml = rowMatch[1] ?? "";
      for (const cellMatch of rowXml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attributes = cellMatch[1] ?? "";
        const cellXml = cellMatch[2] ?? "";
        const ref = /(?:^|\s)r="([^"]+)"/.exec(attributes)?.[1]?.trim() ?? "";
        if (!ref) {
          continue;
        }

        const value = extractCellValue({
          cellXml,
          sharedStrings,
          type: /(?:^|\s)t="([^"]+)"/.exec(attributes)?.[1]?.trim(),
        });
        if (!value) {
          continue;
        }

        const position = appendWorksheetCell(rowMap, ref, value);
        if (!position) {
          continue;
        }

        minColumnNumber =
          minColumnNumber === undefined
            ? position.columnNumber
            : Math.min(minColumnNumber, position.columnNumber);
        maxColumnNumber =
          maxColumnNumber === undefined
            ? position.columnNumber
            : Math.max(maxColumnNumber, position.columnNumber);
        minRowNumber =
          minRowNumber === undefined
            ? position.rowNumber
            : Math.min(minRowNumber, position.rowNumber);
        maxRowNumber =
          maxRowNumber === undefined
            ? position.rowNumber
            : Math.max(maxRowNumber, position.rowNumber);
        nonEmptyCellCount += 1;
      }
    }

    const sortedRows = [...rowMap.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([rowNumber, cells]) => {
        const sortedCells = [...cells].sort((left, right) => {
          const leftColumn = /^([A-Z]+)/i.exec(left.ref)?.[1] ?? "A";
          const rightColumn = /^([A-Z]+)/i.exec(right.ref)?.[1] ?? "A";
          return columnLabelToNumber(leftColumn) - columnLabelToNumber(rightColumn);
        });
        return {
          cellCount: sortedCells.length,
          cells: sortedCells.slice(0, maxCellsPerRow),
          firstRef: sortedCells[0]?.ref ?? `${rowNumber}`,
          lastRef: sortedCells[sortedCells.length - 1]?.ref ?? `${rowNumber}`,
          rowNumber,
        };
      });

    const mergedRanges = [...worksheetXml.matchAll(/<mergeCell\b[^>]*\bref="([^"]+)"/g)].map(
      (match) => match[1] ?? "",
    );

    return {
      mergedRanges: mergedRanges.slice(0, maxMergedRanges),
      mergedRangesTruncated: mergedRanges.length > maxMergedRanges,
      nonEmptyCellCount,
      nonEmptyRowCount: sortedRows.length,
      rows: sortedRows.slice(0, maxRows),
      rowsTruncated: sortedRows.length > maxRows,
      sheetName,
      ...(minColumnNumber !== undefined &&
      maxColumnNumber !== undefined &&
      minRowNumber !== undefined &&
      maxRowNumber !== undefined
        ? {
            usedRange: `${columnNumberToLabel(minColumnNumber)}${minRowNumber}:${columnNumberToLabel(maxColumnNumber)}${maxRowNumber}`,
          }
        : {}),
    };
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    throw new CliError(
      `Invalid .xlsx file: failed to inspect worksheet data (${toErrorMessage(error)}).`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
}
