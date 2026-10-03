// Opt-in production-path image proof. Sources and references are synthetic.
import assert from "node:assert/strict";
import { join } from "node:path";
import { readFile, readdir, stat } from "node:fs/promises";
import { FrameResolver } from "../../src/cli/video-frames/resolver";
import { exportResolvedFrames } from "../../src/cli/video-frames/export";
import { createLab } from "./video-frames/lab";
import { referenceFrame, referenceFrames } from "./video-frames/pattern";
import { generateSmall, GENERATE_RAW, STRICT_INPUT } from "./video-frames/timing-evidence";
import { FFMPEG, FFPROBE } from "./video-frames/tools";
async function main() {
  const lab = await createLab(4);
  try {
    for (const format of ["png", "jpg", "webp"] as const)
      for (const quality of format === "png" ? ["full"] : ["low", "medium", "high", "full"])
        await lab.check(`${format}-${quality}`, 3, 8 * 1024 * 1024, async (e) => {
          const alpha = format !== "jpg";
          const source = await generateSmall(e, "source.mkv", { frames: 4, alpha });
          const original = await readFile(source);
          const resolver = new FrameResolver(source, { ffprobe: FFPROBE });
          const roles = await resolver.resolveSet("first-middle-last", e.signal);
          assert.deepEqual(
            roles.map((role) => role.identity.frameNumber),
            [1, 3, 4],
          );
          const result = await exportResolvedFrames(
            resolver,
            roles.map((role) => ({ identity: role.identity, name: `${role.selection}.${format}` })),
            {
              folder: join(e.path, "images"),
              image: { format, quality },
              ffmpeg: FFMPEG,
              ffprobe: FFPROBE,
              signal: e.signal,
            },
          );
          e.images(result.written);
          assert.equal(result.completed, true);
          assert.equal(result.written, 3);
          assert.equal(result.repeatedSelections, 0);
          assert.equal(result.peaks.rawFrames, 1);
          assert.ok(result.peaks.files <= 2);
          assert.ok(result.peaks.bytes <= 256 * 1024 * 1024);
          let maximumMean = 0;
          for (const role of roles) {
            const metadata = JSON.parse(
              (
                await e.tool(FFPROBE, [
                  "-v",
                  "error",
                  "-show_entries",
                  "stream=codec_name,width,height,sample_aspect_ratio:stream_side_data=side_data_type",
                  "-of",
                  "json",
                  join(result.destination, `${role.selection}.${format}`),
                ])
              ).stdout.toString("utf8"),
            ).streams[0];
            assert.equal(metadata.codec_name, format === "jpg" ? "mjpeg" : format);
            assert.deepEqual([metadata.width, metadata.height], [96, 64]);
            assert.ok(
              metadata.sample_aspect_ratio === undefined || metadata.sample_aspect_ratio === "1:1",
            );
            assert.ok(
              !metadata.side_data_list?.some(
                (side: { side_data_type: string }) => side.side_data_type === "Display Matrix",
              ),
            );
            const decoded = await e.tool(FFMPEG, [
              ...STRICT_INPUT,
              "-i",
              join(result.destination, `${role.selection}.${format}`),
              "-frames:v",
              "1",
              "-pix_fmt",
              "rgba",
              "-f",
              "rawvideo",
              "pipe:1",
            ]);
            const expected = referenceFrame(role.identity.frameNumber, 4, 96, 64, alpha);
            assert.equal(decoded.stdout.length, expected.length);
            let sum = 0;
            for (let i = 0; i < expected.length; i++) {
              if (i % 4 === 3) assert.equal(decoded.stdout[i], expected[i]);
              else sum += Math.abs(decoded.stdout[i]! - expected[i]!);
            }
            const mean = sum / (96 * 64 * 3);
            maximumMean = Math.max(maximumMean, mean);
            if (format === "png" || (format === "webp" && quality === "full"))
              assert.ok(decoded.stdout.equals(expected));
            else assert.ok(mean <= (format === "jpg" ? (quality === "low" ? 9 : 5) : 12));
          }
          assert.ok((await readFile(source)).equals(original));
          assert.ok(
            !(await readdir(result.destination)).some((name) => name.startsWith(".cdx-frames-")),
          );
          return {
            format,
            quality,
            ...result,
            maximumMean,
            sourcePreserved: true,
            stagingRemoved: true,
          };
        });
    await lab.check("repeated-roles", 3, 4 * 1024 * 1024, async (e) => {
      const source = await generateSmall(e, "source.mkv", { frames: 1, alpha: true });
      const resolver = new FrameResolver(source, { ffprobe: FFPROBE });
      const roles = await resolver.resolveSet("first-middle-last", e.signal);
      const result = await exportResolvedFrames(
        resolver,
        roles.map((role) => ({ identity: role.identity, name: `${role.selection}.png` })),
        { folder: join(e.path, "images"), ffmpeg: FFMPEG, ffprobe: FFPROBE, signal: e.signal },
      );
      e.images(result.written);
      assert.equal(result.written, 3);
      assert.equal(result.repeatedSelections, 2);
      const images = await Promise.all(
        roles.map((role) => readFile(join(result.destination, `${role.selection}.png`))),
      );
      assert.ok(images.every((image) => image.equals(images[0]!)));
      return result;
    });
    await lab.check("display-and-scale", 1, 4 * 1024 * 1024, async (e) => {
      const base = join(e.path, "aspect.mov");
      await e.tool(
        FFMPEG,
        [...GENERATE_RAW, "-vf", "setsar=2,format=argb", "-frames:v", "1", "-c:v", "qtrle", base],
        { input: referenceFrames(1, 96, 64, true) },
      );
      const source = join(e.path, "transformed.mov");
      await e.tool(FFMPEG, [
        "-v",
        "error",
        "-display_rotation",
        "90",
        "-display_hflip",
        "-i",
        base,
        "-c",
        "copy",
        source,
      ]);
      const resolver = new FrameResolver(source, { ffprobe: FFPROBE });
      const identity = await resolver.resolve({ kind: "first" }, e.signal);
      const result = await exportResolvedFrames(resolver, [{ identity, name: "display.png" }], {
        folder: join(e.path, "images"),
        image: { scale: 0.5 },
        ffmpeg: FFMPEG,
        ffprobe: FFPROBE,
        signal: e.signal,
      });
      e.images(result.written);
      assert.deepEqual([result.width, result.height], [32, 96]);
      const pixels = (
        await e.tool(FFMPEG, [
          ...STRICT_INPUT,
          "-i",
          join(result.destination, "display.png"),
          "-pix_fmt",
          "rgba",
          "-f",
          "rawvideo",
          "pipe:1",
        ])
      ).stdout;
      const original = referenceFrame(1, 1, 96, 64, true);
      let maximumRgbError = 0;
      for (let y = 0; y < 96; y++)
        for (let x = 0; x < 32; x++) {
          const sx = Math.floor((191 - (2 * y + 1)) / 2),
            sy = 63 - (2 * x + 1);
          for (let c = 0; c < 4; c++) {
            const error = Math.abs(
              pixels[(y * 32 + x) * 4 + c]! - original[(sy * 96 + sx) * 4 + c]!,
            );
            if (c === 3) assert.equal(error, 0);
            else maximumRgbError = Math.max(maximumRgbError, error);
          }
        }
      assert.ok(maximumRgbError <= 1);
      return { ...result, maximumRgbError, alphaExact: true };
    });
    for (const matrix of ["bt709", "smpte170m"])
      for (const range of ["tv", "pc"])
        for (const transfer of ["bt709", "iec61966-2-1"])
          await lab.check(`color-${matrix}-${range}-${transfer}`, 1, 1024 * 1024, async (e) => {
            const source = join(e.path, "color.mp4");
            const raw = Buffer.concat([
              Buffer.alloc(256, 120),
              Buffer.alloc(256, 150),
              Buffer.alloc(256, 110),
            ]);
            async function* input() {
              yield raw;
            }
            await e.tool(
              FFMPEG,
              [
                "-v",
                "error",
                "-f",
                "rawvideo",
                "-pixel_format",
                "yuv444p",
                "-video_size",
                "16x16",
                "-framerate",
                "1",
                "-color_range",
                range,
                "-i",
                "pipe:0",
                "-vf",
                `setparams=range=${range}:color_primaries=bt709:color_trc=${transfer}:colorspace=${matrix}`,
                "-frames:v",
                "1",
                "-c:v",
                "libx264",
                "-crf",
                "0",
                "-pix_fmt",
                range === "pc" ? "yuvj444p" : "yuv444p",
                "-color_range",
                range,
                "-colorspace",
                matrix,
                "-color_primaries",
                "bt709",
                "-color_trc",
                transfer,
                "-bsf:v",
                `h264_metadata=colour_primaries=1:transfer_characteristics=${transfer === "bt709" ? 1 : 13}:matrix_coefficients=${matrix === "bt709" ? 1 : 6}:video_full_range_flag=${range === "pc" ? 1 : 0}`,
                source,
              ],
              { input: input() },
            );
            const resolver = new FrameResolver(source, { ffprobe: FFPROBE });
            const identity = await resolver.resolve({ kind: "first" }, e.signal);
            assert.equal(resolver.state.metadata?.image?.colorPrimaries, "bt709");
            assert.equal(resolver.state.metadata?.image?.colorTransfer, transfer);
            assert.equal(resolver.state.metadata?.image?.colorRange, range);
            assert.equal(resolver.state.metadata?.image?.colorSpace, matrix);
            const savedYuv = (
              await e.tool(FFMPEG, [
                ...STRICT_INPUT,
                "-i",
                source,
                "-frames:v",
                "1",
                "-pix_fmt",
                range === "pc" ? "yuvj444p" : "yuv444p",
                "-f",
                "rawvideo",
                "pipe:1",
              ])
            ).stdout;
            assert.ok(
              savedYuv.equals(raw),
              "Lossless color fixture must preserve the supplied YUV values.",
            );
            const result = await exportResolvedFrames(resolver, [{ identity, name: "color.png" }], {
              folder: join(e.path, "images"),
              ffmpeg: FFMPEG,
              ffprobe: FFPROBE,
              signal: e.signal,
            });
            e.images(result.written);
            const decoded = (
              await e.tool(FFMPEG, [
                ...STRICT_INPUT,
                "-i",
                join(result.destination, "color.png"),
                "-pix_fmt",
                "rgba",
                "-f",
                "rawvideo",
                "pipe:1",
              ])
            ).stdout;
            const y = range === "tv" ? (120 - 16) / 219 : 120 / 255;
            const cb = 22 / (range === "tv" ? 224 : 255),
              cr = -18 / (range === "tv" ? 224 : 255);
            const kr = matrix === "bt709" ? 0.2126 : 0.299,
              kb = matrix === "bt709" ? 0.0722 : 0.114;
            const r = y + 2 * (1 - kr) * cr,
              b = y + 2 * (1 - kb) * cb,
              g = (y - kr * r - kb * b) / (1 - kr - kb);
            const expected = [r, g, b].map((value) => {
              if (transfer === "iec61966-2-1") return Math.round(value * 255);
              const linear = value < 0.081 ? value / 4.5 : ((value + 0.099) / 1.099) ** (1 / 0.45);
              return Math.round(
                255 * (linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055),
              );
            });
            const errors = expected.map((value, c) => Math.abs(value - decoded[c]!));
            assert.ok(
              Math.max(...errors) <= 3,
              JSON.stringify({ expected, observed: [...decoded.subarray(0, 3)], errors }),
            );
            assert.equal(decoded[3], 255);
            return {
              matrix,
              range,
              transfer,
              expected,
              observed: [...decoded.subarray(0, 4)],
              maximumError: Math.max(...errors),
            };
          });
    await lab.check("png-compression-cost", 2, 4 * 1024 * 1024, async (e) => {
      const measurements: object[] = [];
      for (const compression of [0, 9]) {
        const path = join(e.path, `compression-${compression}.png`);
        const started = performance.now();
        await e.tool(
          FFMPEG,
          [
            ...GENERATE_RAW,
            "-frames:v",
            "1",
            "-c:v",
            "png",
            "-compression_level",
            String(compression),
            path,
          ],
          { input: referenceFrames(1) },
        );
        e.images(1);
        const milliseconds = performance.now() - started;
        const decoded = (
          await e.tool(FFMPEG, [
            ...STRICT_INPUT,
            "-i",
            path,
            "-pix_fmt",
            "rgba",
            "-f",
            "rawvideo",
            "pipe:1",
          ])
        ).stdout;
        assert.ok(decoded.equals(referenceFrame(1, 1)));
        measurements.push({
          compression,
          milliseconds,
          bytes: (await stat(path)).size,
          pixelsExact: true,
        });
      }
      return { measurements };
    });
  } finally {
    lab.finish();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
