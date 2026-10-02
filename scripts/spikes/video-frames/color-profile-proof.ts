// Independent synthetic profile/container references. Never imported by production.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { deflateSync, inflateSync } from "node:zlib";

export type Transfer = "bt709" | "iec61966-2-1";

// ICC v4 matrix/shaper image reference. BT.709 selects the bounded CoreMedia709 model.
// Gamma is independently observed in the native CoreMedia709 ICC by the display-reference proof.
// Tag layout: https://www.color.org/specification/ICC.1-2022-05.pdf
// Colorants: D50-adapted BT.709/sRGB, independently inspected through inverse chad.
export function referenceProfile(transfer: Transfer): Buffer {
  const xyz = (values: number[]) => typed("XYZ ", values);
  const mluc = (text: string) => {
    const value = Buffer.from(text, "utf16le");
    value.swap16();
    const result = Buffer.alloc(28 + value.length);
    result.write("mluc");
    result.writeUInt32BE(1, 8);
    result.writeUInt32BE(12, 12);
    result.write("enUS", 16);
    result.writeUInt32BE(value.length, 20);
    result.writeUInt32BE(28, 24);
    value.copy(result, 28);
    return result;
  };
  const coefficients =
    transfer === "bt709" ? [502 / 256] : [2.4, 1 / 1.055, 1 - 1 / 1.055, 1 / 12.92, 0.04045];
  const curve = Buffer.alloc(12 + coefficients.length * 4);
  curve.write("para");
  curve.writeUInt16BE(transfer === "bt709" ? 0 : 3, 8);
  coefficients.forEach((value, i) => curve.writeInt32BE(Math.round(value * 65536), 12 + i * 4));
  const tags: [string, Buffer][] = [
    [
      "desc",
      mluc(
        `BT.709 primaries / ${transfer === "bt709" ? "CoreMedia709" : "sRGB"} image interpretation`,
      ),
    ],
    ["cprt", mluc("Synthetic verification profile. Public domain.")],
    ["wtpt", xyz([0.9642, 1, 0.8249])],
    [
      "chad",
      typed(
        "sf32",
        [
          1.0479298, 0.0229468, -0.0501922, 0.0296278, 0.9904345, -0.0170738, -0.009243, 0.0150552,
          0.7518743,
        ],
      ),
    ],
    ["rXYZ", xyz([0.4360747, 0.2225045, 0.0139322])],
    ["gXYZ", xyz([0.3850649, 0.7168786, 0.0971045])],
    ["bXYZ", xyz([0.1430804, 0.0606169, 0.7141733])],
    ["rTRC", curve],
    ["gTRC", curve],
    ["bTRC", curve],
  ];
  let offset = 132 + 12 * tags.length;
  const header = Buffer.alloc(offset);
  header.writeUInt32BE(0x04400000, 8);
  header.write("mntr", 12);
  header.write("RGB ", 16);
  header.write("XYZ ", 20);
  [2026, 10, 2, 0, 0, 0].forEach((value, i) => header.writeUInt16BE(value, 24 + i * 2));
  header.write("acsp", 36);
  header.writeUInt32BE(1, 64);
  [0.9642, 1, 0.8249].forEach((value, i) =>
    header.writeInt32BE(Math.round(value * 65536), 68 + i * 4),
  );
  header.writeUInt32BE(tags.length, 128);
  const bodies: Buffer[] = [];
  const prior = new Map<Buffer, number>();
  tags.forEach(([name, body], i) => {
    header.write(name, 132 + i * 12);
    header.writeUInt32BE(prior.get(body) ?? offset, 136 + i * 12);
    header.writeUInt32BE(body.length, 140 + i * 12);
    if (prior.has(body)) return;
    prior.set(body, offset);
    const padding = Buffer.alloc((4 - (body.length % 4)) % 4);
    bodies.push(body, padding);
    offset += body.length + padding.length;
  });
  header.writeUInt32BE(offset, 0);
  const result = Buffer.concat([header, ...bodies]);
  const digestSource = Buffer.from(result);
  digestSource.fill(0, 44, 48);
  digestSource.fill(0, 64, 68);
  digestSource.fill(0, 84, 100);
  createHash("md5").update(digestSource).digest().copy(result, 84);
  return result;
}

function typed(name: string, values: number[]): Buffer {
  const result = Buffer.alloc(8 + 4 * values.length);
  result.write(name);
  values.forEach((value, i) => result.writeInt32BE(Math.round(value * 65536), 8 + i * 4));
  return result;
}

