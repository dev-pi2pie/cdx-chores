import { readFile } from "node:fs/promises";
import { extname } from "node:path";

import type { MarkdownPdfTemplateCodexCoverImageDimensions } from "./types";

export type MarkdownPdfTemplateCodexCoverImageFormat = "jpeg" | "png" | "webp";

export type MarkdownPdfTemplateCodexCoverImageMetadataResult =
  | {
      status: "parsed";
      dimensions: MarkdownPdfTemplateCodexCoverImageDimensions;
    }
  | {
      status: "unparsed" | "unreadable" | "unsupported-format";
    };

export const SUPPORTED_TEMPLATE_CODEX_COVER_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

const WEBP_FILE_HEADER_LENGTH = 12;
const WEBP_CHUNK_HEADER_LENGTH = 8;
const WEBP_VP8X_CHUNK_MIN_SIZE = 10;
const WEBP_VP8_CHUNK_MIN_SIZE = 10;
const WEBP_VP8L_CHUNK_MIN_SIZE = 5;
const WEBP_VP8X_CANVAS_WIDTH_OFFSET = 4;
const WEBP_VP8X_CANVAS_HEIGHT_OFFSET = 7;
const WEBP_VP8_FRAME_WIDTH_OFFSET = 6;
const WEBP_VP8_FRAME_HEIGHT_OFFSET = 8;
const WEBP_VP8_FRAME_DIMENSION_MASK = 0x3fff;
const WEBP_VP8L_SIGNATURE = 0x2f;

export function imageFormatForPath(
  path: string,
): MarkdownPdfTemplateCodexCoverImageFormat | undefined {
  const extension = extname(path).toLowerCase();
  if (extension === ".png") {
    return "png";
  }
  if (extension === ".webp") {
    return "webp";
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return "jpeg";
  }
  return undefined;
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  return Buffer.from(bytes.subarray(offset, offset + length)).toString("ascii");
}

function readUint24LittleEndian(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! + (bytes[offset + 1]! << 8) + (bytes[offset + 2]! << 16);
}

function dimensionsIfPositive(
  width: number,
  height: number,
): MarkdownPdfTemplateCodexCoverImageDimensions | undefined {
  return width > 0 && height > 0 ? { width, height } : undefined;
}

function readPngDimensions(
  bytes: Uint8Array,
): MarkdownPdfTemplateCodexCoverImageDimensions | undefined {
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return undefined;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return dimensionsIfPositive(width, height);
}

function readJpegDimensions(
  bytes: Uint8Array,
): MarkdownPdfTemplateCodexCoverImageDimensions | undefined {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return undefined;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === undefined || marker === 0xd9 || marker === 0xda) {
      return undefined;
    }
    const segmentLength = view.getUint16(offset + 2, false);
    if (segmentLength < 2 || offset + 2 + segmentLength > bytes.length) {
      return undefined;
    }
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame) {
      const height = view.getUint16(offset + 5, false);
      const width = view.getUint16(offset + 7, false);
      return dimensionsIfPositive(width, height);
    }
    offset += 2 + segmentLength;
  }
  return undefined;
}

function readWebpVp8xDimensions(
  bytes: Uint8Array,
  dataOffset: number,
): MarkdownPdfTemplateCodexCoverImageDimensions | undefined {
  // VP8X stores canvas dimensions as 24-bit little-endian values minus one.
  const width = 1 + readUint24LittleEndian(bytes, dataOffset + WEBP_VP8X_CANVAS_WIDTH_OFFSET);
  const height = 1 + readUint24LittleEndian(bytes, dataOffset + WEBP_VP8X_CANVAS_HEIGHT_OFFSET);
  return dimensionsIfPositive(width, height);
}

function readWebpVp8Dimensions(
  view: DataView,
  dataOffset: number,
): MarkdownPdfTemplateCodexCoverImageDimensions | undefined {
  // VP8 frame headers store 14-bit width and height values in little-endian fields.
  const width =
    view.getUint16(dataOffset + WEBP_VP8_FRAME_WIDTH_OFFSET, true) & WEBP_VP8_FRAME_DIMENSION_MASK;
  const height =
    view.getUint16(dataOffset + WEBP_VP8_FRAME_HEIGHT_OFFSET, true) & WEBP_VP8_FRAME_DIMENSION_MASK;
  return dimensionsIfPositive(width, height);
}

function readWebpVp8lDimensions(
  bytes: Uint8Array,
  dataOffset: number,
): MarkdownPdfTemplateCodexCoverImageDimensions | undefined {
  if (bytes[dataOffset] !== WEBP_VP8L_SIGNATURE) {
    return undefined;
  }

  // VP8L packs width and height across four bytes after the lossless signature.
  const b1 = bytes[dataOffset + 1]!;
  const b2 = bytes[dataOffset + 2]!;
  const b3 = bytes[dataOffset + 3]!;
  const b4 = bytes[dataOffset + 4]!;
  const width = 1 + (((b2 & 0x3f) << 8) | b1);
  const height = 1 + ((b4 << 6) | (b3 >> 2) | ((b2 & 0xc0) << 6));
  return dimensionsIfPositive(width, height);
}

function readWebpDimensions(
  bytes: Uint8Array,
): MarkdownPdfTemplateCodexCoverImageDimensions | undefined {
  if (bytes.length < 30 || readAscii(bytes, 0, 4) !== "RIFF" || readAscii(bytes, 8, 4) !== "WEBP") {
    return undefined;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = WEBP_FILE_HEADER_LENGTH;
  while (offset + WEBP_CHUNK_HEADER_LENGTH <= bytes.length) {
    const chunkType = readAscii(bytes, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const dataOffset = offset + WEBP_CHUNK_HEADER_LENGTH;
    if (dataOffset + chunkSize > bytes.length) {
      return undefined;
    }

    if (chunkType === "VP8X" && chunkSize >= WEBP_VP8X_CHUNK_MIN_SIZE) {
      return readWebpVp8xDimensions(bytes, dataOffset);
    }
    if (chunkType === "VP8 " && chunkSize >= WEBP_VP8_CHUNK_MIN_SIZE) {
      return readWebpVp8Dimensions(view, dataOffset);
    }
    if (chunkType === "VP8L" && chunkSize >= WEBP_VP8L_CHUNK_MIN_SIZE) {
      return readWebpVp8lDimensions(bytes, dataOffset);
    }

    offset = dataOffset + chunkSize + (chunkSize % 2);
  }
  return undefined;
}

export async function readTemplateCodexCoverImageMetadata(
  path: string,
  format: MarkdownPdfTemplateCodexCoverImageFormat | undefined,
): Promise<MarkdownPdfTemplateCodexCoverImageMetadataResult> {
  if (!format) {
    return { status: "unsupported-format" };
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await readFile(path));
  } catch {
    return { status: "unreadable" };
  }

  const dimensions =
    format === "png"
      ? readPngDimensions(bytes)
      : format === "jpeg"
        ? readJpegDimensions(bytes)
        : readWebpDimensions(bytes);
  if (!dimensions) {
    return { status: "unparsed" };
  }
  return { status: "parsed", dimensions };
}
