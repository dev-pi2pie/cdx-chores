import { expect, test } from "bun:test";
import { imageFramer } from "../../../src/cli/video-frames/image-framing";
import { png, jpg, webp, pngChunk } from "./fixtures/framing";
import type { ImageFormat } from "../../../src/cli/video-frames/image-options";
import type { ImageProfile } from "../../../src/cli/video-frames/image-framing";
import { deflateSync, inflateSync } from "node:zlib";
function capture(format: ImageFormat, profile?: ImageProfile) {
  const completed: Buffer[] = [];
  let parts: Buffer[] = [];
  let active = false;
  const framer = imageFramer(
    format,
    {
      async begin() {
        expect(active).toBe(false);
        active = true;
        parts = [];
      },
      async write(bytes) {
        expect(active).toBe(true);
        parts.push(Buffer.from(bytes));
      },
      async complete() {
        completed.push(Buffer.concat(parts));
        active = false;
      },
    },
    profile,
  );
  return { framer, completed };
}
for (const [format, fixture] of [
  ["png", png],
  ["jpg", jpg],
  ["webp", webp],
] as [ImageFormat, () => Buffer][]) {
  test(`${format} streams preserve complete bytes at every chunk boundary`, async () => {
    const source = Buffer.concat([fixture(), fixture()]);
    for (const width of [1, 2, 3, 7, 64, source.length]) {
      const { framer, completed } = capture(format);
      for (let offset = 0; offset < source.length; offset += width)
        await framer.chunk(source.subarray(offset, offset + width));
      framer.finish();
      expect(completed).toEqual([fixture(), fixture()]);
    }
  });
  test(`${format} incomplete or invalid bytes never establish another completed image`, async () => {
    const { framer, completed } = capture(format);
    await framer.chunk(Buffer.concat([fixture(), fixture().subarray(0, -1)]));
    expect(() => framer.finish()).toThrow("incomplete");
    expect(completed).toHaveLength(1);
    await expect(capture(format).framer.chunk(Buffer.alloc(20))).rejects.toThrow("image stream");
  });
}
test("WebP animation packets cannot be published as still images", async () => {
  await expect(capture("webp").framer.chunk(webp("ANMF"))).rejects.toThrow("image stream");
});

// Structural profile fixture. Color accuracy is checked with independent real-tool evidence.
function profile(size = 132): ImageProfile {
  const icc = Buffer.alloc(size, 37);
  icc.writeUInt32BE(size);
  icc.write("RGB ", 16, "ascii");
  icc.write("acsp", 36, "ascii");
  return { icc, width: 2, height: 2 };
}
function pngChunks(bytes: Buffer) {
  const chunks: { type: string; data: Buffer; bytes: Buffer }[] = [];
  for (let offset = 8; offset < bytes.length;) {
    const size = bytes.readUInt32BE(offset);
    const end = offset + size + 12;
    chunks.push({
      type: bytes.toString("ascii", offset + 4, offset + 8),
      data: bytes.subarray(offset + 8, end - 4),
      bytes: bytes.subarray(offset, end),
    });
    offset = end;
  }
  return chunks;
}
function riffChunk(type: string, data: Buffer) {
  const bytes = Buffer.alloc(8 + data.length + (data.length % 2));
  bytes.write(type, 0, "ascii");
  bytes.writeUInt32LE(data.length, 4);
  data.copy(bytes, 8);
  return bytes;
}
function riff(...chunks: Buffer[]) {
  const header = Buffer.alloc(12);
  header.write("RIFF");
  header.writeUInt32LE(
    chunks.reduce((size, chunk) => size + chunk.length, 4),
    4,
  );
  header.write("WEBP", 8);
  return Buffer.concat([header, ...chunks]);
}
function webpChunks(bytes: Buffer) {
  expect(bytes.readUInt32LE(4)).toBe(bytes.length - 8);
  const chunks: { type: string; data: Buffer; bytes: Buffer }[] = [];
  for (let offset = 12; offset < bytes.length;) {
    const size = bytes.readUInt32LE(offset + 4);
    const end = offset + size + 8;
    chunks.push({
      type: bytes.toString("ascii", offset, offset + 4),
      data: bytes.subarray(offset + 8, end),
      bytes: bytes.subarray(offset, end + (size % 2)),
    });
    offset = end + (size % 2);
  }
  return chunks;
}
function stripJpegProfile(bytes: Buffer) {
  const profiles: Buffer[] = [];
  const original: Buffer[] = [bytes.subarray(0, 2)];
  let offset = 2;
  while (bytes[offset + 1] !== 218) {
    const end = offset + 2 + bytes.readUInt16BE(offset + 2);
    const segment = bytes.subarray(offset, end);
    if (segment[1] === 226 && segment.toString("ascii", 4, 16) === "ICC_PROFILE\0") {
      expect(segment[16]).toBe(profiles.length + 1);
      profiles.push(segment);
    } else original.push(segment);
    offset = end;
  }
  original.push(bytes.subarray(offset));
  for (const segment of profiles) expect(segment[17]).toBe(profiles.length);
  return {
    icc: Buffer.concat(profiles.map((segment) => segment.subarray(18))),
    original: Buffer.concat(original),
    count: profiles.length,
  };
}
async function framed(format: ImageFormat, source: Buffer, color = profile(), width = 1) {
  const { framer, completed } = capture(format, color);
  for (let offset = 0; offset < source.length; offset += width)
    await framer.chunk(source.subarray(offset, offset + width));
  framer.finish();
  return completed;
}

