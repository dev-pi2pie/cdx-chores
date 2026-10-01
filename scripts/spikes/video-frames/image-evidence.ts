import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Experiment } from "./lab";
import { referenceFrame } from "./pattern";
import { generateSmall, STRICT_INPUT } from "./timing-evidence";
import { FFMPEG, FFPROBE } from "./tools";

const JPEG_QUALITY = { low: 12, medium: 6, high: 3, full: 1 } as const;
const WEBP_QUALITY = { low: 40, medium: 70, high: 90, full: 100 } as const;
const RGB_TAGS = "setparams=range=full:color_primaries=bt709:color_trc=iec61966-2-1:colorspace=gbr";

async function imageInfo(e: Experiment, path: string): Promise<Record<string, unknown>> {
  const info = await e.tool(FFPROBE, [
    "-v",
    "error",
    "-show_entries",
    "stream=width,height,sample_aspect_ratio,color_range,color_space,color_primaries,color_transfer:stream_side_data=",
    "-of",
    "json",
    path,
  ]);
  return JSON.parse(info.stdout.toString("utf8")).streams[0];
}

async function decodedPixels(e: Experiment, path: string): Promise<Buffer> {
  const result = await e.tool(FFMPEG, [
    ...STRICT_INPUT,
    "-i",
    path,
    "-frames:v",
    "1",
    "-pix_fmt",
    "rgba",
    "-f",
    "rawvideo",
    "pipe:1",
  ]);
  return result.stdout;
}

function pixelError(
  actual: Buffer,
  expected: Buffer,
): { mean: number; max: number; alphaMax: number } {
  assert.equal(actual.length, expected.length);
  let sum = 0;
  let max = 0;
  let alphaMax = 0;
  for (let i = 0; i < actual.length; i++) {
    const delta = Math.abs(actual[i]! - expected[i]!);
    if (i % 4 === 3) alphaMax = Math.max(alphaMax, delta);
    else {
      sum += delta;
      max = Math.max(max, delta);
    }
  }
  return { mean: sum / ((actual.length / 4) * 3), max, alphaMax };
}

