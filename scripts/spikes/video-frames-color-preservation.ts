// Opt-in, bounded source-transfer/profile evidence. No production reference generation.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createLab } from "./video-frames/lab";
import { FFMPEG, FFPROBE } from "./video-frames/tools";
import { proveProduction } from "./video-frames/color-production-proof";
import {
  embedReference,
  extractedProfile,
  imagePayload,
  inspectProfile,
  pngChunks,
  referenceProfile,
  riffChunks,
} from "./video-frames/color-profile-proof";

const BASE = ["-nostdin", "-v", "error", "-threads", "1", "-filter_threads", "1"];
const WIDTH = 256;
const HEIGHT = 32;
const PATCHES = 8;
const production = process.argv.includes("--production");

async function main() {
  const lab = await createLab(10);
  try {
    await lab.check("profile-and-tools", 0, 1024 * 1024, async (e) => {
      const version = (await e.tool(FFMPEG, ["-version"], { allowFailure: true })).stdout.toString(
        "utf8",
      );
      const filter = await e.tool(FFMPEG, ["-hide_banner", "-h", "filter=iccgen"], {
        allowFailure: true,
      });
      const iccgenAvailable = !`${filter.stdout.toString("utf8")} ${filter.stderr}`.includes(
        "Unknown filter",
      );
      const profiles = [];
      for (const transfer of ["bt709", "iec61966-2-1"] as const) {
        const profile = referenceProfile(transfer);
        const file = join(e.path, `${transfer}.icc`);
        await writeFile(file, profile);
        const inspected = inspectProfile(profile, transfer);
        const independentCMM = JSON.parse(
          (
            await e.tool("python3", [
              resolve("scripts/spikes/video-frames/color-profile-lcms.py"),
              file,
              transfer,
            ])
          ).stdout.toString("utf8"),
        );
        let nativeValidation = "not tested";
        if (process.platform === "darwin") {
          const result = await e.tool("/usr/bin/sips", ["--verify", file], { allowFailure: true });
          assert.equal(result.code, 0, result.stderr);
          nativeValidation = result.stdout.toString("utf8").includes("Header message digest")
            ? "MD5 verifier warning"
            : "passed";
        }
        profiles.push({ transfer, ...inspected, independentCMM, nativeValidation });
      }
      return { build: version.split("\n").slice(0, 3), iccgenAvailable, profiles };
    });

    for (const matrix of ["bt709", "smpte170m", "bt470bg"] as const)
      for (const range of ["tv", "pc"] as const)
        for (const transfer of ["bt709", "iec61966-2-1"] as const)
          for (const sampling of ["420", "422", "444"] as const)
            await lab.check(
              `${matrix}-${range}-${transfer}-${sampling}`,
              production ? 9 : 6,
              2 * 1024 * 1024,
              async (e) => {
                const patches = yuvPatches(range);
                const raw = yuvImage(patches, sampling);
                const rawFile = join(e.path, "source.yuv");
                const source = join(e.path, "source.mp4");
                const pixelFormat = range === "pc" ? `yuvj${sampling}p` : `yuv${sampling}p`;
                await writeFile(rawFile, raw);
                await e.tool(FFMPEG, [
                  ...BASE,
                  "-f",
                  "rawvideo",
                  "-pixel_format",
                  `yuv${sampling}p`,
                  "-video_size",
                  `${WIDTH}x${HEIGHT}`,
                  "-color_range",
                  range,
                  "-i",
                  rawFile,
                  "-vf",
                  `setparams=range=${range}:color_primaries=bt709:color_trc=${transfer}:colorspace=${matrix}`,
                  "-frames:v",
                  "1",
                  "-c:v",
                  "libx264",
                  "-crf",
                  "0",
                  "-preset",
                  "ultrafast",
                  "-pix_fmt",
                  pixelFormat,
                  "-colorspace",
                  matrix,
                  "-color_range",
                  range,
                  "-color_primaries",
                  "bt709",
                  "-color_trc",
                  transfer,
                  "-bsf:v",
                  `h264_metadata=colour_primaries=1:transfer_characteristics=${transfer === "bt709" ? 1 : 13}:matrix_coefficients=${matrix === "bt709" ? 1 : matrix === "bt470bg" ? 5 : 6}:video_full_range_flag=${range === "pc" ? 1 : 0}`,
                  "-y",
                  source,
                ]);
                const metadata = JSON.parse(
                  (
                    await e.tool(FFPROBE, [
                      "-v",
                      "error",
                      "-show_entries",
                      "stream=pix_fmt,color_space,color_range,color_primaries,color_transfer",
                      "-of",
                      "json",
                      source,
                    ])
                  ).stdout.toString("utf8"),
                ).streams[0];
                assert.equal(metadata.pix_fmt, pixelFormat);
                assert.equal(metadata.color_space, matrix);
                assert.equal(metadata.color_range, range);
                assert.equal(metadata.color_primaries, "bt709");
                assert.equal(metadata.color_transfer, transfer);
                const decodedSource = (
                  await e.tool(FFMPEG, [
                    ...BASE,
                    "-i",
                    source,
                    "-frames:v",
                    "1",
                    "-pix_fmt",
                    pixelFormat,
                    "-f",
                    "rawvideo",
                    "pipe:1",
                  ])
                ).stdout;
                assert.deepEqual(decodedSource, raw);
                const rgba = (
                  await e.tool(FFMPEG, [
                    ...BASE,
                    "-i",
                    source,
                    "-frames:v",
                    "1",
                    "-vf",
                    `scale=in_color_matrix=${matrix === "bt709" ? "bt709" : "bt601"}:in_range=${range}:out_range=pc:flags=accurate_rnd+full_chroma_int+full_chroma_inp,format=rgba`,
                    "-f",
                    "rawvideo",
                    "pipe:1",
                  ])
                ).stdout;
                const rgbaFile = join(e.path, "representation.rgba");
                await writeFile(rgbaFile, rgba);
                const expected = patches.map((patch) => referenceRGB(patch, matrix, range));
                const actual = centers(rgba);
                let maximumConversionError = 0;
                actual.forEach((patch, i) =>
                  patch.forEach((value, channel) => {
                    maximumConversionError = Math.max(
                      maximumConversionError,
                      Math.abs(value - expected[i]![channel]!),
                    );
                    assert.ok(
                      Math.abs(value - expected[i]![channel]!) <= 2,
                      `${matrix}/${range} patch${i} channel${channel}`,
                    );
                  }),
                );
                const formats = [];
                for (const format of ["png", "jpg", "webp"] as const) {
                  const encoder =
                    format === "png"
                      ? ["-vf", "format=rgba,setsar=1", "-c:v", "png"]
                      : format === "jpg"
                        ? [
                            "-vf",
                            "scale=in_range=pc:out_range=pc:out_color_matrix=bt601,format=yuvj444p,setsar=1",
                            "-c:v",
                            "mjpeg",
                            "-q:v",
                            "1",
                            "-qmin",
                            "1",
                            "-qmax",
                            "31",
                          ]
                        : [
                            "-vf",
                            "format=bgra,setsar=1",
                            "-c:v",
                            "libwebp",
                            "-lossless",
                            "1",
                            "-quality",
                            "100",
                          ];
                  const bare = join(e.path, `bare.${format}`);
                  await e.tool(FFMPEG, [
                    ...BASE,
                    "-f",
                    "rawvideo",
                    "-pixel_format",
                    "rgba",
                    "-video_size",
                    `${WIDTH}x${HEIGHT}`,
                    "-i",
                    rgbaFile,
                    "-frames:v",
                    "1",
                    ...encoder,
                    "-f",
                    "image2",
                    "-update",
                    "1",
                    "-y",
                    bare,
                  ]);
                  e.images(1);
                  const encoded = await readFile(bare);
                  const profile = referenceProfile(transfer);
                  const saved = embedReference(encoded, format, profile, WIDTH, HEIGHT, false);
                  const output = join(e.path, `profiled.${format}`);
                  await writeFile(output, saved);
                  e.images(1);
                  assert.deepEqual(imagePayload(saved, format), imagePayload(encoded, format));
                  assert.deepEqual(extractedProfile(saved, format), profile);
                  inspectProfile(extractedProfile(saved, format)!, transfer);
                  if (format === "png")
                    assert.ok(
                      !pngChunks(saved).some((chunk) =>
                        ["sRGB", "cICP", "gAMA", "cHRM"].includes(chunk.type),
                      ),
                    );
                  if (format === "webp")
                    assert.ok(
                      (riffChunks(saved).find((chunk) => chunk.type === "VP8X")!.data[0]! &
                        0x20) !==
                        0,
                    );
                  const barePixels = (
                    await e.tool(FFMPEG, [
                      ...BASE,
                      "-i",
                      bare,
                      "-frames:v",
                      "1",
                      "-pix_fmt",
                      "rgba",
                      "-f",
                      "rawvideo",
                      "pipe:1",
                    ])
                  ).stdout;
                  const savedPixels = (
                    await e.tool(FFMPEG, [
                      ...BASE,
                      "-i",
                      output,
                      "-frames:v",
                      "1",
                      "-pix_fmt",
                      "rgba",
                      "-f",
                      "rawvideo",
                      "pipe:1",
                    ])
                  ).stdout;
                  assert.deepEqual(
                    savedPixels,
                    barePixels,
                    "Metadata attachment must not change image samples.",
                  );
                  if (format !== "jpg") assert.deepEqual(savedPixels, rgba);
                  const decoded = centers(savedPixels);
                  const maximumCenterError = Math.max(
                    ...decoded.flatMap((patch, i) =>
                      patch.map((value, channel) => Math.abs(value - actual[i]![channel]!)),
                    ),
                  );
                  assert.ok(maximumCenterError <= (format === "jpg" ? 3 : 0));
                  formats.push({
                    format,
                    encoderICC: extractedProfile(encoded, format) !== undefined,
                    payloadUnchanged: true,
                    decodedPixelsUnchanged: true,
                    maximumCenterError,
                    darkPatch: decoded[1],
                  });
                }
                return {
                  metadata,
                  expected,
                  actual,
                  maximumConversionError,
                  formats,
                  ...(production
                    ? {
                        production: await proveProduction(
                          e,
                          source,
                          rgba,
                          WIDTH,
                          HEIGHT,
                          transfer,
                          true,
                        ),
                      }
                    : {}),
                };
              },
            );

    for (const transfer of ["bt709", "iec61966-2-1"] as const)
      await lab.check(
        `rgb-alpha-and-odd-size-${transfer}`,
        production ? 6 : 4,
        2 * 1024 * 1024,
        async (e) => {
          const width = 17;
          const height = 9;
          const pixels = Buffer.alloc(width * height * 4);
          for (let i = 0; i < pixels.length; i += 4) {
            pixels[i] = (i * 3) % 256;
            pixels[i + 1] = 19;
            pixels[i + 2] = 128;
            pixels[i + 3] = i % 8 === 0 ? 127 : 255;
          }
          const raw = join(e.path, "source.rgba");
          await writeFile(raw, pixels);
          const source = join(e.path, "source.mkv");
          await e.tool(FFMPEG, [
            ...BASE,
            "-f",
            "rawvideo",
            "-pixel_format",
            "rgba",
            "-video_size",
            `${width}x${height}`,
            "-i",
            raw,
            "-vf",
            `setparams=range=pc:color_primaries=bt709:color_trc=${transfer}:colorspace=gbr`,
            "-frames:v",
            "1",
            "-c:v",
            "ffv1",
            "-pix_fmt",
            "bgra",
            "-color_range",
            "pc",
            "-colorspace",
            "rgb",
            "-color_primaries",
            "bt709",
            "-color_trc",
            transfer,
            "-y",
            source,
          ]);
          const metadata = JSON.parse(
            (
              await e.tool(FFPROBE, [
                "-v",
                "error",
                "-show_entries",
                "stream=pix_fmt,color_space,color_range,color_primaries,color_transfer",
                "-of",
                "json",
                source,
              ])
            ).stdout.toString("utf8"),
          ).streams[0];
          assert.equal(metadata.pix_fmt, "bgra");
          assert.equal(metadata.color_space, "gbr");
          assert.equal(metadata.color_range, "pc");
          assert.equal(metadata.color_primaries, "bt709");
          assert.equal(metadata.color_transfer, transfer);
          const sourcePixels = (
            await e.tool(FFMPEG, [
              ...BASE,
              "-i",
              source,
              "-vf",
              "format=rgba",
              "-frames:v",
              "1",
              "-f",
              "rawvideo",
              "pipe:1",
            ])
          ).stdout;
          assert.deepEqual(sourcePixels, pixels);
          for (const format of ["png", "webp"] as const) {
            const bare = join(e.path, `bare.${format}`);
            await e.tool(FFMPEG, [
              ...BASE,
              "-f",
              "rawvideo",
              "-pixel_format",
              "rgba",
              "-video_size",
              `${width}x${height}`,
              "-i",
              raw,
              "-frames:v",
              "1",
              "-vf",
              format === "png" ? "format=rgba" : "format=bgra",
              "-c:v",
              format === "png" ? "png" : "libwebp",
              ...(format === "webp" ? ["-lossless", "1", "-quality", "100"] : []),
              "-f",
              "image2",
              "-update",
              "1",
              "-y",
              bare,
            ]);
            e.images(1);
            const encoded = await readFile(bare);
            const profile = referenceProfile(transfer);
            const saved = embedReference(encoded, format, profile, width, height, true);
            const output = join(e.path, `profiled.${format}`);
            await writeFile(output, saved);
            e.images(1);
            assert.deepEqual(imagePayload(encoded, format), imagePayload(saved, format));
            assert.deepEqual(extractedProfile(saved, format), profile);
            const actual = (
              await e.tool(FFMPEG, [
                ...BASE,
                "-i",
                output,
                "-frames:v",
                "1",
                "-pix_fmt",
                "rgba",
                "-f",
                "rawvideo",
                "pipe:1",
              ])
            ).stdout;
            assert.deepEqual(actual, pixels);
          }
          return {
            ...(production
              ? {
                  production: await proveProduction(
                    e,
                    source,
                    pixels,
                    width,
                    height,
                    transfer,
                    false,
                  ),
                }
              : {}),
            metadata,
            alpha: "preserved",
            dimensions: [width, height],
            pngAndWebpFull: "exact",
          };
        },
      );
  } finally {
    lab.finish();
  }
}

