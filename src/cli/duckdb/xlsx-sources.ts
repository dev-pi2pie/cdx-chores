import { readFile } from "node:fs/promises";
import { posix as pathPosix } from "node:path";
import { inflateRawSync } from "node:zlib";

import { CliError } from "../errors";

interface ZipEntryMeta {
  compressionMethod: number;
  compressedSize: number;
  fileName: string;
  localHeaderOffset: number;
}

export interface XlsxSheetSnapshotCell {
  ref: string;
  value: string;
}

export interface XlsxSheetSnapshotRow {
  cellCount: number;
  cells: XlsxSheetSnapshotCell[];
  firstRef: string;
  lastRef: string;
  rowNumber: number;
}

export interface XlsxSheetSnapshot {
  mergedRanges: string[];
  mergedRangesTruncated: boolean;
  nonEmptyCellCount: number;
  nonEmptyRowCount: number;
  rows: XlsxSheetSnapshotRow[];
  rowsTruncated: boolean;
  sheetName: string;
  usedRange?: string;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const signature = 0x06054b50;
  const minimumSize = 22;
  const searchStart = Math.max(0, buffer.length - 0xffff - minimumSize);

  for (let index = buffer.length - minimumSize; index >= searchStart; index -= 1) {
    if (buffer.readUInt32LE(index) === signature) {
      return index;
    }
  }

