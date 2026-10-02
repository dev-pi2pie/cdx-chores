// Explicit production quality/scale proof. Reference pixels and presets are independent.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { exportResolvedFrames } from "../../../src/cli/video-frames/export";
import { FrameResolver } from "../../../src/cli/video-frames/resolver";
import {
  extractedProfile,
  imagePayload,
  inspectProfile,
  type Transfer,
} from "./color-profile-proof";
import type { Experiment } from "./lab";
import { FFMPEG, FFPROBE } from "./tools";

const TOOL = ["-nostdin", "-v", "error", "-threads", "1", "-filter_threads", "1"];
const SCALES = [1, 0.5, 0.1] as const;
// The lossy comparison checks matching presets, not lossless equivalence to source pixels.
const CODEC_REFERENCE_TOLERANCE = 3;

export async function proveQualityAndScale(e: Experiment, source: string, transfer: Transfer) {
  const metadata = JSON.parse(
    (
      await e.tool(FFPROBE, [
        "-v",
        "error",
        "-show_entries",
        "stream=width,height,pix_fmt,color_space,color_range,color_primaries,color_transfer",
        "-of",
        "json",
        source,
      ])
    ).stdout.toString("utf8"),
  ).streams[0];
  assert.deepEqual([metadata.width, metadata.height], [256, 32]);
  assert.equal(metadata.color_primaries, "bt709");
  assert.equal(metadata.color_transfer, transfer);
  assert.ok(["bt709", "smpte170m", "bt470bg"].includes(metadata.color_space));
  assert.ok(["tv", "pc"].includes(metadata.color_range));
  const matrix = metadata.color_space === "bt709" ? "bt709" : "bt601";
  const original = (
    await e.tool(FFMPEG, [
      ...TOOL,
      "-noautorotate",
      "-i",
      source,
      "-frames:v",
      "1",
      "-vf",
      `scale=in_color_matrix=${matrix}:in_range=${metadata.color_range}:out_range=pc,format=rgba`,
      "-pix_fmt",
      "rgba",
      "-f",
      "rawvideo",
      "pipe:1",
    ])
  ).stdout;
  assert.equal(original.length, 256 * 32 * 4);
  for (let offset = 3; offset < original.length; offset += 4) assert.equal(original[offset], 255);
  const resolver = new FrameResolver(source, { ffprobe: FFPROBE });
  const identity = await resolver.resolve({ kind: "first" }, e.signal);
  const results = [];
  for (const scale of SCALES) {
    const width = Math.max(1, Math.floor(256 * scale + 0.5));
    const height = Math.max(1, Math.floor(32 * scale + 0.5));
    const reference = nearestPixels(original, 256, 32, width, height);
    const rawFile = join(e.path, `reference-${scale}.rgba`);
    await writeFile(rawFile, reference);
    for (const format of ["png", "jpg", "webp"] as const)
      for (const quality of format === "png"
        ? (["full"] as const)
        : (["low", "medium", "high", "full"] as const)) {
        const name = `${format}-${quality}-${scale}`;
        const bareFile = join(e.path, `reference-${name}.${format}`);
        const tags = `setparams=range=full:color_primaries=bt709:color_trc=${transfer}:colorspace=gbr`;
        // Do not use encoderArguments/imagePlan to construct these independent references.
        const preset =
          format === "png"
            ? ["-vf", `format=rgba,setsar=1,${tags}`, "-c:v", "png", "-compression_level", "9"]
            : format === "jpg"
              ? [
                  "-vf",
                  `scale=in_range=pc:out_range=pc:out_color_matrix=bt601,format=yuvj444p,setsar=1,setparams=range=full:color_primaries=bt709:color_trc=${transfer}:colorspace=smpte170m`,
                  "-c:v",
                  "mjpeg",
                  "-q:v",
                  String({ low: 12, medium: 6, high: 3, full: 1 }[quality]),
                  "-qmin",
                  "1",
                  "-qmax",
                  "31",
                ]
              : [
                  "-vf",
                  `format=bgra,setsar=1,${tags}`,
                  "-c:v",
                  "libwebp",
                  "-lossless",
                  quality === "full" ? "1" : "0",
                  "-quality",
                  String({ low: 40, medium: 70, high: 90, full: 100 }[quality]),
                  "-compression_level",
                  "4",
                ];
        await e.tool(FFMPEG, [
          ...TOOL,
          "-f",
          "rawvideo",
          "-pixel_format",
          "rgba",
          "-video_size",
          `${width}x${height}`,
          "-framerate",
          "1",
          "-i",
          rawFile,
          "-frames:v",
          "1",
          ...preset,
          "-threads",
          "1",
          "-map_metadata",
          "-1",
          "-f",
          "image2",
          "-update",
          "1",
          "-y",
          bareFile,
        ]);
        e.images(1);
        const outputName = `production-${name}.${format}`;
        const result = await exportResolvedFrames(resolver, [{ identity, name: outputName }], {
          folder: e.path,
          image: { format, quality, scale },
          ffmpeg: FFMPEG,
          ffprobe: FFPROBE,
          signal: e.signal,
        });
        e.images(result.written);
        assert.equal(result.completed, true);
        assert.equal(result.written, 1);
        assert.deepEqual([result.width, result.height], [width, height]);
        assert.ok(result.peaks.rawFrames <= 1);
        assert.ok(result.peaks.files <= 2);
        const savedFile = join(e.path, outputName);
        const saved = await readFile(savedFile);
        const bare = await readFile(bareFile);
        const profile = extractedProfile(saved, format);
        assert.ok(profile);
        const inspected = inspectProfile(profile, transfer);
        const profileFile = join(e.path, `${name}.icc`);
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
        const decode = async (file: string) =>
          (
            await e.tool(FFMPEG, [
              ...TOOL,
              "-i",
              file,
              "-frames:v",
              "1",
              "-pix_fmt",
              "rgba",
              "-f",
              "rawvideo",
              "pipe:1",
            ])
          ).stdout;
        const savedPixels = await decode(savedFile);
        const barePixels = await decode(bareFile);
        assert.equal(savedPixels.length, width * height * 4);
        assert.equal(barePixels.length, savedPixels.length);
        const lossless = format === "png" || (format === "webp" && quality === "full");
        const maximumCodecReferenceError = maximumError(savedPixels, barePixels);
        assert.ok(
          maximumCodecReferenceError <= CODEC_REFERENCE_TOLERANCE,
          `${name} codec reference error ${maximumCodecReferenceError}`,
        );
        if (lossless)
          assert.deepEqual(
            savedPixels,
            reference,
            `${name} must preserve exact post-transform RGBA`,
          );
        const payloadEquivalent = imagePayload(saved, format).equals(imagePayload(bare, format));
        assert.ok(
          payloadEquivalent,
          `${name} image payload differs from independently encoded preset`,
        );
        results.push({
          format,
          quality,
          scale,
          width,
          height,
          transfer,
          ...inspected,
          cmm,
          lossless,
          maximumCodecReferenceError,
          maximumPostTransformError: maximumError(savedPixels, reference),
          payloadEquivalent,
        });
      }
  }
  return {
    sourceMetadata: metadata,
    results,
    outputImages: results.length,
    codecReferenceTolerance: CODEC_REFERENCE_TOLERANCE,
  };
}

