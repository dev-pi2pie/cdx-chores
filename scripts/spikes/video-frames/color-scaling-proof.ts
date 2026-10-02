// Opt-in spatial sampling investigation. Keep observed arithmetic separate from coordinates.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { exportResolvedFrames } from "../../../src/cli/video-frames/export";
import { FrameResolver } from "../../../src/cli/video-frames/resolver";
import { extractedProfile, inspectProfile, type Transfer } from "./color-profile-proof";
import { createLab, type Experiment } from "./lab";
import { FFMPEG, FFPROBE } from "./tools";

const WIDTH = 32;
const HEIGHT = 16;
const TOOL = ["-nostdin", "-v", "error", "-threads", "1", "-filter_threads", "1"];
const TAGS = "setparams=range=pc:color_primaries=bt709:color_trc=iec61966-2-1:colorspace=gbr";

export async function investigateScaling(e: Experiment) {
  const rgb = coordinateColors();
  const rgbFile = join(e.path, "spatial.rgb");
  await writeFile(rgbFile, rgb);
  const rgba = toRgba(rgb);
  const rgbaFile = join(e.path, "spatial.rgba");
  await writeFile(rgbaFile, rgba);
  const rgbSource = join(e.path, "spatial.nut");
  await e.tool(FFMPEG, [
    ...TOOL,
    "-f",
    "rawvideo",
    "-pixel_format",
    "rgb24",
    "-video_size",
    `${WIDTH}x${HEIGHT}`,
    "-i",
    rgbFile,
    "-frames:v",
    "1",
    "-c:v",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    "-threads",
    "1",
    "-f",
    "nut",
    "-y",
    rgbSource,
  ]);
  const expected = nearest(rgba, WIDTH, HEIGHT, WIDTH / 2, HEIGHT / 2);
  const routes = [];
  for (const format of ["rgb24", "rgba"] as const)
    for (const intermediate of ["unchanged", "gbrp"] as const)
      for (const earlyTags of [false, true])
        for (const flags of ["neighbor", "neighbor+full_chroma_int+full_chroma_inp"] as const) {
          const filters = [
            ...(earlyTags ? [TAGS] : []),
            ...(intermediate === "gbrp" ? ["format=gbrp"] : []),
            `scale=${WIDTH}:${HEIGHT}:flags=${flags}`,
            ...(intermediate === "gbrp" ? ["format=gbrp"] : []),
            "setsar=1",
            `scale=${WIDTH / 2}:${HEIGHT / 2}:flags=${flags}`,
            ...(intermediate === "gbrp" ? ["format=gbrp"] : []),
            "setsar=1",
            "format=rgba",
            TAGS,
          ];
          const actual = (
            await e.tool(FFMPEG, [
              ...TOOL,
              "-f",
              "rawvideo",
              "-pixel_format",
              format,
              "-video_size",
              `${WIDTH}x${HEIGHT}`,
              "-i",
              format === "rgb24" ? rgbFile : rgbaFile,
              "-vf",
              filters.join(","),
              "-frames:v",
              "1",
              "-pix_fmt",
              "rgba",
              "-f",
              "rawvideo",
              "pipe:1",
            ])
          ).stdout;
          const comparison = difference(actual, expected);
          if (flags.includes("full_chroma_inp")) assert.equal(comparison.maximumError, 0);
          routes.push({ format, intermediate, earlyTags, flags, ...comparison });
        }
  const rgbProduction = await productionSamples(e, rgbSource, rgba, "rgb", "iec61966-2-1");
  const partialAlpha = Buffer.from(rgba);
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++)
      partialAlpha[(y * WIDTH + x) * 4 + 3] = x < WIDTH / 2 ? 127 : 255;
  const alphaFile = join(e.path, "partial-alpha.rgba");
  await writeFile(alphaFile, partialAlpha);
  const alphaSource = join(e.path, "partial-alpha.nut");
  await e.tool(FFMPEG, [
    ...TOOL,
    "-f",
    "rawvideo",
    "-pixel_format",
    "rgba",
    "-video_size",
    `${WIDTH}x${HEIGHT}`,
    "-i",
    alphaFile,
    "-frames:v",
    "1",
    "-c:v",
    "rawvideo",
    "-pix_fmt",
    "rgba",
    "-threads",
    "1",
    "-f",
    "nut",
    "-y",
    alphaSource,
  ]);
  const alphaProduction = await productionSamples(
    e,
    alphaSource,
    partialAlpha,
    "alpha",
    "iec61966-2-1",
  );

  const yuv = Buffer.alloc(WIDTH * HEIGHT * 3);
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      const offset = y * WIDTH + x;
      yuv[offset] = 16 + ((x * 17 + y * 31) % 220);
      yuv[WIDTH * HEIGHT + offset] = 16 + ((x * 13 + y * 7) % 225);
      yuv[WIDTH * HEIGHT * 2 + offset] = 16 + ((x * 7 + y * 19) % 225);
    }
  const yuvFile = join(e.path, "spatial.yuv");
  await writeFile(yuvFile, yuv);
  const yuvSource = join(e.path, "spatial.mp4");
  await e.tool(FFMPEG, [
    ...TOOL,
    "-f",
    "rawvideo",
    "-pixel_format",
    "yuv444p",
    "-video_size",
    `${WIDTH}x${HEIGHT}`,
    "-color_range",
    "tv",
    "-i",
    yuvFile,
    "-vf",
    "setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709",
    "-frames:v",
    "1",
    "-c:v",
    "libx264",
    "-crf",
    "0",
    "-preset",
    "ultrafast",
    "-pix_fmt",
    "yuv444p",
    "-colorspace",
    "bt709",
    "-color_range",
    "tv",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-bsf:v",
    "h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0",
    "-threads",
    "1",
    "-y",
    yuvSource,
  ]);
  const decodedYuv = (
    await e.tool(FFMPEG, [
      ...TOOL,
      "-i",
      yuvSource,
      "-frames:v",
      "1",
      "-pix_fmt",
      "yuv444p",
      "-f",
      "rawvideo",
      "pipe:1",
    ])
  ).stdout;
  assert.deepEqual(decodedYuv, yuv);
  const decodedRgb = (
    await e.tool(FFMPEG, [
      ...TOOL,
      "-i",
      yuvSource,
      "-vf",
      "scale=in_color_matrix=bt709:in_range=tv:out_range=pc:flags=accurate_rnd+full_chroma_int+full_chroma_inp,format=rgb24",
      "-frames:v",
      "1",
      "-pix_fmt",
      "rgb24",
      "-f",
      "rawvideo",
      "pipe:1",
    ])
  ).stdout;
  const yuvReference = toRgba(decodedRgb);
  const yuvProduction = await productionSamples(e, yuvSource, yuvReference, "yuv", "bt709");
  const sourceRoutes = [];
  for (const intermediate of ["rgb24", "rgba", "gbrp"] as const)
    for (const earlyTags of [false, true])
      for (const flags of ["neighbor", "neighbor+full_chroma_int+full_chroma_inp"] as const) {
        const actual = (
          await e.tool(FFMPEG, [
            ...TOOL,
            "-i",
            yuvSource,
            "-vf",
            [
              `scale=in_color_matrix=bt709:in_range=tv:out_range=pc:flags=accurate_rnd+full_chroma_int+full_chroma_inp,format=${intermediate}`,
              ...(earlyTags
                ? ["setparams=range=pc:color_primaries=bt709:color_trc=bt709:colorspace=gbr"]
                : []),
              `scale=${WIDTH}:${HEIGHT}:flags=${flags}`,
              ...(intermediate === "gbrp" ? ["format=gbrp"] : []),
              "setsar=1",
              `scale=${WIDTH / 2}:${HEIGHT / 2}:flags=${flags}`,
              ...(intermediate === "gbrp" ? ["format=gbrp"] : []),
              "setsar=1",
              "format=rgba",
            ].join(","),
            "-frames:v",
            "1",
            "-pix_fmt",
            "rgba",
            "-f",
            "rawvideo",
            "pipe:1",
          ])
        ).stdout;
        const comparison = difference(
          actual,
          nearest(yuvReference, WIDTH, HEIGHT, WIDTH / 2, HEIGHT / 2),
        );
        if (flags.includes("full_chroma_inp")) assert.equal(comparison.maximumError, 0);
        sourceRoutes.push({
          intermediate,
          earlyTags,
          flags,
          ...comparison,
        });
      }
  return {
    rgbRoutes: routes,
    rgbProduction,
    yuvProduction,
    alphaProduction,
    yuvRoutes: sourceRoutes,
  };
}

