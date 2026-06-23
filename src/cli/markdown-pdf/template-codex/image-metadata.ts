import { readFile } from "node:fs/promises";
import { extname } from "node:path";

import type { MarkdownPdfTemplateCodexCoverImageDimensions } from "./types";

export type MarkdownPdfTemplateCodexCoverImageFormat = "jpeg" | "png" | "webp";

export const SUPPORTED_TEMPLATE_CODEX_COVER_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

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
  return width > 0 && height > 0 ? { width, height } : undefined;
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
      return width > 0 && height > 0 ? { width, height } : undefined;
    }
    offset += 2 + segmentLength;
  }
  return undefined;
}

function readWebpDimensions(
  bytes: Uint8Array,
): MarkdownPdfTemplateCodexCoverImageDimensions | undefined {
  if (
    bytes.length < 30 ||
    Buffer.from(bytes.subarray(0, 4)).toString("ascii") !== "RIFF" ||
    Buffer.from(bytes.subarray(8, 12)).toString("ascii") !== "WEBP"
  ) {
    return undefined;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkType = Buffer.from(bytes.subarray(offset, offset + 4)).toString("ascii");
    const chunkSize = view.getUint32(offset + 4, true);
    const dataOffset = offset + 8;
    if (dataOffset + chunkSize > bytes.length) {
      return undefined;
    }

    if (chunkType === "VP8X" && chunkSize >= 10) {
      const width =
        1 + bytes[dataOffset + 4]! + (bytes[dataOffset + 5]! << 8) + (bytes[dataOffset + 6]! << 16);
      const height =
        1 + bytes[dataOffset + 7]! + (bytes[dataOffset + 8]! << 8) + (bytes[dataOffset + 9]! << 16);
      return width > 0 && height > 0 ? { width, height } : undefined;
    }
    if (chunkType === "VP8 " && chunkSize >= 10) {
      const width = view.getUint16(dataOffset + 6, true) & 0x3fff;
      const height = view.getUint16(dataOffset + 8, true) & 0x3fff;
      return width > 0 && height > 0 ? { width, height } : undefined;
    }
    if (chunkType === "VP8L" && chunkSize >= 5 && bytes[dataOffset] === 0x2f) {
      const b1 = bytes[dataOffset + 1]!;
      const b2 = bytes[dataOffset + 2]!;
      const b3 = bytes[dataOffset + 3]!;
      const b4 = bytes[dataOffset + 4]!;
      const width = 1 + (((b2 & 0x3f) << 8) | b1);
      const height = 1 + ((b4 << 6) | (b3 >> 2) | ((b2 & 0xc0) << 6));
      return width > 0 && height > 0 ? { width, height } : undefined;
    }

    offset = dataOffset + chunkSize + (chunkSize % 2);
  }
  return undefined;
}

export async function readTemplateCodexCoverImageDimensions(
  path: string,
  format: MarkdownPdfTemplateCodexCoverImageFormat | undefined,
): Promise<MarkdownPdfTemplateCodexCoverImageDimensions | undefined> {
  try {
    const bytes = new Uint8Array(await readFile(path));
    if (format === "png") {
      return readPngDimensions(bytes);
    }
    if (format === "jpeg") {
      return readJpegDimensions(bytes);
    }
    if (format === "webp") {
      return readWebpDimensions(bytes);
    }
  } catch {
    return undefined;
  }
  return undefined;
}