function yuvPatches(range: "tv" | "pc") {
  return range === "tv"
    ? [
        [16, 128, 128],
        [32, 128, 128],
        [64, 128, 128],
        [128, 128, 128],
        [235, 128, 128],
        [81, 90, 240],
        [145, 54, 34],
        [41, 240, 110],
      ]
    : [
        [0, 128, 128],
        [16, 128, 128],
        [32, 128, 128],
        [128, 128, 128],
        [255, 128, 128],
        [81, 90, 240],
        [145, 54, 34],
        [41, 240, 110],
      ];
}
function yuvImage(patches: number[][], sampling: "420" | "422" | "444") {
  const planes: Buffer[] = [];
  for (let channel = 0; channel < 3; channel++) {
    const width = channel === 0 || sampling === "444" ? WIDTH : WIDTH / 2;
    const height = channel === 0 || sampling !== "420" ? HEIGHT : HEIGHT / 2;
    const plane = Buffer.alloc(width * height);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        plane[y * width + x] = patches[Math.floor(x / (width / PATCHES))]![channel]!;
    planes.push(plane);
  }
  return Buffer.concat(planes);
}
function referenceRGB([y, cb, cr]: number[], matrix: string, range: "tv" | "pc") {
  const kr = matrix === "bt709" ? 0.2126 : 0.299;
  const kb = matrix === "bt709" ? 0.0722 : 0.114;
  const kg = 1 - kr - kb;
  const yy = range === "tv" ? ((y! - 16) * 255) / 219 : y!;
  const u = (cb! - 128) * (range === "tv" ? 255 / 224 : 1);
  const v = (cr! - 128) * (range === "tv" ? 255 / 224 : 1);
  return [
    yy + 2 * (1 - kr) * v,
    yy - ((2 * kb * (1 - kb)) / kg) * u - ((2 * kr * (1 - kr)) / kg) * v,
    yy + 2 * (1 - kb) * u,
  ].map((value) => Math.max(0, Math.min(255, Math.round(value))));
}
function centers(rgba: Buffer) {
  return Array.from({ length: PATCHES }, (_, patch) => {
    const offset = (Math.floor(HEIGHT / 2) * WIDTH + ((patch + 0.5) * WIDTH) / PATCHES) * 4;
    return [...rgba.subarray(offset, offset + 3)];
  });
}

await main();