async function productionSamples(
  e: Experiment,
  source: string,
  reference: Buffer,
  name: string,
  transfer: Transfer,
) {
  const resolver = new FrameResolver(source, { ffprobe: FFPROBE });
  const identity = await resolver.resolve({ kind: "first" }, e.signal);
  const outputs = [];
  for (const scale of [1, 0.5, 0.1])
    for (const format of ["png", "webp"] as const) {
      const width = Math.floor(WIDTH * scale + 0.5);
      const height = Math.floor(HEIGHT * scale + 0.5);
      const file = `${name}-${scale}.${format}`;
      const result = await exportResolvedFrames(resolver, [{ identity, name: file }], {
        folder: e.path,
        image: { format, scale },
        ffmpeg: FFMPEG,
        ffprobe: FFPROBE,
        signal: e.signal,
      });
      e.images(result.written);
      assert.equal(result.completed, true);
      assert.deepEqual([result.width, result.height], [width, height]);
      const saved = join(e.path, file);
      const profile = extractedProfile(await readFile(saved), format)!;
      inspectProfile(profile, transfer);
      const profileFile = join(e.path, `${name}-${scale}-${format}.icc`);
      await writeFile(profileFile, profile);
      const cmm = JSON.parse(
        (
          await e.tool("python3", [
            resolve("scripts/spikes/video-frames/color-profile-lcms.py"),
            profileFile,
            transfer,
          ])
        ).stdout.toString("utf8"),
      );
      const actual = (
        await e.tool(FFMPEG, [
          ...TOOL,
          "-i",
          saved,
          "-frames:v",
          "1",
          "-pix_fmt",
          "rgba",
          "-f",
          "rawvideo",
          "pipe:1",
        ])
      ).stdout;
      const comparison = difference(
        actual,
        scale === 1 ? reference : nearest(reference, WIDTH, HEIGHT, width, height),
      );
      assert.equal(comparison.maximumError, 0);
      outputs.push({ scale, format, width, height, cmm, ...comparison });
    }
  return outputs;
}
function coordinateColors() {
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 3);
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      const offset = (y * WIDTH + x) * 3;
      pixels[offset] = x * 8;
      pixels[offset + 1] = y * 16;
      pixels[offset + 2] = (x * 17 + y * 31) % 256;
    }
  return pixels;
}
function toRgba(rgb: Buffer) {
  const rgba = Buffer.alloc((rgb.length / 3) * 4);
  for (let pixel = 0; pixel < rgb.length / 3; pixel++) {
    rgb.copy(rgba, pixel * 4, pixel * 3, pixel * 3 + 3);
    rgba[pixel * 4 + 3] = 255;
  }
  return rgba;
}
function nearest(
  pixels: Buffer,
  width: number,
  height: number,
  outputWidth: number,
  outputHeight: number,
) {
  const output = Buffer.alloc(outputWidth * outputHeight * 4);
  for (let y = 0; y < outputHeight; y++)
    for (let x = 0; x < outputWidth; x++) {
      const sourceX = Math.min(width - 1, Math.floor(((x + 0.5) * width) / outputWidth));
      const sourceY = Math.min(height - 1, Math.floor(((y + 0.5) * height) / outputHeight));
      const offset = (sourceY * width + sourceX) * 4;
      pixels.copy(output, (y * outputWidth + x) * 4, offset, offset + 4);
    }
  return output;
}
function difference(actual: Buffer, expected: Buffer) {
  assert.equal(actual.length, expected.length);
  let maximumError = 0;
  let differingSamples = 0;
  let sum = 0;
  for (let i = 0; i < actual.length; i++) {
    const error = Math.abs(actual[i]! - expected[i]!);
    maximumError = Math.max(maximumError, error);
    if (error) differingSamples++;
    sum += error;
  }
  return { maximumError, differingSamples, meanError: sum / actual.length };
}

if (process.argv.includes("--run-scaling")) {
  const lab = await createLab(10);
  try {
    await lab.check("spatial-scaling", 18, 2 * 1024 * 1024, async (e) => {
      const result = await investigateScaling(e);
      console.log(
        JSON.stringify({
          rgbMaximum: Math.max(...result.rgbProduction.map((r) => r.maximumError)),
          yuvMaximum: Math.max(...result.yuvProduction.map((r) => r.maximumError)),
          alphaMaximum: Math.max(...result.alphaProduction.map((r) => r.maximumError)),
        }),
      );
      return result;
    });
  } finally {
    lab.finish();
  }
}