export async function imageEvidence(e: Experiment, webp: boolean): Promise<object> {
  const opaque = await generateSmall(e, "opaque.mkv");
  const alpha = await generateSmall(e, "alpha.mkv", { alpha: true });
  const reference = referenceFrame(1, 4);
  const alphaReference = referenceFrame(1, 4, 96, 64, true);
  const observations: object[] = [];
  for (const compression of [0, 9]) {
    const path = join(e.path, `png-${compression}.png`);
    const encoded = await e.tool(FFMPEG, [
      ...STRICT_INPUT,
      "-i",
      alpha,
      "-frames:v",
      "1",
      "-vf",
      `format=rgba,setsar=1,${RGB_TAGS}`,
      "-c:v",
      "png",
      "-compression_level",
      String(compression),
      "-color_range",
      "pc",
      "-color_primaries",
      "bt709",
      "-color_trc",
      "iec61966-2-1",
      path,
    ]);
    e.images(1);
    const pixels = await decodedPixels(e, path);
    assert.deepEqual(pixels, alphaReference);
    const metadata = await imageInfo(e, path);
    assert.equal(metadata.color_primaries, "bt709");
    assert.equal(metadata.color_transfer, "iec61966-2-1");
    assert.equal(metadata.sample_aspect_ratio, "1:1");
    observations.push({
      format: "png",
      compression,
      encodedMs: encoded.milliseconds,
      losslessPixels: true,
      alpha: true,
      metadata,
    });
  }
  assert.notDeepEqual(
    await readFile(join(e.path, "png-0.png")),
    await readFile(join(e.path, "png-9.png")),
  );
  for (const [quality, quantizer] of Object.entries(JPEG_QUALITY)) {
    const path = join(e.path, `jpg-${quality}.jpg`);
    await e.tool(FFMPEG, [
      ...STRICT_INPUT,
      "-i",
      opaque,
      "-frames:v",
      "1",
      "-vf",
      "scale=in_range=pc:out_range=pc:out_color_matrix=bt601,format=yuvj444p",
      "-c:v",
      "mjpeg",
      "-q:v",
      String(quantizer),
      "-qmin",
      "1",
      "-qmax",
      "31",
      path,
    ]);
    e.images(1);
    const error = pixelError(await decodedPixels(e, path), reference);
    // The fixed reference contains gradients, sharp labels, and asymmetric endpoint patches.
    assert.ok(error.mean <= (quality === "low" ? 9 : 5), JSON.stringify(error));
    assert.equal(error.alphaMax, 0);
    observations.push({ format: "jpg", quality, quantizer, ...error });
  }
  if (webp) {
    const help = await e.tool(FFMPEG, ["-hide_banner", "-h", "encoder=libwebp"], {
      allowFailure: true,
    });
    assert.equal(help.code, 0);
    assert.match(help.stdout.toString("utf8"), /^Encoder libwebp \[/m);
    assert.match(help.stdout.toString("utf8"), /^\s+-lossless\s+<int>.*\(from 0 to 1\)/m);
    for (const [quality, value] of Object.entries(WEBP_QUALITY)) {
      const path = join(e.path, `webp-${quality}.webp`);
      const full = quality === "full";
      await e.tool(FFMPEG, [
        ...STRICT_INPUT,
        "-i",
        alpha,
        "-frames:v",
        "1",
        "-vf",
        `format=bgra,setsar=1,${RGB_TAGS}`,
        "-c:v",
        "libwebp",
        "-lossless",
        full ? "1" : "0",
        "-quality",
        String(value),
        "-compression_level",
        "4",
        path,
      ]);
      e.images(1);
      const pixels = await decodedPixels(e, path);
      const error = pixelError(pixels, alphaReference);
      if (full) assert.deepEqual(pixels, alphaReference);
      else assert.ok(error.mean <= 12, JSON.stringify(error));
      assert.equal(error.alphaMax, 0);
      observations.push({
        format: "webp",
        quality,
        nativeQuality: value,
        lossless: full,
        ...error,
      });
    }
  }
  const dimensions: object[] = [];
  for (const [width, height] of [
    [51, 26],
    [1, 1],
    [97, 65],
  ]) {
    const path = join(e.path, `dimensions-${width}x${height}.png`);
    await e.tool(FFMPEG, [
      ...STRICT_INPUT,
      "-i",
      opaque,
      "-frames:v",
      "1",
      "-vf",
      `scale=${width}:${height}:flags=bilinear,setsar=1,format=rgba`,
      "-c:v",
      "png",
      path,
    ]);
    e.images(1);
    const info = await e.tool(FFPROBE, [
      "-v",
      "error",
      "-show_entries",
      "stream=width,height,sample_aspect_ratio",
      "-of",
      "json",
      path,
    ]);
    const stream = JSON.parse(info.stdout.toString("utf8")).streams[0];
    assert.equal(stream.width, width);
    assert.equal(stream.height, height);
    assert.equal(stream.sample_aspect_ratio, "1:1");
    dimensions.push({ width, height });
  }
  return {
    jpegQuality: JPEG_QUALITY,
    webpQuality: webp ? WEBP_QUALITY : "not tested",
    observations,
    dimensions,
    sourceInterpretation:
      "untagged 8-bit RGB reference interpreted as full-range sRGB; YUV/transform checks are separate",
  };
}

export async function colorAndTransformEvidence(e: Experiment): Promise<object> {
  const observations: object[] = [];
  // Independently declared limited-range YUV patches, with sRGB transfer and BT.709 primaries.
  const recipes = [
    {
      matrix: "bt709",
      patches: [
        [16, 128, 128],
        [235, 128, 128],
        [63, 102, 240],
        [173, 42, 26],
        [32, 240, 118],
      ],
    },
    {
      matrix: "bt601",
      patches: [
        [16, 128, 128],
        [235, 128, 128],
        [81, 90, 240],
        [145, 54, 34],
        [41, 240, 110],
      ],
    },
  ];
  const expected = [
    [0, 0, 0],
    [255, 255, 255],
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
  ];
  for (const recipe of recipes) {
    const width = 80;
    const height = 16;
    const plane = width * height;
    const input = Buffer.alloc(plane * 3);
    for (let channel = 0; channel < 3; channel++)
      for (let i = 0; i < plane; i++)
        input[channel * plane + i] = recipe.patches[Math.floor((i % width) / 16)]![channel]!;
    const path = join(e.path, `${recipe.matrix}.png`);
    async function* frames() {
      yield input;
    }
    await e.tool(
      FFMPEG,
      [
        "-v",
        "error",
        "-nostdin",
        "-f",
        "rawvideo",
        "-pixel_format",
        "yuv444p",
        "-video_size",
        "80x16",
        "-framerate",
        "1",
        "-color_range",
        "tv",
        "-colorspace",
        recipe.matrix === "bt601" ? "smpte170m" : "bt709",
        "-color_primaries",
        "bt709",
        "-color_trc",
        "iec61966-2-1",
        "-i",
        "pipe:0",
        "-frames:v",
        "1",
        "-vf",
        `scale=in_color_matrix=${recipe.matrix}:in_range=tv:out_range=pc,format=rgba,setsar=1,${RGB_TAGS}`,
        "-c:v",
        "png",
        "-color_range",
        "pc",
        "-color_primaries",
        "bt709",
        "-color_trc",
        "iec61966-2-1",
        path,
      ],
      { input: frames() },
    );
    e.images(1);
    const pixels = await decodedPixels(e, path);
    const actual = expected.map((color, patch) =>
      color.map((v, channel) => {
        const value = pixels[(8 * width + patch * 16 + 8) * 4 + channel]!;
        assert.ok(Math.abs(value - v) <= 3, `${recipe.matrix}: ${value} vs ${v}`);
        return value;
      }),
    );
    observations.push({
      matrix: recipe.matrix,
      range: "limited to full",
      patchTolerance: 3,
      actual,
    });
  }
  // Independently calculate BT.709 OETF inversion followed by the sRGB OETF.
  const grays = [16, 70, 128, 180, 235];
  const grayInput = Buffer.alloc(80 * 16 * 3, 128);
  for (let i = 0; i < 80 * 16; i++) grayInput[i] = grays[Math.floor((i % 80) / 16)]!;
  async function* grayFrame() {
    yield grayInput;
  }
  const grayPath = join(e.path, "bt709-transfer.png");
  await e.tool(
    FFMPEG,
    [
      "-v",
      "error",
      "-nostdin",
      "-f",
      "rawvideo",
      "-pixel_format",
      "yuv444p",
      "-video_size",
      "80x16",
      "-color_range",
      "tv",
      "-colorspace",
      "bt709",
      "-color_primaries",
      "bt709",
      "-color_trc",
      "bt709",
      "-i",
      "pipe:0",
      "-frames:v",
      "1",
      "-vf",
      `colorspace=space=bt709:primaries=bt709:trc=iec61966-2-1:range=pc:format=yuv444p,scale=in_color_matrix=bt709:in_range=pc:out_range=pc,format=rgba,setsar=1,${RGB_TAGS}`,
      "-c:v",
      "png",
      grayPath,
    ],
    { input: grayFrame() },
  );
  e.images(1);
  const grayPixels = await decodedPixels(e, grayPath);
  const transferExpected = grays.map((y) => {
    const signal = (y - 16) / 219;
    const linear = signal < 0.081 ? signal / 4.5 : ((signal + 0.099) / 1.099) ** (1 / 0.45);
    return Math.round(
      255 * (linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055),
    );
  });
  const grayActual = transferExpected.map((value, patch) => {
    const actual = grayPixels[(8 * 80 + patch * 16 + 8) * 4]!;
    assert.ok(Math.abs(actual - value) <= 3, `${actual} vs ${value}`);
    return actual;
  });
  observations.push({
    transfer: "BT.709 to sRGB",
    expected: transferExpected,
    actual: grayActual,
    tolerance: 3,
    metadata: await imageInfo(e, grayPath),
  });
  const source = await generateSmall(e, "transform.mkv", { alpha: true });
  const reference = referenceFrame(1, 4, 96, 64, true);
  const transforms = [
    {
      name: "clock",
      filter: "transpose=clock",
      width: 64,
      height: 96,
      source: (x: number, y: number) => [y, 63 - x],
    },
    {
      name: "cclock",
      filter: "transpose=cclock",
      width: 64,
      height: 96,
      source: (x: number, y: number) => [95 - y, x],
    },
    {
      name: "hflip",
      filter: "hflip",
      width: 96,
      height: 64,
      source: (x: number, y: number) => [95 - x, y],
    },
    {
      name: "vflip",
      filter: "vflip",
      width: 96,
      height: 64,
      source: (x: number, y: number) => [x, 63 - y],
    },
  ];
  for (const t of transforms) {
    const path = join(e.path, `${t.name}.png`);
    await e.tool(FFMPEG, [
      ...STRICT_INPUT,
      "-noautorotate",
      "-i",
      source,
      "-frames:v",
      "1",
      "-vf",
      `${t.filter},setsar=1,format=rgba`,
      "-map_metadata",
      "-1",
      "-c:v",
      "png",
      path,
    ]);
    e.images(1);
    const expectedPixels = Buffer.alloc(t.width * t.height * 4);
    for (let y = 0; y < t.height; y++)
      for (let x = 0; x < t.width; x++) {
        const [sx, sy] = t.source(x, y);
        reference.copy(
          expectedPixels,
          (y * t.width + x) * 4,
          (sy! * 96 + sx!) * 4,
          (sy! * 96 + sx!) * 4 + 4,
        );
      }
    assert.deepEqual(await decodedPixels(e, path), expectedPixels);
    observations.push({ transform: t.name, independentPixels: true, alpha: true });
  }
  return {
    observations,
    unsupportedColorScope:
      "HDR/wide-gamut conversion remains unsupported; production metadata validation is Phase 4",
  };
}
