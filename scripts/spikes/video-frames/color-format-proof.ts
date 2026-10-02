// Opt-in source packing evidence. Rawvideo NUT color metadata loss is recorded explicitly.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { imagePlan } from "../../../src/cli/video-frames/image-plan";
import { FrameResolver } from "../../../src/cli/video-frames/resolver";
import { inspectProfile, type Transfer } from "./color-profile-proof";
import { proveProduction } from "./color-production-proof";
import { createLab, type Experiment } from "./lab";
import { FFMPEG, FFPROBE } from "./tools";

const WIDTH = 64;
const HEIGHT = 16;
const TOOL = ["-nostdin", "-v", "error", "-threads", "1", "-filter_threads", "1"];
const RGB_FORMATS = [
  "rgba",
  "bgra",
  "argb",
  "abgr",
  "rgb24",
  "bgr24",
  "rgb0",
  "bgr0",
  "0rgb",
  "0bgr",
] as const;
const YUV_FORMATS = ["nv12", "nv21", "yuva420p", "yuva422p", "yuva444p"] as const;
type Format = (typeof RGB_FORMATS)[number] | (typeof YUV_FORMATS)[number];

export async function proveSourceFormat(e: Experiment, format: Format) {
  const rgb = (RGB_FORMATS as readonly string[]).includes(format);
  const alpha = /^(?:rgba|bgra|argb|abgr|yuva)/.test(format);
  const pixels = rgb ? rgbReference(alpha) : undefined;
  const input = rgb ? packRgb(pixels!, format) : packYuv(format);
  const rawFile = join(e.path, "source.raw");
  const source = join(e.path, "source.nut");
  await writeFile(rawFile, input);
  await e.tool(FFMPEG, [
    ...TOOL,
    "-f",
    "rawvideo",
    "-pixel_format",
    format,
    "-video_size",
    `${WIDTH}x${HEIGHT}`,
    "-framerate",
    "1",
    "-i",
    rawFile,
    "-frames:v",
    "1",
    "-c:v",
    "rawvideo",
    "-pix_fmt",
    format,
    "-threads",
    "1",
    "-f",
    "nut",
    "-y",
    source,
  ]);
  const metadata = JSON.parse(
    (
      await e.tool(FFPROBE, [
        "-v",
        "error",
        "-show_entries",
        "stream=codec_name,width,height,pix_fmt,color_space,color_range,color_primaries,color_transfer",
        "-of",
        "json",
        source,
      ])
    ).stdout.toString("utf8"),
  ).streams[0];
  assert.equal(metadata.codec_name, "rawvideo");
  assert.deepEqual([metadata.width, metadata.height], [WIDTH, HEIGHT]);
  // Native NUT does not retain these fields. Test documented defaults, then explicit plan tags.
  assert.ok(metadata.color_primaries === undefined || metadata.color_primaries === "unknown");
  assert.ok(metadata.color_transfer === undefined || metadata.color_transfer === "unknown");
  const conversion = rgb
    ? "format=rgba"
    : "scale=in_color_matrix=bt601:in_range=tv:out_range=pc,format=rgb24";
  const components = (
    await e.tool(FFMPEG, [
      ...TOOL,
      "-i",
      source,
      "-frames:v",
      "1",
      "-vf",
      conversion,
      "-pix_fmt",
      rgb ? "rgba" : "rgb24",
      "-f",
      "rawvideo",
      "pipe:1",
    ])
  ).stdout;
  // Source alpha is an independent plane. Some swscale YUVA->RGBA paths round 255 to 254.
  const decoded = rgb ? components : rgbaWithDefinedAlpha(components, alpha);
  if (alpha && !rgb) {
    const alphaPixels = (
      await e.tool(FFMPEG, [
        ...TOOL,
        "-i",
        source,
        "-frames:v",
        "1",
        "-vf",
        "alphaextract",
        "-pix_fmt",
        "gray",
        "-f",
        "rawvideo",
        "pipe:1",
      ])
    ).stdout;
    assert.equal(alphaPixels.length, WIDTH * HEIGHT);
    for (let y = 0; y < HEIGHT; y++)
      for (let x = 0; x < WIDTH; x++)
        assert.equal(alphaPixels[y * WIDTH + x], x < WIDTH / 2 ? 127 : 255);
  }
  assert.equal(decoded.length, WIDTH * HEIGHT * 4);
  if (rgb) assert.deepEqual(decoded, pixels);
  else verifyYuvReference(decoded, alpha, "bt601", "tv");
  const resolver = new FrameResolver(source, { ffprobe: FFPROBE });
  await resolver.resolve({ kind: "first" }, e.signal);
  const stream = resolver.state.metadata!;
  const explicit = [];
  for (const transfer of ["bt709", "iec61966-2-1"] as const) {
    // These explicit tags exercise imagePlan against the exact native bytes, not NUT metadata.
    for (const matrix of rgb ? ["gbr"] : ["bt709", "smpte170m"])
      for (const range of rgb ? ["pc"] : ["tv", "pc"]) {
        const plan = imagePlan(
          {
            ...stream,
            image: {
              display: [],
              sampleAspectRatio: "1:1",
              colorSpace: matrix,
              colorRange: range,
              colorPrimaries: "bt709",
              colorTransfer: transfer,
            },
          },
          { format: "png", quality: "full", scale: 1 },
        );
        const actual = (
          await e.tool(FFMPEG, [
            ...TOOL,
            "-noautorotate",
            "-i",
            source,
            "-filter_complex",
            plan.filters,
            "-map",
            "[out]",
            "-frames:v",
            "1",
            "-pix_fmt",
            "rgba",
            "-f",
            "rawvideo",
            "pipe:1",
          ])
        ).stdout;
        if (rgb) assert.deepEqual(actual, pixels);
        else verifyYuvReference(actual, alpha, matrix === "bt709" ? "bt709" : "bt601", range);
        inspectProfile(plan.profile.icc, transfer);
        explicit.push({ transfer, matrix, range, nativeFilterAndPlan: "passed" });
      }
  }
  const defaultTransfer: Transfer = rgb ? "iec61966-2-1" : "bt709";
  const production = await proveProduction(
    e,
    source,
    decoded,
    WIDTH,
    HEIGHT,
    defaultTransfer,
    false,
  );
  return {
    requestedPixelFormat: format,
    nativePixelFormat: metadata.pix_fmt,
    aliasNormalized: metadata.pix_fmt !== format,
    sourceMetadata: metadata,
    nativeExportInterpretation: rgb
      ? "default BT.709 primaries, sRGB transfer, GBR/full"
      : "default BT.709 primaries/transfer, SMPTE170M/limited",
    explicitInterpretationBoundary:
      "native filters through production imagePlan with injected definitions, not NUT-preserved metadata",
    explicit,
    production,
  };
}

