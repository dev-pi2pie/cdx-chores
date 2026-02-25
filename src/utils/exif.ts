import { readFile } from "node:fs/promises";

const EXIF_SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".tif", ".tiff", ".png", ".webp"]);

const TIFF_TAG_DATE_TIME = 0x0132;
const TIFF_TAG_EXIF_IFD_POINTER = 0x8769;
const EXIF_TAG_DATE_TIME_ORIGINAL = 0x9003;
const EXIF_TAG_DATE_TIME_DIGITIZED = 0x9004;

interface TiffView {
  bytes: Uint8Array;
  littleEndian: boolean;
}

function parseExifDateTimeString(value: string): string | undefined {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 0) {
    end -= 1;
  }
  const trimmed = value.slice(0, end).trim();
  const match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(trimmed);
  if (!match) {
    return undefined;
  }

  const [, year, month, day, hour, minute, second] = match;
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function readU16(view: TiffView, offset: number): number | undefined {
  if (offset < 0 || offset + 2 > view.bytes.length) {
    return undefined;
  }
  const data = new DataView(view.bytes.buffer, view.bytes.byteOffset, view.bytes.byteLength);
  return data.getUint16(offset, view.littleEndian);
}

function readU32(view: TiffView, offset: number): number | undefined {
  if (offset < 0 || offset + 4 > view.bytes.length) {
    return undefined;
  }
  const data = new DataView(view.bytes.buffer, view.bytes.byteOffset, view.bytes.byteLength);
  return data.getUint32(offset, view.littleEndian);
}

function readAsciiTagValue(
  view: TiffView,
  valueType: number,
  count: number,
  valueOrOffsetFieldOffset: number,
): string | undefined {
  if (valueType !== 2 || count <= 0) {
    return undefined;
  }

  let dataOffset = valueOrOffsetFieldOffset;
  let dataLength = count;
  if (count > 4) {
    const pointedOffset = readU32(view, valueOrOffsetFieldOffset);
    if (pointedOffset === undefined) {
      return undefined;
    }
    dataOffset = pointedOffset;
  }

  if (dataOffset < 0 || dataOffset + dataLength > view.bytes.length) {
    return undefined;
  }

  const bytes = view.bytes.subarray(dataOffset, dataOffset + dataLength);
  return Buffer.from(bytes).toString("ascii");
}

function parseIfd(
  view: TiffView,
  ifdOffset: number,
):
  | {
      tags: Map<number, string>;
      exifIfdOffset?: number;
    }
  | undefined {
  const entryCount = readU16(view, ifdOffset);
  if (entryCount === undefined) {
    return undefined;
  }

  const tags = new Map<number, string>();
  let exifIfdOffset: number | undefined;
  let cursor = ifdOffset + 2;

  for (let i = 0; i < entryCount; i += 1) {
    const tag = readU16(view, cursor);
    const valueType = readU16(view, cursor + 2);
    const count = readU32(view, cursor + 4);
    if (tag === undefined || valueType === undefined || count === undefined) {
      return undefined;
    }

    if (tag === TIFF_TAG_EXIF_IFD_POINTER && valueType === 4 && count >= 1) {
      exifIfdOffset = readU32(view, cursor + 8);
    }

    if (
      tag === TIFF_TAG_DATE_TIME ||
      tag === EXIF_TAG_DATE_TIME_ORIGINAL ||
      tag === EXIF_TAG_DATE_TIME_DIGITIZED
    ) {
      const raw = readAsciiTagValue(view, valueType, count, cursor + 8);
      if (raw) {
        tags.set(tag, raw);
      }
    }

    cursor += 12;
  }

  return { tags, exifIfdOffset };
}

function extractExifTimestampFromTiffBytes(tiffBytes: Uint8Array): string | undefined {
  if (tiffBytes.length < 8) {
    return undefined;
  }

  const b0 = tiffBytes[0];
  const b1 = tiffBytes[1];
  const littleEndian = b0 === 0x49 && b1 === 0x49;
  const bigEndian = b0 === 0x4d && b1 === 0x4d;
  if (!littleEndian && !bigEndian) {
    return undefined;
  }

  const view: TiffView = { bytes: tiffBytes, littleEndian };
  const magic = readU16(view, 2);
  if (magic !== 42) {
    return undefined;
  }

  const ifd0Offset = readU32(view, 4);
  if (ifd0Offset === undefined) {
    return undefined;
  }

  const ifd0 = parseIfd(view, ifd0Offset);
  if (!ifd0) {
    return undefined;
  }

  const exifIfd = ifd0.exifIfdOffset !== undefined ? parseIfd(view, ifd0.exifIfdOffset) : undefined;
  const rawDateTime =
    exifIfd?.tags.get(EXIF_TAG_DATE_TIME_ORIGINAL) ??
    exifIfd?.tags.get(EXIF_TAG_DATE_TIME_DIGITIZED) ??
    ifd0.tags.get(TIFF_TAG_DATE_TIME);

  if (!rawDateTime) {
    return undefined;
  }

  return parseExifDateTimeString(rawDateTime);
}

