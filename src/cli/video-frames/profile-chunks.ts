import { deflateSync } from "node:zlib";
import { CliError } from "../errors";

export interface ImageProfile {
  icc: Buffer;
  width: number;
  height: number;
}

// Encoder metadata is small and bounded independently of the streamed image data.
export const MAX_PROFILE_BYTES = 1024 * 1024;
export function validateImageProfile(profile: ImageProfile): void {
  const { icc, width, height } = profile;
  if (
    icc.length < 128 ||
    icc.length > MAX_PROFILE_BYTES ||
    icc.readUInt32BE(0) !== icc.length ||
    icc.toString("ascii", 36, 40) !== "acsp" ||
    icc.toString("ascii", 16, 20) !== "RGB " ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 0x1000000 ||
    height > 0x1000000 ||
    width * height > 0xffffffff
  )
    throw new CliError("Invalid image color profile or dimensions.", {
      code: "FRAME_IMAGE_PROFILE",
    });
}

const crcTable = Uint32Array.from({ length: 256 }, (_, byte) => {
  let crc = byte;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
export function pngCrc(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
export function pngProfileChunk(icc: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from("Source color\0\0", "ascii"), deflateSync(icc)]);
  const chunk = Buffer.alloc(body.length + 12);
  chunk.writeUInt32BE(body.length);
  chunk.write("iCCP", 4, "ascii");
  body.copy(chunk, 8);
  chunk.writeUInt32BE(pngCrc(chunk.subarray(4, -4)), chunk.length - 4);
  return chunk;
}
export function jpegProfileSegments(icc: Buffer): Buffer[] {
  // APP2's 16-bit length includes its length field and the 14-byte ICC header.
  const partSize = 65519;
  const count = Math.ceil(icc.length / partSize);
  return Array.from({ length: count }, (_, index) => {
    const part = icc.subarray(index * partSize, (index + 1) * partSize);
    const segment = Buffer.alloc(part.length + 18);
    segment[0] = 255;
    segment[1] = 226;
    segment.writeUInt16BE(part.length + 16, 2);
    segment.write("ICC_PROFILE\0", 4, "ascii");
    segment[16] = index + 1;
    segment[17] = count;
    part.copy(segment, 18);
    return segment;
  });
}
export function webpProfileChunk(icc: Buffer): Buffer {
  const chunk = Buffer.alloc(8 + icc.length + (icc.length % 2));
  chunk.write("ICCP", 0, "ascii");
  chunk.writeUInt32LE(icc.length, 4);
  icc.copy(chunk, 8);
  return chunk;
}
export function webpExtendedChunk(profile: ImageProfile, alpha: boolean): Buffer {
  const chunk = Buffer.alloc(18);
  chunk.write("VP8X", 0, "ascii");
  chunk.writeUInt32LE(10, 4);
  chunk[8] = 32 | (alpha ? 16 : 0);
  chunk.writeUIntLE(profile.width - 1, 12, 3);
  chunk.writeUIntLE(profile.height - 1, 15, 3);
  return chunk;
}