for (const [format, fixture] of [
  ["png", png],
  ["jpg", jpg],
  ["webp", webp],
] as [ImageFormat, () => Buffer][]) {
  test(`${format} profile attachment works at every input split and independently for consecutive images`, async () => {
    const color = profile();
    const source = Buffer.concat([fixture(), fixture()]);
    for (let cut = 1; cut < source.length; cut++) {
      const { framer, completed } = capture(format, color);
      await framer.chunk(source.subarray(0, cut));
      await framer.chunk(source.subarray(cut));
      framer.finish();
      expect(completed).toHaveLength(2);
      expect(completed[0]).toEqual(completed[1]);
      if (format === "png") {
        const chunks = pngChunks(completed[0]!);
        expect(chunks.map((chunk) => chunk.type)).toEqual(["IHDR", "iCCP", "IDAT", "IEND"]);
        const iccp = chunks[1]!;
        const nul = iccp.data.indexOf(0);
        expect(iccp.data[nul + 1]).toBe(0);
        expect(inflateSync(iccp.data.subarray(nul + 2)).equals(color.icc)).toBe(true);
        expect(iccp.bytes).toEqual(pngChunk("iCCP", iccp.data));
        expect(chunks.filter((chunk) => chunk.type !== "iCCP").map((chunk) => chunk.bytes)).toEqual(
          pngChunks(fixture()).map((chunk) => chunk.bytes),
        );
      } else if (format === "jpg") {
        const parsed = stripJpegProfile(completed[0]!);
        expect(parsed.icc.equals(color.icc)).toBe(true);
        expect(parsed.original.equals(fixture())).toBe(true);
      } else {
        const chunks = webpChunks(completed[0]!);
        expect(chunks.map((chunk) => chunk.type)).toEqual(["VP8X", "ICCP", "VP8L"]);
        expect(chunks[0]!.data).toEqual(Buffer.from([32, 0, 0, 0, 1, 0, 0, 1, 0, 0]));
        expect(chunks[1]!.data).toEqual(color.icc);
        expect(chunks[2]!.bytes).toEqual(fixture().subarray(12));
      }
    }
  });
  test(`${format} profiled truncation retains only earlier completed images`, async () => {
    const { framer, completed } = capture(format, profile());
    await framer.chunk(Buffer.concat([fixture(), fixture().subarray(0, -1)]));
    expect(() => framer.finish()).toThrow("incomplete");
    expect(completed).toHaveLength(1);
  });
}
test("PNG replaces competing descriptions and preserves encoded image data", async () => {
  const source = png();
  const input = Buffer.concat([
    source.subarray(0, 33),
    pngChunk("iCCP", Buffer.concat([Buffer.from("Earlier\0\0"), deflateSync(profile().icc)])),
    pngChunk("sRGB", Buffer.from([0])),
    pngChunk("cICP", Buffer.from([1, 13, 0, 1])),
    pngChunk("gAMA", Buffer.from([0, 0, 177, 143])),
    pngChunk("cHRM", Buffer.alloc(32)),
    source.subarray(33),
  ]);
  const [output] = await framed("png", input);
  expect(pngChunks(output!).map((chunk) => chunk.type)).toEqual(["IHDR", "iCCP", "IDAT", "IEND"]);
  expect(pngChunks(output!)[2]!.bytes).toEqual(pngChunks(source)[1]!.bytes);
});
test("PNG rejects malformed, duplicate, late and oversized profile descriptors and animations", async () => {
  const badCrc = pngChunk("sRGB", Buffer.from([0]));
  badCrc[badCrc.length - 1] = badCrc[badCrc.length - 1]! ^ 1;
  const oversized = Buffer.alloc(8);
  oversized.writeUInt32BE(1024 * 1024 + 1);
  oversized.write("iCCP", 4);
  for (const descriptor of [
    pngChunk("sRGB", Buffer.from([4])),
    badCrc,
    pngChunk("iCCP", Buffer.from("Name\0\x01x")),
    pngChunk("gAMA", Buffer.alloc(3)),
    Buffer.concat([pngChunk("sRGB", Buffer.from([0])), pngChunk("sRGB", Buffer.from([0]))]),
    oversized,
    pngChunk("acTL", Buffer.alloc(8)),
  ]) {
    await expect(
      framed("png", Buffer.concat([png().subarray(0, 33), descriptor, png().subarray(33)])),
    ).rejects.toThrow("image stream");
  }
  await expect(
    framed(
      "png",
      Buffer.concat([
        png().subarray(0, -12),
        pngChunk("sRGB", Buffer.from([0])),
        png().subarray(-12),
      ]),
    ),
  ).rejects.toThrow("image stream");
  const wrong = profile();
  wrong.width = 3;
  await expect(framed("png", png(), wrong)).rejects.toThrow("image stream");
});
test("JPEG splits ICC across correctly numbered APP2 segments before scan and preserves unrelated APP2", async () => {
  const color = profile(140000);
  const app2 = Buffer.from([255, 226, 0, 6, 1, 2, 3, 4]);
  const source = Buffer.concat([jpg().subarray(0, 2), app2, jpg().subarray(2)]);
  const [output] = await framed("jpg", source, color);
  const parsed = stripJpegProfile(output!);
  expect(parsed.count).toBe(3);
  expect(parsed.icc.equals(color.icc)).toBe(true);
  expect(parsed.original.equals(source)).toBe(true);
});
test("JPEG rejects existing and malformed ICC APP2 descriptions", async () => {
  for (const body of [Buffer.from("ICC_PROFILE\0\x01\x01data"), Buffer.from("ICC_PROFILE")]) {
    const header = Buffer.from([255, 226, 0, 0]);
    header.writeUInt16BE(body.length + 2, 2);
    const source = Buffer.concat([jpg().subarray(0, 2), header, body, jpg().subarray(2)]);
    await expect(framed("jpg", source)).rejects.toThrow("image stream");
  }
});
test("WebP preserves existing extended flags, alpha payload, image payload and odd profile padding", async () => {
  const extended = Buffer.from([28, 0, 0, 0, 1, 0, 0, 1, 0, 0]);
  const vp8 = Buffer.from([0, 0, 0, 0x9d, 0x01, 0x2a, 2, 0, 2, 0, 7, 9]);
  const source = riff(
    riffChunk("VP8X", extended),
    riffChunk("ALPH", Buffer.from([0, 7])),
    riffChunk("VP8 ", vp8),
    riffChunk("EXIF", Buffer.from([1, 2])),
    riffChunk("XMP ", Buffer.from([3, 4])),
  );
  const color = profile(133);
  const [output] = await framed("webp", source, color);
  const chunks = webpChunks(output!);
  expect(chunks.map((chunk) => chunk.type)).toEqual([
    "VP8X",
    "ICCP",
    "ALPH",
    "VP8 ",
    "EXIF",
    "XMP ",
  ]);
  expect(chunks[0]!.data[0]).toBe(60);
  expect(chunks[1]!.data).toEqual(color.icc);
  expect(chunks[1]!.bytes.at(-1)).toBe(0);
  expect(chunks.slice(2).map((chunk) => chunk.bytes)).toEqual(
    webpChunks(source)
      .slice(1)
      .map((chunk) => chunk.bytes),
  );
});
test("WebP derives alpha from a simple lossless header without changing payload", async () => {
  const source = webp();
  source[24]! |= 16;
  const [output] = await framed("webp", source);
  const chunks = webpChunks(output!);
  expect(chunks[0]!.data[0]).toBe(48);
  expect(chunks[2]!.bytes).toEqual(source.subarray(12));
});
test("WebP rejects duplicate headers, existing ICC, animation and mismatched dimensions/alpha", async () => {
  const extended = riffChunk("VP8X", Buffer.from([0, 0, 0, 0, 1, 0, 0, 1, 0, 0]));
  const image = webp().subarray(12);
  for (const source of [
    riff(extended, extended, image),
    riff(extended, riffChunk("ICCP", profile().icc), image),
    riff(riffChunk("VP8X", Buffer.from([2, 0, 0, 0, 1, 0, 0, 1, 0, 0])), image),
    riff(riffChunk("VP8X", Buffer.from([32, 0, 0, 0, 1, 0, 0, 1, 0, 0])), image),
    webp("ANMF"),
  ])
    await expect(framed("webp", source)).rejects.toThrow("image stream");
  const wrong = profile();
  wrong.height = 3;
  await expect(framed("webp", webp(), wrong)).rejects.toThrow("image stream");
  const badPadding = webp();
  badPadding[badPadding.length - 1] = 1;
  await expect(framed("webp", badPadding)).rejects.toThrow("image stream");
  const oddSize = webp();
  oddSize.writeUInt32LE(17, 4);
  await expect(framed("webp", oddSize)).rejects.toThrow("image stream");
  const overflow = webp();
  overflow.writeUInt32LE(0xfffffff6, 4);
  await expect(framed("webp", overflow)).rejects.toThrow("image stream");
});
test("WebP retains extended alpha flags when the lossless alpha hint differs", async () => {
  const source = riff(
    riffChunk("VP8X", Buffer.from([16, 0, 0, 0, 1, 0, 0, 1, 0, 0])),
    webp().subarray(12),
  );
  const [output] = await framed("webp", source);
  expect(webpChunks(output!)[0]!.data[0]).toBe(48);
});
test("profile validation fails before any image sink begins", () => {
  for (const color of [
    profile(127),
    profile(1024 * 1024 + 1),
    { ...profile(), width: 0 },
    { ...profile(), height: NaN },
    { ...profile(), icc: Buffer.alloc(132) },
  ])
    expect(() => capture("png", color)).toThrow("color profile");
});
test("injected metadata awaits sink backpressure and contributes to its byte limit", async () => {
  let release!: () => void;
  let writeCount = 0;
  let completed = 0;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const writer = imageFramer(
    "png",
    {
      async begin() {},
      async write() {
        if (++writeCount === 3) await waiting;
      },
      async complete() {
        completed++;
      },
    },
    profile(),
  );
  const writing = writer.chunk(png());
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(writeCount).toBe(3);
  expect(completed).toBe(0);
  release();
  await writing;
  writer.finish();
  expect(completed).toBe(1);
  let bytes = 0;
  const limited = imageFramer(
    "png",
    {
      async begin() {},
      async write(value) {
        bytes += value.length;
        if (bytes > png().length) throw new Error("staging byte limit");
      },
      async complete() {
        throw new Error("unexpected completion");
      },
    },
    profile(),
  );
  await expect(limited.chunk(png())).rejects.toThrow("staging byte limit");
});
test("profiled framing bounds container chunk counts", async () => {
  const excessive = 4097;
  const manyPng = Buffer.concat([
    png().subarray(0, 33),
    ...Array.from({ length: excessive }, () => pngChunk("IDAT")),
    pngChunk("IEND"),
  ]);
  const manyJpeg = Buffer.concat([
    jpg().subarray(0, 2),
    ...Array.from({ length: excessive }, () => Buffer.from([255, 225, 0, 2])),
    jpg().subarray(2),
  ]);
  const manyWebp = riff(
    webp().subarray(12),
    ...Array.from({ length: excessive }, () => riffChunk("META", Buffer.from([0, 0]))),
  );
  for (const [format, source] of [
    ["png", manyPng],
    ["jpg", manyJpeg],
    ["webp", manyWebp],
  ] as [ImageFormat, Buffer][])
    await expect(framed(format, source, profile(), source.length)).rejects.toThrow("image stream");
});
test("profile attachment streams large payloads before the image is complete", async () => {
  const source = Buffer.concat([
    png().subarray(0, 33),
    pngChunk("IDAT", Buffer.alloc(1024 * 1024, 77)),
    pngChunk("IEND"),
  ]);
  let bytes = 0;
  let complete = false;
  const writer = imageFramer(
    "png",
    {
      async begin() {},
      async write(value) {
        bytes += value.length;
      },
      async complete() {
        complete = true;
      },
    },
    profile(),
  );
  await writer.chunk(source.subarray(0, 65536));
  expect(bytes).toBeGreaterThan(65536);
  expect(complete).toBe(false);
  await writer.chunk(source.subarray(65536));
  writer.finish();
  expect(complete).toBe(true);
});
