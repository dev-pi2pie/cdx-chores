import { stat } from "node:fs/promises";

export function minimalPng(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47], 0);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

export function minimalJpeg(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(21);
  bytes.set([0xff, 0xd8, 0xff, 0xc0], 0);
  bytes.writeUInt16BE(17, 4);
  bytes[6] = 8;
  bytes.writeUInt16BE(height, 7);
  bytes.writeUInt16BE(width, 9);
  return bytes;
}

const WEBP_FILE_HEADER_LENGTH = 12;
const WEBP_CHUNK_HEADER_LENGTH = 8;
const WEBP_CHUNK_SIZE_OFFSET = 4;

export function minimalWebpWithChunks(
  chunks: Array<{ type: string; payload: Buffer }>,
  riffSignature = "RIFF",
  webpSignature = "WEBP",
): Buffer {
  const chunkBytes = chunks.map(({ type, payload }) => {
    const bytes = Buffer.alloc(WEBP_CHUNK_HEADER_LENGTH + payload.length + (payload.length % 2));
    bytes.write(type, 0, "ascii");
    bytes.writeUInt32LE(payload.length, WEBP_CHUNK_SIZE_OFFSET);
    payload.copy(bytes, WEBP_CHUNK_HEADER_LENGTH);
    return bytes;
  });
  const bytes = Buffer.concat([Buffer.alloc(WEBP_FILE_HEADER_LENGTH), ...chunkBytes]);
  bytes.write(riffSignature, 0, "ascii");
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write(webpSignature, 8, "ascii");
  return bytes;
}

export function minimalWebpVp8xSquare1200(): Buffer {
  // VP8X canvas fields store 1199x1199 for a 1200x1200 image.
  return minimalWebpWithChunks([
    { type: "VP8X", payload: Buffer.from([0, 0, 0, 0, 0xaf, 0x04, 0, 0xaf, 0x04, 0]) },
  ]);
}

export function minimalWebpVp8x1200By800(): Buffer {
  // VP8X canvas fields store 1199x799 for a 1200x800 image.
  return minimalWebpWithChunks([
    { type: "VP8X", payload: Buffer.from([0, 0, 0, 0, 0xaf, 0x04, 0, 0x1f, 0x03, 0]) },
  ]);
}

export function minimalWebpVp8x900By300Payload(): Buffer {
  // VP8X canvas fields store 899x299 for a 900x300 image.
  return Buffer.from([0, 0, 0, 0, 0x83, 0x03, 0, 0x2b, 0x01, 0]);
}

export function minimalWebpVp8Lossy640By480(): Buffer {
  // VP8 lossy frame header stores direct 640x480 dimensions at payload offsets 6 and 8.
  return minimalWebpWithChunks([
    { type: "VP8 ", payload: Buffer.from([0, 0, 0, 0, 0, 0, 0x80, 0x02, 0xe0, 0x01]) },
  ]);
}

export function minimalWebpVp8lLossless321By654(): Buffer {
  // VP8L stores 320x653 as packed 14-bit values after the 0x2f lossless signature.
  return minimalWebpWithChunks([
    { type: "VP8L", payload: Buffer.from([0x2f, 0x40, 0x41, 0xa3, 0]) },
  ]);
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