function rgbReference(alpha: boolean) {
  const patches = [
    [0, 0, 0],
    [19, 19, 19],
    [64, 64, 64],
    [128, 128, 128],
    [255, 255, 255],
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
  ];
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      const offset = (y * WIDTH + x) * 4;
      const patch = patches[Math.floor(x / 8)]!;
      for (let channel = 0; channel < 3; channel++) pixels[offset + channel] = patch[channel]!;
      pixels[offset + 3] = alpha && x < WIDTH / 2 ? 127 : 255;
    }
  return pixels;
}
function rgbaWithDefinedAlpha(rgb: Buffer, alpha: boolean) {
  assert.equal(rgb.length, WIDTH * HEIGHT * 3);
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      const pixel = y * WIDTH + x;
      rgb.copy(pixels, pixel * 4, pixel * 3, pixel * 3 + 3);
      pixels[pixel * 4 + 3] = alpha && x < WIDTH / 2 ? 127 : 255;
    }
  return pixels;
}
function packRgb(pixels: Buffer, format: string) {
  const layouts: Record<string, string> = {
    rgba: "rgba",
    bgra: "bgra",
    argb: "argb",
    abgr: "abgr",
    rgb24: "rgb",
    bgr24: "bgr",
    rgb0: "rgb0",
    bgr0: "bgr0",
    "0rgb": "0rgb",
    "0bgr": "0bgr",
  };
  const layout = layouts[format]!;
  const packed = Buffer.alloc(WIDTH * HEIGHT * layout.length);
  for (let pixel = 0; pixel < WIDTH * HEIGHT; pixel++)
    for (let channel = 0; channel < layout.length; channel++) {
      const letter = layout[channel]!;
      packed[pixel * layout.length + channel] =
        letter === "0" ? 0 : pixels[pixel * 4 + "rgba".indexOf(letter)]!;
    }
  return packed;
}
const YUV_PATCHES = [
  [16, 128, 128],
  [32, 128, 128],
  [64, 128, 128],
  [128, 128, 128],
  [235, 128, 128],
  [81, 90, 240],
  [145, 54, 34],
  [41, 240, 110],
];
function packYuv(format: string) {
  const sampling = format.includes("444") ? "444" : format.includes("422") ? "422" : "420";
  const planes: Buffer[] = [];
  for (let channel = 0; channel < 3; channel++) {
    const width = channel === 0 || sampling === "444" ? WIDTH : WIDTH / 2;
    const height = channel === 0 || sampling !== "420" ? HEIGHT : HEIGHT / 2;
    const plane = Buffer.alloc(width * height);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        plane[y * width + x] = YUV_PATCHES[Math.floor(x / (width / 8))]![channel]!;
    planes.push(plane);
  }
  if (format === "nv12" || format === "nv21") {
    const interleaved = Buffer.alloc(planes[1]!.length * 2);
    for (let i = 0; i < planes[1]!.length; i++) {
      interleaved[i * 2] = planes[format === "nv12" ? 1 : 2]![i]!;
      interleaved[i * 2 + 1] = planes[format === "nv12" ? 2 : 1]![i]!;
    }
    return Buffer.concat([planes[0]!, interleaved]);
  }
  const alpha = Buffer.alloc(WIDTH * HEIGHT);
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) alpha[y * WIDTH + x] = x < WIDTH / 2 ? 127 : 255;
  return Buffer.concat([...planes, alpha]);
}
function verifyYuvReference(actual: Buffer, alpha: boolean, matrix: string, range: string) {
  assert.equal(actual.length, WIDTH * HEIGHT * 4);
  const kr = matrix === "bt709" ? 0.2126 : 0.299;
  const kb = matrix === "bt709" ? 0.0722 : 0.114;
  const kg = 1 - kr - kb;
  for (let patch = 0; patch < 8; patch++) {
    const [y, cb, cr] = YUV_PATCHES[patch]!;
    const yy = range === "tv" ? ((y! - 16) * 255) / 219 : y!;
    const u = (cb! - 128) * (range === "tv" ? 255 / 224 : 1);
    const v = (cr! - 128) * (range === "tv" ? 255 / 224 : 1);
    const expected = [
      yy + 2 * (1 - kr) * v,
      yy - ((2 * kb * (1 - kb)) / kg) * u - ((2 * kr * (1 - kr)) / kg) * v,
      yy + 2 * (1 - kb) * u,
    ].map((value) => Math.max(0, Math.min(255, Math.round(value))));
    const offset = (8 * WIDTH + patch * 8 + 4) * 4;
    for (let channel = 0; channel < 3; channel++)
      assert.ok(Math.abs(actual[offset + channel]! - expected[channel]!) <= 2);
  }
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++)
      assert.equal(actual[(y * WIDTH + x) * 4 + 3], alpha && x < WIDTH / 2 ? 127 : 255);
}

async function main() {
  const lab = await createLab(10);
  try {
    for (const format of [...RGB_FORMATS, ...YUV_FORMATS])
      await lab.check(`source-format-${format}`, 2, 1024 * 1024, (e) =>
        proveSourceFormat(e, format),
      );
  } finally {
    lab.finish();
  }
}
if (process.argv.includes("--run")) await main();