function extractExifTimestampFromJpegBytes(bytes: Uint8Array): string | undefined {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return undefined;
  }

  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      return undefined;
    }

    const marker = bytes[offset + 1];
    offset += 2;

    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    if (offset + 2 > bytes.length) {
      return undefined;
    }
    const lengthHi = bytes[offset];
    const lengthLo = bytes[offset + 1];
    if (lengthHi === undefined || lengthLo === undefined) {
      return undefined;
    }
    const segmentLength = (lengthHi << 8) | lengthLo;
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      return undefined;
    }

    if (marker === 0xe1) {
      const segmentStart = offset + 2;
      const segmentData = bytes.subarray(segmentStart, offset + segmentLength);
      if (
        segmentData.length >= 6 &&
        segmentData[0] === 0x45 && // E
        segmentData[1] === 0x78 && // x
        segmentData[2] === 0x69 && // i
        segmentData[3] === 0x66 && // f
        segmentData[4] === 0x00 &&
        segmentData[5] === 0x00
      ) {
        return extractExifTimestampFromTiffBytes(segmentData.subarray(6));
      }
    }

    offset += segmentLength;
  }

  return undefined;
}

function extractExifTimestampFromPngBytes(bytes: Uint8Array): string | undefined {
  const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < PNG_SIGNATURE.length) {
    return undefined;
  }
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      return undefined;
    }
  }

  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const length = dv.getUint32(offset, false);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcEnd = dataEnd + 4;
    if (crcEnd > bytes.length) {
      return undefined;
    }

    const chunkType = Buffer.from(bytes.subarray(typeStart, typeStart + 4)).toString("ascii");
    if (chunkType === "eXIf") {
      return extractExifTimestampFromTiffBytes(bytes.subarray(dataStart, dataEnd));
    }
    if (chunkType === "IEND") {
      break;
    }

    offset = crcEnd;
  }

  return undefined;
}

function extractExifTimestampFromWebpBytes(bytes: Uint8Array): string | undefined {
  if (bytes.length < 12) {
    return undefined;
  }

  const riff = Buffer.from(bytes.subarray(0, 4)).toString("ascii");
  const webp = Buffer.from(bytes.subarray(8, 12)).toString("ascii");
  if (riff !== "RIFF" || webp !== "WEBP") {
    return undefined;
  }

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkType = Buffer.from(bytes.subarray(offset, offset + 4)).toString("ascii");
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const chunkSize = dv.getUint32(offset + 4, true);
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkSize;
    if (dataEnd > bytes.length) {
      return undefined;
    }

    if (chunkType === "EXIF") {
      const chunkData = bytes.subarray(dataStart, dataEnd);
      const hasExifHeader =
        chunkData.length >= 6 &&
        chunkData[0] === 0x45 &&
        chunkData[1] === 0x78 &&
        chunkData[2] === 0x69 &&
        chunkData[3] === 0x66 &&
        chunkData[4] === 0x00 &&
        chunkData[5] === 0x00;
      return extractExifTimestampFromTiffBytes(hasExifHeader ? chunkData.subarray(6) : chunkData);
    }

    offset = dataEnd + (chunkSize % 2);
  }

  return undefined;
}

export async function readPreferredImageTimestampFromExif(
  path: string,
  extensionLowercase: string,
): Promise<string | undefined> {
  if (!EXIF_SUPPORTED_EXTENSIONS.has(extensionLowercase)) {
    return undefined;
  }

  try {
    const bytes = new Uint8Array(await readFile(path));
    if (extensionLowercase === ".jpg" || extensionLowercase === ".jpeg") {
      return extractExifTimestampFromJpegBytes(bytes);
    }
    if (extensionLowercase === ".png") {
      return extractExifTimestampFromPngBytes(bytes);
    }
    if (extensionLowercase === ".webp") {
      return extractExifTimestampFromWebpBytes(bytes);
    }
    return extractExifTimestampFromTiffBytes(bytes);
  } catch {
    return undefined;
  }
}
