import { inflateRawSync } from "node:zlib";

import { CliError } from "../../errors";
import type { ZipEntryMeta } from "./types";

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

export function readCentralDirectoryEntries(buffer: Buffer): ZipEntryMeta[] {
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

export function extractZipEntry(buffer: Buffer, entry: ZipEntryMeta): Buffer {
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

export function extractRequiredZipEntryText(
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
