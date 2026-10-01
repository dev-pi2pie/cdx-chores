// On-demand Node configuration proof; regular suites use controlled tools only.
import assert from "node:assert/strict";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { ProcessOperation } from "../../src/cli/process/streaming";
import { inspectVideo } from "../../src/cli/video-frames/metadata";
import { inspectImageEncoders, requireImageEncoder } from "../../src/cli/video-frames/encoders";
import { imagePlan } from "../../src/cli/video-frames/image-plan";
import {
  imageOptions,
  encoderArguments,
  type ImageQuality,
} from "../../src/cli/video-frames/image-options";
import { createLab } from "./video-frames/lab";
import { referenceFrame, referenceFrames } from "./video-frames/pattern";
import { generateSmall, GENERATE_RAW, STRICT_INPUT } from "./video-frames/timing-evidence";
import { FFMPEG, FFPROBE } from "./video-frames/tools";
async function main() {
  const lab = await createLab(4);
  try {
    await lab.check("image-configuration", 10, 8 * 1024 * 1024, async (e) => {
      const operation = new ProcessOperation({ signal: e.signal });
      try {
        const encoders = await inspectImageEncoders(operation, FFMPEG);
        const observations: object[] = [];
        for (const alpha of [false, true]) {
          const source = await generateSmall(e, alpha ? "alpha.mkv" : "opaque.mkv", {
            frames: 1,
            alpha,
          });
          const stream = await inspectVideo(operation, source, FFPROBE);
          const options = imageOptions();
          const plan = imagePlan(stream, options);
          const raw = await e.tool(FFMPEG, [
            ...STRICT_INPUT,
            "-noautorotate",
            "-display_rotation",
            "0",
            "-i",
            source,
            "-filter_complex",
            plan.filters,
            "-map",
            "[out]",
            "-frames:v",
            "1",
            "-fps_mode",
            "passthrough",
            "-pix_fmt",
            "rgba",
            "-f",
            "rawvideo",
            "pipe:1",
          ]);
          const reference = referenceFrame(1, 1, 96, 64, alpha);
          assert.ok(raw.stdout.equals(reference));
          for (const format of alpha ? (["png", "webp"] as const) : (["jpg"] as const)) {
            for (const quality of format === "png" ? ["full"] : ["low", "medium", "high", "full"]) {
              const settings = imageOptions({ format, quality: quality as ImageQuality });
              requireImageEncoder(encoders, settings);
              const output = join(e.path, `${format}-${quality}.${format}`);
              async function* input() {
                yield raw.stdout;
              }
              await e.tool(
                FFMPEG,
                [
                  ...GENERATE_RAW,
                  "-frames:v",
                  "1",
                  ...encoderArguments(settings),
                  "-threads",
                  "1",
                  output,
                ],
                { input: input() },
              );
              e.images(1);
              const decoded = await e.tool(FFMPEG, [
                ...STRICT_INPUT,
                "-i",
                output,
                "-frames:v",
                "1",
                "-pix_fmt",
                "rgba",
                "-f",
                "rawvideo",
                "pipe:1",
              ]);
              let sum = 0;
              for (let i = 0; i < reference.length; i++) {
                if (i % 4 === 3) assert.equal(decoded.stdout[i], reference[i]);
                else sum += Math.abs(decoded.stdout[i]! - reference[i]!);
              }
              const mean = sum / ((reference.length / 4) * 3);
              if (format === "png" || (format === "webp" && quality === "full"))
                assert.ok(decoded.stdout.equals(reference));
              else assert.ok(mean <= (format === "jpg" ? (quality === "low" ? 9 : 5) : 12));
              observations.push({ format, quality, alphaExact: true, meanError: mean });
            }
          }
        }
        const base = join(e.path, "aspect.mov");
        await e.tool(
          FFMPEG,
          [...GENERATE_RAW, "-vf", "setsar=2,format=argb", "-frames:v", "1", "-c:v", "qtrle", base],
          { input: referenceFrames(1, 96, 64, true) },
        );
        const reflected = join(e.path, "reflected.mov");
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
          reflected,
        ]);
        const stream = await inspectVideo(operation, reflected, FFPROBE);
        const plan = imagePlan(stream, imageOptions({ scale: 0.5 }));
        assert.deepEqual([plan.width, plan.height], [32, 96]);
        const pixels = await e.tool(FFMPEG, [
          ...STRICT_INPUT,
          "-noautorotate",
          "-display_rotation",
          "0",
          "-i",
          reflected,
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
        ]);
        // Reference coordinates compose 2:1 aspect, CCW+reflection, and half nearest scaling.
        const original = referenceFrame(1, 1, 96, 64, true);
        const expected = Buffer.alloc(32 * 96 * 4);
        for (let y = 0; y < 96; y++)
          for (let x = 0; x < 32; x++) {
            const sx = Math.floor((191 - (2 * y + 1)) / 2),
              sy = 63 - (2 * x + 1);
            const offset = (sy * 96 + sx) * 4;
            original.copy(expected, (y * 32 + x) * 4, offset, offset + 4);
          }
        let transformedRgbMax = 0;
        for (let i = 0; i < expected.length; i++) {
          const delta = Math.abs(pixels.stdout[i]! - expected[i]!);
          if (i % 4 === 3) assert.equal(delta, 0, "transformed alpha differs");
          else transformedRgbMax = Math.max(transformedRgbMax, delta);
        }
        // The tested packed-RGB nearest resize has one-level arithmetic rounding.
        // Encoding below must still preserve every supplied post-transform byte.
        assert.ok(transformedRgbMax <= 1, "display RGB exceeds resize rounding tolerance");
        const png = join(e.path, "reflected.png");
        async function* outputPixels() {
          yield pixels.stdout;
        }
        await e.tool(
          FFMPEG,
          [
            "-v",
            "error",
            "-f",
            "rawvideo",
            "-pixel_format",
            "rgba",
            "-video_size",
            "32x96",
            "-framerate",
            "1",
            "-i",
            "pipe:0",
            "-frames:v",
            "1",
            ...encoderArguments(imageOptions()),
            png,
          ],
          { input: outputPixels() },
        );
        e.images(1);
        const saved = await e.tool(FFPROBE, [
          "-v",
          "error",
          "-show_entries",
          "stream=width,height,sample_aspect_ratio,color_primaries,color_transfer:stream_side_data=rotation,displaymatrix",
          "-of",
          "json",
          png,
        ]);
        const metadata = JSON.parse(saved.stdout.toString()).streams[0];
        assert.equal(metadata.width, 32);
        assert.equal(metadata.height, 96);
        assert.equal(metadata.sample_aspect_ratio, "1:1");
        assert.equal(metadata.side_data_list?.length ?? 0, 0);
        assert.equal(metadata.color_primaries, "bt709");
        assert.equal(metadata.color_transfer, "iec61966-2-1");
        const savedPixels = await e.tool(FFMPEG, [
          ...STRICT_INPUT,
          "-i",
          png,
          "-frames:v",
          "1",
          "-pix_fmt",
          "rgba",
          "-f",
          "rawvideo",
          "pipe:1",
        ]);
        assert.ok(savedPixels.stdout.equals(pixels.stdout), "PNG changed post-transform pixels");
        assert.ok(
          (await readFile(png))
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
        );
        return {
          encoders,
          observations,
          displayAlphaExact: true,
          transformedRgbMax,
          displayDimensions: [32, 96],
          inferenceDisclosed: true,
        };
      } finally {
        await operation.dispose();
      }
    });
  } finally {
    lab.finish();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