export function inspectProfile(profile: Buffer, transfer: Transfer) {
  assert.equal(profile.readUInt32BE(0), profile.length);
  assert.equal(profile.toString("ascii", 36, 40), "acsp");
  assert.equal(profile.toString("ascii", 16, 20), "RGB ");
  assert.equal(profile.toString("ascii", 20, 24), "XYZ ");
  const tags = new Map<string, Buffer>();
  for (let i = 0; i < profile.readUInt32BE(128); i++) {
    const position = 132 + i * 12;
    tags.set(
      profile.toString("ascii", position, position + 4),
      profile.subarray(
        profile.readUInt32BE(position + 4),
        profile.readUInt32BE(position + 4) + profile.readUInt32BE(position + 8),
      ),
    );
  }
  const values = (name: string, count: number) => {
    const body = tags.get(name)!;
    assert.ok(body);
    return Array.from({ length: count }, (_, i) => body.readInt32BE(8 + i * 4) / 65536);
  };
  const adaptation = values("chad", 9);
  const inverse = invert3(adaptation);
  const chromaticities = ["rXYZ", "gXYZ", "bXYZ"].map((name, channel) => {
    const adapted = values(name, 3);
    const native = multiply(inverse, adapted);
    const sum = native.reduce((a, b) => a + b, 0);
    const xy = [native[0]! / sum, native[1]! / sum];
    const expected = [
      [0.64, 0.33],
      [0.3, 0.6],
      [0.15, 0.06],
    ][channel]!;
    xy.forEach((value, i) => assert.ok(Math.abs(value - expected[i]!) < 0.0001));
    return xy;
  });
  const probes = [0, 1 / 255, 19 / 255, 0.08125, 0.25, 0.5, 1];
  const expected = (v: number) =>
    transfer === "bt709"
      ? v ** (502 / 256)
      : v <= 0.04045
        ? v / 12.92
        : ((v + 0.055) / 1.055) ** 2.4;
  let maximumCurveError = 0;
  for (const name of ["rTRC", "gTRC", "bTRC"]) {
    const body = tags.get(name)!;
    assert.equal(body.toString("ascii", 0, 4), "para");
    assert.equal(body.readUInt16BE(8), transfer === "bt709" ? 0 : 3);
    const [g, a, b, c, d] = Array.from(
      { length: transfer === "bt709" ? 1 : 5 },
      (_, i) => body.readInt32BE(12 + i * 4) / 65536,
    );
    for (const v of probes) {
      const actual = transfer === "bt709" ? v ** g! : v >= d! ? (a! * v + b!) ** g! : c! * v;
      maximumCurveError = Math.max(maximumCurveError, Math.abs(actual - expected(v)));
      assert.ok(Math.abs(actual - expected(v)) < 0.00004);
    }
  }
  return { profileBytes: profile.length, chromaticities, maximumCurveError };
}

function multiply(matrix: number[], vector: number[]) {
  return [0, 1, 2].map((row) =>
    [0, 1, 2].reduce((sum, col) => sum + matrix[row * 3 + col]! * vector[col]!, 0),
  );
}
function invert3(m: number[]) {
  const [a, b, c, d, e, f, g, h, i] = m as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const cofactors = [
    e * i - f * h,
    c * h - b * i,
    b * f - c * e,
    f * g - d * i,
    a * i - c * g,
    c * d - a * f,
    d * h - e * g,
    b * g - a * h,
    a * e - b * d,
  ];
  const determinant = a * cofactors[0]! + b * cofactors[3]! + c * cofactors[6]!;
  return cofactors.map((value) => value / determinant);
}

export interface Chunk {
  type: string;
  data: Buffer;
}
export function pngChunks(image: Buffer): Chunk[] {
  const chunks: Chunk[] = [];
  for (let offset = 8; offset < image.length;) {
    const size = image.readUInt32BE(offset);
    chunks.push({
      type: image.toString("ascii", offset + 4, offset + 8),
      data: image.subarray(offset + 8, offset + 8 + size),
    });
    offset += 12 + size;
  }
  return chunks;
}
export function riffChunks(image: Buffer): Chunk[] {
  assert.equal(image.toString("ascii", 0, 4), "RIFF");
  assert.equal(image.toString("ascii", 8, 12), "WEBP");
  assert.equal(image.readUInt32LE(4), image.length - 8);
  const chunks: Chunk[] = [];
  for (let offset = 12; offset < image.length;) {
    const size = image.readUInt32LE(offset + 4);
    chunks.push({
      type: image.toString("ascii", offset, offset + 4),
      data: image.subarray(offset + 8, offset + 8 + size),
    });
    offset += 8 + size + (size & 1);
  }
  return chunks;
}
export function jpegSegments(image: Buffer): { segments: Chunk[]; scan: Buffer } {
  assert.equal(image.readUInt16BE(0), 0xffd8);
  const segments: Chunk[] = [];
  let offset = 2;
  while (offset < image.length) {
    assert.equal(image[offset], 0xff);
    const marker = image[offset + 1]!;
    if (marker === 0xda) return { segments, scan: image.subarray(offset) };
    const length = image.readUInt16BE(offset + 2);
    segments.push({ type: String(marker), data: image.subarray(offset + 4, offset + 2 + length) });
    offset += 2 + length;
  }
  throw new Error("JPEG has no scan.");
}