  throw new CliError("Invalid .xlsx file: ZIP end-of-central-directory record not found.", {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

function readCentralDirectoryEntries(buffer: Buffer): ZipEntryMeta[] {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const entries: ZipEntryMeta[] = [];

  let offset = centralDirectoryOffset;
  const end = centralDirectoryOffset + centralDirectorySize;
  while (offset < end) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new CliError("Invalid .xlsx file: malformed ZIP central directory.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.toString("utf8", offset + 46, offset + 46 + fileNameLength);

    entries.push({
      compressionMethod,
      compressedSize,
      fileName,
      localHeaderOffset,
    });

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function extractZipEntry(buffer: Buffer, entry: ZipEntryMeta): Buffer {
  const localHeaderOffset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
    throw new CliError("Invalid .xlsx file: malformed ZIP local header.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const fileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const extraLength = buffer.readUInt16LE(localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + fileNameLength + extraLength;
  const compressedData = buffer.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return compressedData;
  }
  if (entry.compressionMethod === 8) {
    return inflateRawSync(compressedData);
  }

  throw new CliError(`Unsupported .xlsx ZIP compression method: ${entry.compressionMethod}`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

function decodeXmlEntities(value: string): string {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function extractXmlAttribute(attributes: string, attributeName: string): string | undefined {
  const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|\\s)${escapedName}\\s*=\\s*(['"])([\\s\\S]*?)\\1`).exec(attributes);
  return typeof match?.[2] === "string" ? decodeXmlEntities(match[2]) : undefined;
}

interface XlsxWorkbookPackage {
  buffer: Buffer;
  entries: ZipEntryMeta[];
}

interface XlsxWorkbookSheetEntry {
  name: string;
  targetPath: string;
}

async function readXlsxWorkbookPackage(inputPath: string): Promise<XlsxWorkbookPackage> {
  let buffer: Buffer;
  try {
    buffer = await readFile(inputPath);
  } catch (error) {
    throw new CliError(`Failed to read .xlsx workbook: ${inputPath} (${toErrorMessage(error)})`, {
      code: "FILE_READ_ERROR",
      exitCode: 2,
    });
  }

  return {
    buffer,
    entries: readCentralDirectoryEntries(buffer),
  };
}

function extractRequiredZipEntryText(
  buffer: Buffer,
  entries: readonly ZipEntryMeta[],
  fileName: string,
): string {
  const entry = entries.find((candidate) => candidate.fileName === fileName);
  if (!entry) {
    throw new CliError(`Invalid .xlsx file: missing ${fileName}.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return extractZipEntry(buffer, entry).toString("utf8");
}

function normalizeZipTargetPath(baseFileName: string, target: string): string {
  if (target.startsWith("/")) {
    return target.replace(/^\/+/, "");
  }
  return pathPosix.normalize(pathPosix.join(pathPosix.dirname(baseFileName), target));
}

function listWorkbookSheetEntries(pkg: XlsxWorkbookPackage): XlsxWorkbookSheetEntry[] {
  const workbookXml = extractRequiredZipEntryText(pkg.buffer, pkg.entries, "xl/workbook.xml");
  const workbookRelsXml = extractRequiredZipEntryText(
    pkg.buffer,
    pkg.entries,
    "xl/_rels/workbook.xml.rels",
  );

  const targetByRelationshipId = new Map(
    [...workbookRelsXml.matchAll(/<Relationship\b([^>]*)\/?>/g)]
      .map((match) => {
        const attributes = match[1] ?? "";
        const relationshipId = extractXmlAttribute(attributes, "Id")?.trim() ?? "";
        const target = extractXmlAttribute(attributes, "Target")?.trim() ?? "";
        return relationshipId && target
          ? ([relationshipId, normalizeZipTargetPath("xl/workbook.xml", target)] as const)
          : undefined;
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry)),
  );

  const sheets = [...workbookXml.matchAll(/<sheet\b([^>]*)\/?>/g)]
    .map((match) => {
      const attributes = match[1] ?? "";
      const name = extractXmlAttribute(attributes, "name")?.trim() ?? "";
      const relationshipId = extractXmlAttribute(attributes, "r:id")?.trim() ?? "";
      return name && relationshipId
        ? {
            name,
            relationshipId,
          }
        : undefined;
    })
    .filter(
      (
        entry,
      ): entry is {
        name: string;
        relationshipId: string;
      } => Boolean(entry),
    );

  const resolvedSheets = sheets.map((sheet) => ({
    name: sheet.name,
    targetPath: targetByRelationshipId.get(sheet.relationshipId) ?? "",
  }));

  if (resolvedSheets.length === 0 || resolvedSheets.some((sheet) => sheet.targetPath.length === 0)) {
    throw new CliError("Invalid .xlsx file: failed to resolve worksheet metadata.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  return resolvedSheets;
}

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
    return Number.isInteger(index) && index >= 0
      ? options.sharedStrings[index]
      : undefined;
  }

  const decoded = decodeXmlEntities(rawValue);
  return decoded.trim().length > 0 ? decoded : undefined;
}

function parseSharedStrings(pkg: XlsxWorkbookPackage): string[] {
  const sharedStringsEntry = pkg.entries.find((entry) => entry.fileName === "xl/sharedStrings.xml");
  if (!sharedStringsEntry) {
    return [];
  }

  const xml = extractZipEntry(pkg.buffer, sharedStringsEntry).toString("utf8");
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) => {
    const body = match[1] ?? "";
    return [...body.matchAll(/<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/g)]
      .map((textMatch) => decodeXmlEntities(textMatch[1] ?? ""))
      .join("");
  });
}

export async function listXlsxSheetNames(inputPath: string): Promise<string[]> {
  try {
    const pkg = await readXlsxWorkbookPackage(inputPath);
    const sheets = listWorkbookSheetEntries(pkg).map((sheet) => sheet.name);
    if (sheets.length === 0) {
      throw new CliError("No worksheet sources found in the .xlsx workbook.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    return sheets;
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    throw new CliError(`Invalid .xlsx file: failed to read workbook metadata (${toErrorMessage(error)}).`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
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
      for (const cellMatch of rowXml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
        const attributes = cellMatch[1] ?? "";
        const cellXml = cellMatch[2] ?? "";
        const ref = /(?:^|\s)r="([^"]+)"/.exec(attributes)?.[1]?.trim() ?? "";
        if (!ref) {
          continue;
        }
        const refMatch = /^([A-Z]+)([1-9][0-9]*)$/i.exec(ref);
        if (!refMatch) {
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

        minColumnNumber = minColumnNumber === undefined ? columnNumber : Math.min(minColumnNumber, columnNumber);
        maxColumnNumber = maxColumnNumber === undefined ? columnNumber : Math.max(maxColumnNumber, columnNumber);
        minRowNumber = minRowNumber === undefined ? rowNumber : Math.min(minRowNumber, rowNumber);
        maxRowNumber = maxRowNumber === undefined ? rowNumber : Math.max(maxRowNumber, rowNumber);
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
    throw new CliError(`Invalid .xlsx file: failed to inspect worksheet data (${toErrorMessage(error)}).`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
}
