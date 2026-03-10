import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

import { CliError } from "../errors";

interface ZipEntryMeta {
  compressionMethod: number;
  compressedSize: number;
  fileName: string;
  localHeaderOffset: number;
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

export async function listXlsxSheetNames(inputPath: string): Promise<string[]> {
  let buffer: Buffer;
  try {
    buffer = await readFile(inputPath);
  } catch (error) {
    throw new CliError(`Failed to read .xlsx workbook: ${inputPath} (${toErrorMessage(error)})`, {
      code: "FILE_READ_ERROR",
      exitCode: 2,
    });
  }

  const entries = readCentralDirectoryEntries(buffer);
  const workbookEntry = entries.find((entry) => entry.fileName === "xl/workbook.xml");
  if (!workbookEntry) {
    throw new CliError("Invalid .xlsx file: missing xl/workbook.xml.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const workbookXml = extractZipEntry(buffer, workbookEntry).toString("utf8");
  const sheets = [...workbookXml.matchAll(/<sheet\b[^>]*\bname="([^"]+)"/g)].map((match) =>
    decodeXmlEntities(match[1] ?? ""),
  );

  if (sheets.length === 0) {
    throw new CliError("No worksheet sources found in the .xlsx workbook.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  return sheets;
}