function nearestPixels(
  source: Buffer,
  width: number,
  height: number,
  outputWidth: number,
  outputHeight: number,
) {
  const output = Buffer.alloc(outputWidth * outputHeight * 4);
  for (let y = 0; y < outputHeight; y++)
    for (let x = 0; x < outputWidth; x++) {
      const originalX = Math.min(width - 1, Math.floor(((x + 0.5) * width) / outputWidth));
      const originalY = Math.min(height - 1, Math.floor(((y + 0.5) * height) / outputHeight));
      const offset = (originalY * width + originalX) * 4;
      source.copy(output, (y * outputWidth + x) * 4, offset, offset + 4);
    }
  return output;
}
function maximumError(actual: Buffer, expected: Buffer) {
  assert.equal(actual.length, expected.length);
  let maximum = 0;
  for (let i = 0; i < actual.length; i++)
    maximum = Math.max(maximum, Math.abs(actual[i]! - expected[i]!));
  return maximum;
}

export async function inspectNearestCoordinates(e: Experiment) {
  const cases = [];
  for (const [width, height, outputWidth, outputHeight] of [
    [32, 16, 16, 8],
    [17, 9, 9, 5],
    [256, 32, 26, 3],
    [256, 32, 128, 16],
  ]) {
    const pixels = Buffer.alloc(width! * height! * 3);
    for (let y = 0; y < height!; y++)
      for (let x = 0; x < width!; x++) {
        const offset = (y * width! + x) * 3;
        pixels[offset] = 40 + (x % 32) * 4;
        pixels[offset + 1] = 40 + Math.floor(x / 32) * 16;
        pixels[offset + 2] = 40 + y * 4;
      }
    const source = join(e.path, `coordinate-${width}x${height}.rgb`);
    await writeFile(source, pixels);
    for (const format of ["rgb24", "rgba"] as const)
      for (const flags of ["neighbor", "neighbor+full_chroma_int"] as const) {
        const components = (
          await e.tool(FFMPEG, [
            ...TOOL,
            "-f",
            "rawvideo",
            "-pixel_format",
            "rgb24",
            "-video_size",
            `${width}x${height}`,
            "-i",
            source,
            "-vf",
            `setparams=range=pc:color_primaries=bt709:color_trc=bt709:colorspace=gbr,scale=${width}:${height}:flags=neighbor,setsar=1,scale=${outputWidth}:${outputHeight}:flags=${flags},setsar=1,format=${format}`,
            "-frames:v",
            "1",
            "-pix_fmt",
            format,
            "-f",
            "rawvideo",
            "pipe:1",
          ])
        ).stdout;
        const channels = format === "rgb24" ? 3 : 4;
        assert.equal(components.length, outputWidth! * outputHeight! * channels);
        const columns = Array.from(
          { length: outputWidth! },
          (_, x) =>
            Math.round((components[x * channels]! - 40) / 4) +
            Math.round((components[x * channels + 1]! - 40) / 16) * 32,
        );
        const rows = Array.from({ length: outputHeight! }, (_, y) =>
          Math.round((components[y * outputWidth! * channels + 2]! - 40) / 4),
        );
        let maximumRGBError = 0;
        for (let y = 0; y < outputHeight!; y++)
          for (let x = 0; x < outputWidth!; x++)
            for (let c = 0; c < 3; c++)
              maximumRGBError = Math.max(
                maximumRGBError,
                Math.abs(
                  components[(y * outputWidth! + x) * channels + c]! -
                    pixels[(rows[y]! * width! + columns[x]!) * 3 + c]!,
                ),
              );
        cases.push({
          width,
          height,
          outputWidth,
          outputHeight,
          format,
          flags,
          columns,
          rows,
          maximumRGBError,
        });
      }
  }
  return { cases };
}