export function extractedProfile(image: Buffer, format: string): Buffer | undefined {
  if (format === "png") {
    const chunk = pngChunks(image).find((chunk) => chunk.type === "iCCP");
    if (!chunk) return;
    const start = chunk.data.indexOf(0) + 2;
    return inflateSync(chunk.data.subarray(start));
  }
  if (format === "webp") return riffChunks(image).find((chunk) => chunk.type === "ICCP")?.data;
  const segments = jpegSegments(image).segments.filter(
    (chunk) => chunk.type === "226" && chunk.data.toString("ascii", 0, 12) === "ICC_PROFILE\0",
  );
  if (!segments.length) return;
  segments.sort((a, b) => a.data[12]! - b.data[12]!);
  assert.equal(segments[0]!.data[13], segments.length);
  return Buffer.concat(segments.map((segment) => segment.data.subarray(14)));
}

export function embedReference(
  image: Buffer,
  format: string,
  profile: Buffer,
  width: number,
  height: number,
  alpha: boolean,
): Buffer {
  if (format === "png") {
    const chunks = pngChunks(image).filter(
      (chunk) => !["iCCP", "cICP", "sRGB", "gAMA", "cHRM"].includes(chunk.type),
    );
    chunks.splice(1, 0, {
      type: "iCCP",
      data: Buffer.concat([Buffer.from("Source RGB\0\0", "ascii"), deflateSync(profile)]),
    });
    return Buffer.concat([
      image.subarray(0, 8),
      ...chunks.map(({ type, data }) => {
        const chunk = Buffer.alloc(data.length + 12);
        chunk.writeUInt32BE(data.length);
        chunk.write(type, 4);
        data.copy(chunk, 8);
        chunk.writeUInt32BE(crc32(chunk.subarray(4, -4)), chunk.length - 4);
        return chunk;
      }),
    ]);
  }
  if (format === "jpg") {
    const { segments, scan } = jpegSegments(image);
    const kept = segments.filter(
      (chunk) => !(chunk.type === "226" && chunk.data.toString("ascii", 0, 12) === "ICC_PROFILE\0"),
    );
    kept.unshift({
      type: "226",
      data: Buffer.concat([Buffer.from("ICC_PROFILE\0", "ascii"), Buffer.from([1, 1]), profile]),
    });
    return Buffer.concat([
      image.subarray(0, 2),
      ...kept.map(({ type, data }) => {
        const head = Buffer.alloc(4);
        head[0] = 255;
        head[1] = Number(type);
        head.writeUInt16BE(data.length + 2, 2);
        return Buffer.concat([head, data]);
      }),
      scan,
    ]);
  }
  const chunks = riffChunks(image).filter((chunk) => chunk.type !== "ICCP");
  let vp8x = chunks.find((chunk) => chunk.type === "VP8X");
  if (!vp8x) {
    const data = Buffer.alloc(10);
    data[0] = alpha ? 0x10 : 0;
    data.writeUIntLE(width - 1, 4, 3);
    data.writeUIntLE(height - 1, 7, 3);
    vp8x = { type: "VP8X", data };
    chunks.unshift(vp8x);
  } else vp8x.data = Buffer.from(vp8x.data);
  vp8x.data[0] = vp8x.data[0]! | 0x20;
  chunks.splice(1, 0, { type: "ICCP", data: profile });
  const bodies = chunks.map(({ type, data }) => {
    const head = Buffer.alloc(8);
    head.write(type);
    head.writeUInt32LE(data.length, 4);
    return Buffer.concat([head, data, Buffer.alloc(data.length & 1)]);
  });
  const head = Buffer.from("RIFF\0\0\0\0WEBP", "ascii");
  head.writeUInt32LE(4 + bodies.reduce((sum, body) => sum + body.length, 0), 4);
  return Buffer.concat([head, ...bodies]);
}

function crc32(value: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of value) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function imagePayload(image: Buffer, format: string): Buffer {
  if (format === "png")
    return Buffer.concat(
      pngChunks(image)
        .filter((chunk) => chunk.type === "IDAT")
        .map((chunk) => chunk.data),
    );
  if (format === "jpg") return jpegSegments(image).scan;
  return Buffer.concat(
    riffChunks(image)
      .filter((chunk) => ["VP8 ", "VP8L", "ALPH"].includes(chunk.type))
      .map((chunk) => chunk.data),
  );
}
